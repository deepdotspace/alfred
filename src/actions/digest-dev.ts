/**
 * DEV-ONLY digest + tracker verification actions (gated by ALLOW_DEBUG_ROUTES,
 * which the CLI sets only in `deepspace dev`/`test` and strips on deploy). These
 * PROVE the digest pipeline + seed the tracker; they are not product surface.
 *
 *   dev-run-digest        : run the full digest for the caller INLINE (select ->
 *                           live-verify -> compose -> send). Optional ensureMatches
 *                           writes a bounded set of real verdicts first so the run
 *                           has items. `to` overrides the recipient (send to the
 *                           owner's verified address to prove test-mode delivery).
 *   dev-seed-applications : seed application rows across stages for the caller so
 *                           the tracker board can be screenshotted.
 */
import type { ActionHandler } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { ApplicationData, ApplicationStage, JobData, MatchData } from '../types'
import { cronInvoker } from '../server/integrations'
import { buildDigestCtx, runDigestForUser } from '../server/digest/run'
import { loadProfileRow } from '../server/digest/select'
import type { OwnerRecords, Envelope } from '../server/digest/types'
import { hardFilter } from '../server/match/filters'
import { buildProfileSummary } from '../server/match/profile-summary'
import { scoreBatch } from '../server/match/score'

interface QueryEnvelope<T> {
  recordId: string
  data: T
}

function devEnabled(env: Env): boolean {
  return env.ALLOW_DEBUG_ROUTES === 'true'
}

/* ----------------------------------------------------- ensure real matches */

/**
 * Bounded inline matcher for verification: hard-filter the pool, score the top
 * `cap` survivors with real Haiku, and write verdicts the caller has none for.
 * Kept small (<= ~15 jobs) so it stays well under the subrequest ceiling in one
 * HTTP request. Mirrors the real pipeline's logic (filters + scoreBatch).
 */
async function ensureMatches(
  records: OwnerRecords,
  invoke: ReturnType<typeof cronInvoker>,
  userId: string,
  cap = 14,
): Promise<{ wrote: number; existing: number }> {
  const profile = await loadProfileRow(records, userId)
  if (!profile) return { wrote: 0, existing: 0 }

  const existingRows = (await records.query('match', { where: { user_id: userId }, limit: 20_000 })) as Envelope<MatchData>[]
  const haveJob = new Set(existingRows.filter((r) => r.data?.user_id === userId).map((r) => r.data.job_id))
  if (haveJob.size >= 6) return { wrote: 0, existing: haveJob.size }

  const pool = (await records.query('job', { limit: 20_000 })) as Envelope<JobData>[]
  const nowMs = Date.now()
  const wanted = new Set(profile.targeting?.role_families ?? [])
  const survivors = pool
    .filter((e) => e.data.active !== false && hardFilter(profile.targeting, e.data, nowMs).pass)
    .filter((e) => !haveJob.has(e.recordId))
    .map((e) => {
      const overlap = (e.data.role_family ?? []).reduce((n, f) => n + (wanted.has(f) ? 1 : 0), 0)
      return { e, rank: overlap }
    })
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.e)
    .slice(0, cap)

  if (survivors.length === 0) return { wrote: 0, existing: haveJob.size }

  const summary = buildProfileSummary(profile)
  const now = new Date().toISOString()
  let wrote = 0
  for (let i = 0; i < survivors.length; i += 10) {
    const batch = survivors.slice(i, i + 10)
    const verdicts = await scoreBatch(invoke, summary, batch)
    for (const v of verdicts) {
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
      wrote++
    }
  }
  return { wrote, existing: haveJob.size }
}

/* ----------------------------------------------------------- dev-run-digest */

export const devRunDigest: ActionHandler<Env> = async ({ userId, params, env }) => {
  if (!devEnabled(env)) return { success: false, error: 'not found' }

  const ctx = buildDigestCtx(env)
  const invoke = cronInvoker(buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`))

  let ensured: { wrote: number; existing: number } | null = null
  if (params?.ensureMatches === true) {
    ensured = await ensureMatches(ctx.records, invoke, userId)
  }

  const profile = await loadProfileRow(ctx.records, userId)
  if (!profile) return { success: false, error: 'no profile for caller (seed it first)' }

  const result = await runDigestForUser(ctx, userId, profile, {
    toOverride: typeof params?.to === 'string' ? params.to : undefined,
    force: params?.force !== false, // default true for the dev path
    dryRun: params?.dryRun === true,
    skipVerify: params?.skipVerify === true,
    includeHtml: true,
  })

  return { success: true, data: { ensured, result } }
}

/* ------------------------------------------------------ dev-seed-applications */

const SEED_STAGES: ApplicationStage[] = ['saved', 'tailored', 'applied', 'interview', 'offer', 'rejected']

export const devSeedApplications: ActionHandler<Env> = async ({ userId, tools, env }) => {
  if (!devEnabled(env)) return { success: false, error: 'not found' }

  // Distinct real pool jobs (caller can read the shared pool).
  const jq = await tools.query('job', { limit: 60 })
  if (!jq.success) return jq
  const jobs = ((jq.data as unknown as { records: QueryEnvelope<JobData>[] }).records ?? []).filter((r) => r.data?.active !== false)
  if (jobs.length < SEED_STAGES.length) return { success: false, error: `pool too small (${jobs.length})` }

  // Existing applications (idempotency: reuse a row for the same job).
  const aq = await tools.query('application', { where: { user_id: userId }, limit: 5000 })
  const existing = aq.success ? ((aq.data as unknown as { records: QueryEnvelope<ApplicationData>[] }).records ?? []) : []
  const byJob = new Map(existing.filter((r) => r.data?.user_id === userId).map((r) => [r.data.job_id, r]))

  const now = new Date().toISOString()
  const seeded: Record<string, number> = {}
  let cursor = 0
  for (const stage of SEED_STAGES) {
    // Pick the next pool job not already used by this seed pass.
    const job = jobs[cursor++]
    if (!job) break
    const appliedAt = stage === 'applied' || stage === 'interview' || stage === 'offer' ? now : null
    const prior = byJob.get(job.recordId)
    if (prior) {
      await tools.update('application', prior.recordId, { stage, applied_at: appliedAt, updated_at: now })
    } else {
      const data: ApplicationData = {
        user_id: userId,
        job_id: job.recordId,
        stage,
        resume_doc_id: null,
        cover_letter_doc_id: null,
        applied_at: appliedAt,
        notes: '',
        created_at: now,
        updated_at: now,
      }
      await tools.create('application', data as unknown as Record<string, unknown>)
    }
    seeded[stage] = (seeded[stage] ?? 0) + 1
  }

  return { success: true, data: { seeded } }
}
