/**
 * The per-user matcher: hard filter (code) -> Haiku qualify/rank -> write match
 * rows. Runs server-side only, in OWNER context, so it sets `user_id` EXPLICITLY
 * (match is server-written, not userBound -- see match-schema.ts).
 *
 * Two entry points share the SAME filter + scoring:
 *   - runMatchTick  : the background Job, chunked across alarm ticks under the
 *                     Worker subrequest ceiling (like ingest).
 *   - previewMatch  : a bounded, inline, NO-WRITE run for the dev preview action
 *                     (proves honest output + that the hard filters reject
 *                     mismatches) without enqueuing a Job.
 *
 * See docs/specs/V1-PLAN.md section 9.
 */
import type { JobData, MatchData, ProfileData } from '../../types'
import { resolveRoleFamilyIds } from '../../constants'
import { hardFilter, jobMatchesPreferredLocation } from './filters'
import { buildProfileSummary } from './profile-summary'
import { scoreBatch } from './score'
import type {
  Envelope,
  MatchCtx,
  MatchPayload,
  MatchState,
  OwnerRecords,
  PreviewResult,
  RejectedExample,
  ScoredVerdict,
} from './types'
import { emptyMatchStats } from './types'

/** Subrequest-ish ops per alarm tick (well under the ~50 ceiling). */
const OP_BUDGET = 40
/** Jobs per Haiku call. */
const BATCH_SIZE = 10
/** Cap jobs scored in a full Job run (cost guard ~ a few cents). */
const MAX_SCORE = 80
/** Cap jobs scored in the inline dev preview (fits one HTTP request). */
const MAX_PREVIEW = 30
const POOL_LIMIT = 20_000

/* ------------------------------------------------------------- loads */

export async function loadProfile(records: OwnerRecords, userId: string): Promise<ProfileData | null> {
  const rows = (await records.query('profile', { where: { user_id: userId }, limit: 500 })) as Envelope<ProfileData>[]
  const mine = rows.filter((r) => r.data?.user_id === userId)
  return mine[0]?.data ?? null
}

async function loadPool(records: OwnerRecords): Promise<Envelope<JobData>[]> {
  return (await records.query('job', { limit: POOL_LIMIT })) as Envelope<JobData>[]
}

async function loadExistingMatches(records: OwnerRecords, userId: string): Promise<Map<string, Envelope<MatchData>>> {
  const rows = (await records.query('match', { where: { user_id: userId }, limit: POOL_LIMIT })) as Envelope<MatchData>[]
  const map = new Map<string, Envelope<MatchData>>()
  for (const r of rows) if (r.data?.user_id === userId && r.data?.job_id) map.set(r.data.job_id, r)
  return map
}

/* ------------------------------------------------------- filter + order */

