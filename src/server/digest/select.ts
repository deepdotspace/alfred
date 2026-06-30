/**
 * Digest selection + cadence.
 *
 * Selection (DATA-MODEL "Digest email item"): all matches with qualify in
 * {yes,stretch} AND score >= the floor, that are NEW since the user's last
 * delivered digest, for jobs that are still active and not already on the
 * tracker. Variable count (quality bar, not fixed N), ordered strongest-first,
 * capped for email length.
 */
import type { ApplicationData, DigestCadence, DigestStateData, JobData, MatchData, ProfileData } from '../../types'
import { DIGEST_MAX_ITEMS, DIGEST_SCORE_FLOOR, DIGEST_WEEKLY_DAYS } from './constants'
import type { DigestItem, Envelope, OwnerRecords } from './types'

const POOL_LIMIT = 20_000
const PERSONAL_LIMIT = 20_000

/* ----------------------------------------------------------------- loaders */

export async function loadProfileRow(records: OwnerRecords, userId: string): Promise<ProfileData | null> {
  const rows = (await records.query('profile', { where: { user_id: userId }, limit: 500 })) as Envelope<ProfileData>[]
  return rows.find((r) => r.data?.user_id === userId)?.data ?? null
}

export async function loadAllProfiles(records: OwnerRecords): Promise<Envelope<ProfileData>[]> {
  return (await records.query('profile', { limit: 5000 })) as Envelope<ProfileData>[]
}

export async function loadDigestState(records: OwnerRecords, userId: string): Promise<Envelope<DigestStateData> | null> {
  const rows = (await records.query('digest_state', { where: { user_id: userId }, limit: 50 })) as Envelope<DigestStateData>[]
  return rows.find((r) => r.data?.user_id === userId) ?? null
}

async function loadPool(records: OwnerRecords): Promise<Map<string, JobData>> {
  const rows = (await records.query('job', { limit: POOL_LIMIT })) as Envelope<JobData>[]
  const m = new Map<string, JobData>()
  for (const r of rows) m.set(r.recordId, r.data)
  return m
}

async function loadUserMatches(records: OwnerRecords, userId: string): Promise<Envelope<MatchData>[]> {
  const rows = (await records.query('match', { where: { user_id: userId }, limit: PERSONAL_LIMIT })) as Envelope<MatchData>[]
  return rows.filter((r) => r.data?.user_id === userId)
}

async function loadUserApplications(records: OwnerRecords, userId: string): Promise<Set<string>> {
  const rows = (await records.query('application', { where: { user_id: userId }, limit: PERSONAL_LIMIT })) as Envelope<ApplicationData>[]
  const acted = new Set<string>()
  for (const r of rows) {
    if (r.data?.user_id === userId && r.data?.job_id) acted.add(r.data.job_id)
  }
  return acted
}

/* ------------------------------------------------------------------ cadence */

const QUALIFY_RANK: Record<string, number> = { yes: 2, stretch: 1, no: 0 }

function parseMs(iso: string | null | undefined): number {
  if (!iso) return NaN
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : NaN
}

/** Calendar-day key in America/New_York, e.g. "2026-06-28". */
function etDayKey(ms: number): string {
  // en-CA gives YYYY-MM-DD; the timeZone shift gives the ET wall-clock day.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/**
 * Is a digest due now for this cadence + last-delivered time?
 *  - daily  : not already delivered on today's ET calendar day.
 *  - weekly : never delivered, or >= 7 days since the last delivery.
 */
export function isDigestDue(cadence: DigestCadence, lastDigestAt: string | null, nowMs: number = Date.now()): boolean {
  const lastMs = parseMs(lastDigestAt)
  if (!Number.isFinite(lastMs)) return true
  if (cadence === 'weekly') {
    return nowMs - lastMs >= DIGEST_WEEKLY_DAYS * 86_400_000
  }
  // daily: due once the ET calendar day has rolled over.
  return etDayKey(nowMs) !== etDayKey(lastMs)
}

/* ---------------------------------------------------------------- selection */

/**
 * Pick the digest items for a user from their already-loaded matches/jobs/apps.
 * Pure + synchronous so it is unit-testable. `sinceMs` = the last delivered
 * digest time (NaN/undefined = first-ever digest -> include all qualifying).
 */
export function pickItems(
  matches: Envelope<MatchData>[],
  pool: Map<string, JobData>,
  actedJobIds: Set<string>,
  sinceMs: number,
): DigestItem[] {
  const hasSince = Number.isFinite(sinceMs)
  const out: DigestItem[] = []
  for (const r of matches) {
    const m = r.data
    if (m.qualify !== 'yes' && m.qualify !== 'stretch') continue
    if ((m.score ?? 0) < DIGEST_SCORE_FLOOR) continue
    const job = pool.get(m.job_id)
    if (!job || job.active === false) continue
    if (actedJobIds.has(m.job_id)) continue // already on the tracker
    if (hasSince) {
      const created = parseMs(m.created_at)
      if (Number.isFinite(created) && created <= sinceMs) continue // not new
    }
    out.push({ jobId: m.job_id, match: m, job })
  }
  out.sort((a, b) => {
    const q = (QUALIFY_RANK[b.match.qualify] ?? 0) - (QUALIFY_RANK[a.match.qualify] ?? 0)
    if (q) return q
    return (b.match.score ?? 0) - (a.match.score ?? 0)
  })
  return out.slice(0, DIGEST_MAX_ITEMS)
}

/** Load everything and select the items for one user. */
export async function selectDigestItems(
  records: OwnerRecords,
  userId: string,
  lastDigestAt: string | null,
): Promise<DigestItem[]> {
  const [pool, matches, acted] = await Promise.all([
    loadPool(records),
    loadUserMatches(records, userId),
    loadUserApplications(records, userId),
  ])
  return pickItems(matches, pool, acted, parseMs(lastDigestAt))
}
