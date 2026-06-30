/**
 * Idempotent upsert into the shared `job` pool + soft-expiry.
 *
 * Dedupe is query-then-update on the indexed `canonical_id` (the DO mints
 * recordId; an explicit recordId is ignored for custom collections -- see
 * references/sdk-footguns.md). Within a tick we hold a Map of the whole pool so
 * cross-source duplicates merge with one update, never a second row.
 *
 * See INGEST-PLAN.md sections 4 + 7.
 */
import type { JobData, Seniority } from '../../types'
import type { IntegrationInvoke } from '../integrations'
import type { Envelope, IngestStats, NormalizedJob, OwnerRecords } from './types'
import { canonicalizeUrl, canonicalId, atsFromUrl, dedupKey, mergeInto } from './normalize'
import { tagJob } from './tag'

export interface PoolMaps {
  byCanonical: Map<string, Envelope<JobData>>
  byDedup: Map<string, Envelope<JobData>>
  /** Stable order (oldest recordId first) for the chunked expiry cursor. */
  ordered: Envelope<JobData>[]
}

const POOL_QUERY_LIMIT = 20_000
/** Soft-expire a row not re-seen in this many days. */
const STALE_DAYS = 14
/** Soft-expire a row whose posting is older than this many days. */
const MAX_AGE_DAYS = 90

/** Load the whole pool into lookup maps (one query). */
export async function buildPoolMaps(records: OwnerRecords): Promise<PoolMaps> {
  const rows = (await records.query('job', { limit: POOL_QUERY_LIMIT })) as Envelope<JobData>[]
  const byCanonical = new Map<string, Envelope<JobData>>()
  const byDedup = new Map<string, Envelope<JobData>>()
  for (const r of rows) {
    if (r.data?.canonical_id) byCanonical.set(r.data.canonical_id, r)
    if (r.data?.dedup_key) byDedup.set(r.data.dedup_key, r)
  }
  const ordered = [...rows].sort((a, b) => a.recordId.localeCompare(b.recordId))
  return { byCanonical, byDedup, ordered }
}

function seniorityFor(roleType: string | undefined): Seniority {
  if (roleType === 'internship' || roleType === 'co-op') return 'intern'
  if (roleType === 'new-grad-ft') return 'entry'
  return 'unknown'
}

function toIsoDate(ms: number | null | undefined): string | null {
  return ms && Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null
}

/**
 * Upsert one normalized job. Returns the number of subrequest-ish ops it spent
 * (1 write, +1 if the Haiku tagger ran) so the caller can budget the tick.
 * Mutates `maps` and `stats` in place.
 */
export async function upsertJob(
  records: OwnerRecords,
  maps: PoolMaps,
  n: NormalizedJob,
  invoke: IntegrationInvoke | null,
  now: string,
  stats: IngestStats,
): Promise<number> {
  const canonicalUrl = canonicalizeUrl(n.apply_url)
  if (!canonicalUrl) return 0
  const cid = await canonicalId(canonicalUrl)
  const dkey = dedupKey(n.company, n.title)

  const existing = maps.byCanonical.get(cid) ?? maps.byDedup.get(dkey)

  if (existing) {
    const incoming = buildJobData(n, cid, canonicalUrl, dkey, { families: existing.data.role_family ?? [], taggedBy: existing.data.tagged_by }, now)
    const patch = mergeInto(existing.data, incoming, now)
    await records.update('job', existing.recordId, patch as Record<string, unknown>)
    const merged = { ...existing.data, ...patch }
    existing.data = merged
    maps.byCanonical.set(cid, existing)
    maps.byDedup.set(merged.dedup_key, existing)
    stats.merged++
    return 1
  }

  // New row: tag once (Haiku only for ambiguous titles).
  let ops = 0
  const tag = await tagJob(n.title, n.description_text, null, invoke)
  if (tag.taggedBy === 'haiku') ops++
  stats.byTagger[tag.taggedBy]++
  const data = buildJobData(n, cid, canonicalUrl, dkey, { families: tag.families, taggedBy: tag.taggedBy }, now)
  const res = (await records.create('job', data as unknown as Record<string, unknown>)) as { recordId: string }
  ops++
  const env: Envelope<JobData> = { recordId: res.recordId, data }
  maps.byCanonical.set(cid, env)
  maps.byDedup.set(dkey, env)
  maps.ordered.push(env)
  stats.created++
  return ops
}

function buildJobData(
  n: NormalizedJob,
  cid: string,
  canonicalUrl: string,
  dkey: string,
  tag: { families: string[]; taggedBy: JobData['tagged_by'] },
  now: string,
): JobData {
  return {
    canonical_id: cid,
    sources: [n.source],
    apply_url: canonicalUrl,
    ats: atsFromUrl(canonicalUrl),
    title: n.title,
    company: n.company || 'Unknown',
    company_logo_url: n.company_logo_url ?? null,
    company_url: n.company_url ?? null,
    locations: n.locations ?? [],
    workplace: n.workplace ?? 'unknown',
    role_family: tag.families,
    role_type: n.role_type ?? 'unknown',
    term: n.term ?? null,
    pay: n.pay ?? null,
    sponsorship: n.sponsorship ?? 'unknown',
    degrees: n.degrees ?? null,
    min_yoe: null,
    seniority: seniorityFor(n.role_type),
    key_skills: null,
    description_text: n.description_text ?? null,
    posted_date: toIsoDate(n.posted_date),
    first_ingested_at: now,
    last_seen_at: now,
    active: n.active ?? true,
    dedup_key: dkey,
    tagged_by: tag.taggedBy,
  }
}

/** True when a still-active row should be soft-expired this run. */
export function shouldExpire(job: JobData, nowMs: number): boolean {
  if (job.active === false) return false
  const lastSeen = job.last_seen_at ? Date.parse(job.last_seen_at) : NaN
  if (Number.isFinite(lastSeen) && nowMs - lastSeen > STALE_DAYS * 86_400_000) return true
  const posted = job.posted_date ? Date.parse(job.posted_date) : NaN
  if (Number.isFinite(posted) && nowMs - posted > MAX_AGE_DAYS * 86_400_000) return true
  return false
}