function postedMs(d: JobData): number {
  const t = d.posted_date ? Date.parse(d.posted_date) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * Hard-filter the pool and order survivors best-first: more role-family overlap,
 * then a preferred-location boost, then recency. Haiku does the real ranking;
 * this just decides which jobs to score first under the cap.
 */
function selectSurvivors(pool: Envelope<JobData>[], profile: ProfileData, nowMs: number): Envelope<JobData>[] {
  const t = profile.targeting
  const wanted = new Set(resolveRoleFamilyIds(t?.role_families))
  const survivors = pool.filter((e) => hardFilter(t, e.data, nowMs).pass)
  return survivors
    .map((e) => {
      const overlap = (e.data.role_family ?? []).reduce((n, f) => n + (wanted.has(f) ? 1 : 0), 0)
      const locBoost = jobMatchesPreferredLocation(e.data, t) ? 1 : 0
      return { e, rank: overlap * 10 + locBoost * 3, posted: postedMs(e.data) }
    })
    .sort((a, b) => b.rank - a.rank || b.posted - a.posted)
    .map((x) => x.e)
}

/* --------------------------------------------------------------- write */

function isShown(q: string): boolean {
  return q === 'yes' || q === 'stretch'
}

/**
 * Write one verdict (create or update, keeping the latest per pair). Returns ops
 * spent (1). NEW badge (seen=false) on first creation, or when a previously
 * hidden ("no") verdict newly becomes shown; otherwise preserve the seen flag.
 */
async function writeVerdict(
  records: OwnerRecords,
  existing: Map<string, Envelope<MatchData>>,
  userId: string,
  v: ScoredVerdict,
  now: string,
): Promise<{ created: boolean }> {
  const prior = existing.get(v.job_id)
  if (prior) {
    const wasHidden = !isShown(prior.data.qualify)
    const seen = wasHidden && isShown(v.qualify) ? false : prior.data.seen
    await records.update('match', prior.recordId, {
      qualify: v.qualify,
      score: v.score,
      reason: v.reason,
      matched: v.matched,
      missing: v.missing,
      timing: v.timing,
      seen,
    })
    return { created: false }
  }
  const data: MatchData = {
    user_id: userId,
    job_id: v.job_id,
    qualify: v.qualify,
    score: v.score,
    reason: v.reason,
    matched: v.matched,
    missing: v.missing,
    timing: v.timing,
    created_at: now,
    seen: false,
  }
  await records.create('match', data as unknown as Record<string, unknown>)
  return { created: true }
}

/* ------------------------------------------------------------- Job ticks */

/**
 * Build the initial state: load + hard-filter + order, then (incremental mode)
 * drop jobs that already have a verdict. Computes the candidate set ONCE so it
 * stays stable across ticks even if ingest mutates the pool.
 */
export async function initMatchState(ctx: MatchCtx, payload: MatchPayload): Promise<MatchState> {
  const stats = emptyMatchStats()
  const state: MatchState = {
    userId: payload.userId,
    mode: payload.mode,
    jobIds: [],
    cursor: 0,
    stats,
    startedAt: new Date().toISOString(),
  }

  const profile = await loadProfile(ctx.records, payload.userId)
  if (!profile) {
    stats.errors.push('no profile')
    return state
  }

  const pool = await loadPool(ctx.records)
  stats.poolSize = pool.length
  const survivors = selectSurvivors(pool, profile, Date.now())
  stats.survived = survivors.length

  let ids = survivors.map((e) => e.recordId)
  if (payload.mode === 'incremental') {
    const existing = await loadExistingMatches(ctx.records, payload.userId)
    ids = ids.filter((id) => !existing.has(id))
  }
  state.jobIds = ids.slice(0, MAX_SCORE)
  return state
}

/** Run ONE tick. Returns done:true only when every candidate has been scored. */
export async function runMatchTick(ctx: MatchCtx, state: MatchState): Promise<{ state: MatchState; done: boolean }> {
  const { records, invoke, signal } = ctx
  const stats = state.stats
  if (state.cursor >= state.jobIds.length || !invoke) return { state, done: true }

  const now = new Date().toISOString()
  let ops = 0

  const profile = await loadProfile(records, state.userId)
  ops++
  if (!profile) {
    stats.errors.push('profile disappeared mid-run')
    state.cursor = state.jobIds.length
    return { state, done: true }
  }
  const summary = buildProfileSummary(profile)

  const poolRows = await loadPool(records)
  ops++
  const byId = new Map(poolRows.map((e) => [e.recordId, e]))
  const existing = await loadExistingMatches(records, state.userId)
  ops++

  while (state.cursor < state.jobIds.length && ops < OP_BUDGET) {
    if (signal?.aborted) break
    const slice = state.jobIds.slice(state.cursor, state.cursor + BATCH_SIZE)
    const batch = slice.map((id) => byId.get(id)).filter((e): e is Envelope<JobData> => !!e)
    state.cursor += slice.length
    if (batch.length === 0) continue

    try {
      const verdicts = await scoreBatch(invoke, summary, batch)
      ops++
      stats.scored += batch.length
      for (const v of verdicts) {
        if (ops >= OP_BUDGET + BATCH_SIZE) break // never strand a half-written batch
        const { created } = await writeVerdict(records, existing, state.userId, v, now)
        ops++
        stats.written++
        if (created) stats.created++
        else stats.updated++
        if (isShown(v.qualify)) stats.kept++
        else stats.dropped++
      }
    } catch (e) {
      stats.errors.push(`batch@${state.cursor}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { state, done: state.cursor >= state.jobIds.length }
}

/* ----------------------------------------------------- inline dev preview */

/**
 * Bounded, NO-WRITE run for the dev preview action. Returns the scored verdicts
 * plus a few rejected examples so the report can prove the hard filters work.
 */
export async function previewMatch(ctx: MatchCtx, userId: string): Promise<PreviewResult> {
  const profile = await loadProfile(ctx.records, userId)
  if (!profile) {
    return { poolSize: 0, survived: 0, scored: 0, rejectedSamples: [], verdicts: [], jobs: {} }
  }
  const nowMs = Date.now()
  const pool = await loadPool(ctx.records)

  const rejectedSamples: RejectedExample[] = []
  for (const e of pool) {
    const v = hardFilter(profile.targeting, e.data, nowMs)
    if (!v.pass && rejectedSamples.length < 8 && e.data.active !== false) {
      rejectedSamples.push({ title: e.data.title, company: e.data.company, reason: v.reason ?? 'filtered' })
    }
  }

  const survivors = selectSurvivors(pool, profile, nowMs)
  const toScore = survivors.slice(0, MAX_PREVIEW)
  const summary = buildProfileSummary(profile)

  const jobs: Record<string, { title: string; company: string }> = {}
  for (const e of toScore) jobs[e.recordId] = { title: e.data.title, company: e.data.company }

  const verdicts: ScoredVerdict[] = []
  if (ctx.invoke) {
    for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
      const batch = toScore.slice(i, i + BATCH_SIZE)
      try {
        verdicts.push(...(await scoreBatch(ctx.invoke, summary, batch)))
      } catch {
        // best-effort preview
      }
    }
  }
  verdicts.sort((a, b) => b.score - a.score)

  return { poolSize: pool.length, survived: survivors.length, scored: toScore.length, rejectedSamples, verdicts, jobs }
}
