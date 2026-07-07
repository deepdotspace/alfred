/**
 * The ingest state machine -- one bounded tick per call. Drives feeds -> ATS
 * sweep -> firecrawl/exa -> soft-expiry, never exceeding the Worker subrequest
 * ceiling: each tick spends at most OP_BUDGET subrequest-ish ops, then the Job
 * checkpoints (ctx.continue) and resumes on the next alarm. Cross-source dedupe
 * happens in the DB (query-then-update on canonical_id), so the carried state
 * stays tiny (only the ~30 KB slug list is sizeable).
 *
 * See INGEST-PLAN.md section 4.
 */
import { ROLE_TAXONOMY } from '../../constants'
import type { Ats, AtsSlugData, MetaData } from '../../types'
import type { IntegrationInvoke } from '../integrations'
import type { Envelope, IngestPayload, IngestState, NormalizedJob, OwnerRecords } from './types'
import { emptyStats } from './types'
import { buildPoolMaps, upsertJob, shouldExpire, shouldPurge, type PoolMaps } from './pool'
import { slugFromUrl } from './normalize'
import { loadMeta, upsertMeta } from './meta'
import { fetchSimplify, SIMPLIFY_INTERN_URL, SIMPLIFY_NEWGRAD_URL } from './sources/simplify'
import { fetchSpeedyApply, SPEEDY_INTERN_URL, SPEEDY_NEWGRAD_URL } from './sources/speedyapply'
import { fetchAshby } from './sources/ats-ashby'
import { fetchGreenhouse } from './sources/ats-greenhouse'
import { fetchLever } from './sources/ats-lever'
import { fetchFirecrawl } from './sources/firecrawl'
import { fetchExa } from './sources/exa'

/** Subrequest-ish ops per alarm tick. Stays well under the ~50-90 ceiling. */
const OP_BUDGET = 40

interface FeedDef {
  kind: 'simplify' | 'speedyapply'
  role: 'internship' | 'new-grad-ft'
  url: string
}

const FEEDS: FeedDef[] = [
  { kind: 'simplify', role: 'internship', url: SIMPLIFY_INTERN_URL },
  { kind: 'simplify', role: 'new-grad-ft', url: SIMPLIFY_NEWGRAD_URL },
  { kind: 'speedyapply', role: 'internship', url: SPEEDY_INTERN_URL },
  { kind: 'speedyapply', role: 'new-grad-ft', url: SPEEDY_NEWGRAD_URL },
]

export interface IngestCtx {
  records: OwnerRecords
  invoke: IntegrationInvoke | null
  signal?: AbortSignal
}

export function initialIngestState(payload: IngestPayload): IngestState {
  return {
    mode: payload.mode,
    windowDays: payload.windowDays,
    maxSlugs: payload.maxSlugs ?? null,
    maxNodes: payload.maxNodes ?? 3,
    maxPerFeed: payload.maxPerFeed ?? null,
    skipIntegrations: payload.skipIntegrations ?? false,
    phase: 'feeds',
    feedIdx: 0,
    feedBuffer: [],
    slugs: [],
    slugIdx: 0,
    nodes: [],
    nodeIdx: 0,
    expireIdx: 0,
    stats: emptyStats(),
    startedAt: new Date().toISOString(),
  }
}

/** Rough completion fraction for ctx.progress. */
export function ingestProgress(s: IngestState): number {
  const order: Record<string, number> = { feeds: 0.1, ats: 0.4, integrations: 0.8, expire: 0.95, done: 1 }
  return order[s.phase] ?? 0
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function mergeSlugs(slugs: string[], list: NormalizedJob[]): number {
  const set = new Set(slugs)
  const before = set.size
  for (const n of list) {
    const s = slugFromUrl(n.apply_url)
    if (s) set.add(`${s.ats}|${s.slug}`)
  }
  slugs.length = 0
  slugs.push(...set)
  return set.size - before
}

async function recordAtsSlug(
  records: OwnerRecords,
  cache: Map<string, string>,
  ats: Ats,
  slug: string,
  count: number,
  now: string,
): Promise<void> {
  const key = `${ats}|${slug}`
  const recordId = cache.get(key)
  if (recordId) {
    await records.update('ats_slug', recordId, { last_swept_at: now, job_count: count })
    return
  }
  const data: AtsSlugData = { slug, ats, last_swept_at: now, job_count: count, first_seen_at: now }
  const res = (await records.create('ats_slug', data as unknown as Record<string, unknown>)) as { recordId: string }
  cache.set(key, res.recordId)
}

async function computeActiveNodes(records: OwnerRecords, maxNodes: number): Promise<string[]> {
  const profiles = (await records.query('profile', { limit: 5000 })) as Envelope<{ targeting?: { role_families?: string[] } }>[]
  const set = new Set<string>()
  for (const p of profiles) for (const f of p.data?.targeting?.role_families ?? []) set.add(f)
  let nodes = [...set]
  if (nodes.length === 0) nodes = ['swe-general'] // no users yet -> a sensible default
  return nodes.slice(0, maxNodes)
}

async function finalize(records: OwnerRecords, state: IngestState, now: string): Promise<void> {
  const patch: Partial<MetaData> = {
    last_run_at: now,
    pool_cursor: now,
    last_ingest_stats: state.stats as unknown as Record<string, unknown>,
  }
  if (state.mode === 'backfill') {
    patch.backfilled = true
    patch.last_backfill_at = now
  }
  await upsertMeta(records, patch)
}

/**
 * Run ONE tick. Returns `done:true` only when the whole pipeline has finished;
 * otherwise the caller checkpoints `state` and re-invokes on the next alarm.
 */
export async function runIngestTick(
  ctx: IngestCtx,
  state: IngestState,
): Promise<{ state: IngestState; done: boolean }> {
  const { records, invoke, signal } = ctx
  const now = new Date().toISOString()
  const stats = state.stats
  let ops = 0

  const maps: PoolMaps = await buildPoolMaps(records)
  ops++

  // ----------------------------------------------------------------- feeds
  if (state.phase === 'feeds') {
    // Fetch the current feed ONCE into the buffer (no per-tick 11 MB re-fetch),
    // then drain it across ticks in write-budget chunks.
    if (state.feedBuffer.length === 0 && state.feedIdx < FEEDS.length) {
      const feed = FEEDS[state.feedIdx]
      let list: NormalizedJob[] = []
      try {
        list =
          feed.kind === 'simplify'
            ? await fetchSimplify(feed.url, feed.role, state.windowDays, signal)
            : await fetchSpeedyApply(feed.url, feed.role, state.windowDays, signal)
      } catch (e) {
        stats.errors.push(`${feed.kind}-${feed.role}: ${errMsg(e)}`)
      }
      ops++ // the feed fetch
      if (state.maxPerFeed != null && list.length > state.maxPerFeed) list = list.slice(0, state.maxPerFeed)
      stats.raw += list.length
      stats.bySource[feed.kind] = (stats.bySource[feed.kind] ?? 0) + list.length
      stats.slugsSeeded += mergeSlugs(state.slugs, list)
      state.feedBuffer = list
    }

    while (state.feedBuffer.length > 0 && ops < OP_BUDGET) {
      if (signal?.aborted) break
      const n = state.feedBuffer[state.feedBuffer.length - 1]
      ops += await upsertJob(records, maps, n, invoke, now, stats)
      state.feedBuffer.pop()
    }

    if (state.feedBuffer.length === 0) state.feedIdx++
    if (state.feedIdx >= FEEDS.length) {
      state.phase = state.mode === 'delta' ? 'integrations' : 'ats'
    }
    return { state, done: false }
  }

  // ------------------------------------------------------------------- ats
  if (state.phase === 'ats') {
    const slugCache = new Map<string, string>()
    const slugRows = (await records.query('ats_slug', { limit: 20_000 })) as Envelope<AtsSlugData>[]
    ops++
    for (const r of slugRows) slugCache.set(`${r.data.ats}|${r.data.slug}`, r.recordId)

    const limit = state.maxSlugs != null ? Math.min(state.slugs.length, state.maxSlugs) : state.slugs.length
    while (state.slugIdx < limit && ops < OP_BUDGET - 2) {
      if (signal?.aborted) break
      const [ats, slug] = state.slugs[state.slugIdx].split('|') as [Ats, string]
      let found: NormalizedJob[] = []
      try {
        found =
          ats === 'ashby'
            ? await fetchAshby(slug, state.windowDays, signal)
            : ats === 'greenhouse'
              ? await fetchGreenhouse(slug, state.windowDays, signal)
              : ats === 'lever'
                ? await fetchLever(slug, state.windowDays, signal)
                : []
      } catch (e) {
        stats.errors.push(`${ats}/${slug}: ${errMsg(e)}`)
      }
      ops++ // the board fetch
      stats.raw += found.length
      stats.bySource[`ats-${ats}`] = (stats.bySource[`ats-${ats}`] ?? 0) + found.length

      for (const n of found) {
        if (ops >= OP_BUDGET) break
        ops += await upsertJob(records, maps, n, invoke, now, stats)
      }
      try {
        await recordAtsSlug(records, slugCache, ats, slug, found.length, now)
        ops++
      } catch {
        // cursor write is best-effort
      }
      state.slugIdx++
    }
    if (state.slugIdx >= limit) state.phase = 'integrations'
    return { state, done: false }
  }

  // ---------------------------------------------------------- integrations
  if (state.phase === 'integrations') {
    if (state.nodes.length === 0 && state.nodeIdx === 0) {
      state.nodes = state.skipIntegrations ? [] : await computeActiveNodes(records, state.maxNodes)
      if (!state.skipIntegrations) ops++
      if (state.mode === 'delta' && state.nodes.length > 0) {
        const meta = await loadMeta(records)
        ops++
        const last = meta?.data.last_integration_run_at ? Date.parse(meta.data.last_integration_run_at) : 0
        if (Date.now() - last < 24 * 3_600_000) state.nodes = [] // once/day cadence guard
      }
    }

    while (state.nodeIdx < state.nodes.length && ops < OP_BUDGET - 4) {
      if (signal?.aborted) break
      const node = ROLE_TAXONOMY.find((n) => n.id === state.nodes[state.nodeIdx])
      if (node && invoke) {
        try {
          const fc = await fetchFirecrawl(invoke, node, state.windowDays)
          ops++
          stats.raw += fc.length
          stats.bySource.firecrawl = (stats.bySource.firecrawl ?? 0) + fc.length
          for (const n of fc) {
            if (ops >= OP_BUDGET) break
            ops += await upsertJob(records, maps, n, invoke, now, stats)
          }
        } catch (e) {
          stats.errors.push(`firecrawl/${node.id}: ${errMsg(e)}`)
        }
        try {
          const ex = await fetchExa(invoke, node, state.windowDays)
          ops++
          stats.raw += ex.length
          stats.bySource.exa = (stats.bySource.exa ?? 0) + ex.length
          for (const n of ex) {
            if (ops >= OP_BUDGET) break
            ops += await upsertJob(records, maps, n, invoke, now, stats)
          }
        } catch (e) {
          stats.errors.push(`exa/${node.id}: ${errMsg(e)}`)
        }
      }
      state.nodeIdx++
    }
    if (state.nodeIdx >= state.nodes.length) {
      state.phase = 'expire'
      if (!state.skipIntegrations && state.nodes.length > 0) {
        try {
          await upsertMeta(records, { last_integration_run_at: now })
          ops++
        } catch {
          // best-effort
        }
      }
    }
    return { state, done: false }
  }

  // ---------------------------------------------------------------- expire
  if (state.phase === 'expire') {
    const nowMs = Date.now()
    let i = state.expireIdx
    while (i < maps.ordered.length && ops < OP_BUDGET) {
      const env = maps.ordered[i]
      if (state.mode === 'backfill' && shouldPurge(env.data, nowMs)) {
        // Backfill (weekly) hard-deletes clearly-dead rows (inactive + posted
        // >180d) so the pool never outgrows POOL_QUERY_LIMIT and blinds dedupe.
        // Chunked by the op budget, same as soft-expiry.
        await records.delete('job', env.recordId)
        ops++
        stats.purged++
      } else if (shouldExpire(env.data, nowMs)) {
        await records.update('job', env.recordId, { active: false })
        ops++
        stats.expired++
      }
      i++
    }
    state.expireIdx = i
    if (i >= maps.ordered.length) {
      state.phase = 'done'
      await finalize(records, state, now)
      return { state, done: true }
    }
    return { state, done: false }
  }

  // already done
  return { state, done: true }
}
