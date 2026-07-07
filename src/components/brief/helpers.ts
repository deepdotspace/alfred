/**
 * Brief display helpers -- pure functions that turn a (job, match) pair into the
 * exact strings/colors the prototype shows. Sparse data degrades gracefully
 * (DATA-MODEL: never fabricate a missing value).
 */
import type {
  JobData,
  MatchData,
  PayInfo,
  Qualify,
  Sponsorship,
  WorkAuthorization,
  Workplace,
  RoleType,
} from '../../types'
import { dedupKey } from '../../server/ingest/normalize'
import { resolveRoleFamilyIds } from '../../constants'

/* ------------------------------------------------------------- greeting */

export function greeting(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

/** Mono eyebrow date, e.g. "SAT · JUNE 28". */
export function todayLabel(d: Date = new Date()): string {
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/* --------------------------------------------------------- company avatar */

/** Pastel bg/fg pairs (the prototype palette + a few more), picked by company. */
const AVATAR_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#E7E1FB', '#6B4FD6'],
  ['#DCE7FB', '#2E6BD6'],
  ['#E6E8EC', '#3A3F4B'],
  ['#E4E2F7', '#5B53C9'],
  ['#D9EFE0', '#1E8E54'],
  ['#DCF0D9', '#3E8E2E'],
  ['#FBE7E1', '#D6594F'],
  ['#FBF0DC', '#C9871E'],
  ['#E1F3FB', '#2E92D6'],
  ['#F3E1FB', '#A04FD6'],
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function avatarColors(company: string): { bg: string; fg: string } {
  const [bg, fg] = AVATAR_PALETTE[hashString(company || '?') % AVATAR_PALETTE.length]
  return { bg, fg }
}

export function companyInitial(company: string): string {
  const c = (company || '').trim()
  return c ? c.charAt(0).toUpperCase() : '?'
}

/* --------------------------------------------------------------- labels */

export function workplaceLabel(w: Workplace): string | null {
  switch (w) {
    case 'remote':
      return 'Remote'
    case 'hybrid':
      return 'Hybrid'
    case 'onsite':
      return 'Onsite'
    default:
      return null
  }
}

export function roleTypeLabel(rt: RoleType): string | null {
  switch (rt) {
    case 'internship':
      return 'Internship'
    case 'co-op':
      return 'Co-op'
    case 'new-grad-ft':
      return 'New Grad'
    default:
      return null
  }
}

export interface FitDisplay {
  label: string
  variant: 'strong' | 'stretch'
}

/** qualify -> badge label + color. (Only yes/stretch ever reach the feed.) */
export function fitDisplay(q: Qualify): FitDisplay {
  return q === 'yes' ? { label: 'Strong fit', variant: 'strong' } : { label: 'Worth a look', variant: 'stretch' }
}

/* ----------------------------------------------------------------- time */

function relLabel(ms: number, now: number = Date.now()): string {
  const days = Math.floor((now - ms) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function relativePosted(postedDate: string | null): string | null {
  if (!postedDate) return null
  const t = Date.parse(postedDate)
  if (!Number.isFinite(t)) return null
  return relLabel(t)
}

/**
 * A job's effective freshness timestamp: its source `posted_date` when present,
 * else when Alfred first ingested it. Some sources (Firecrawl, a few ATS list
 * endpoints) give no posted_date; without this fallback those postings have no
 * age at all -- they can never sort or read as "fresh" even the day we find
 * them, and they slip past age-based expiry. Returns 0 only when neither parses.
 */
export function effectivePostedMs(job: Pick<JobData, 'posted_date' | 'first_ingested_at'>): number {
  const p = job.posted_date ? Date.parse(job.posted_date) : NaN
  if (Number.isFinite(p)) return p
  const f = job.first_ingested_at ? Date.parse(job.first_ingested_at) : NaN
  return Number.isFinite(f) ? f : 0
}

/**
 * Human age label for the card/detail meta. Uses the effective date, and flags
 * it approximate (rendered with a `~` / "Found") when we fall back to the ingest
 * date because the source gave no posted_date -- so we never imply a precise
 * posting age we do not actually have.
 */
export function effectiveAge(job: Pick<JobData, 'posted_date' | 'first_ingested_at'>): { text: string | null; approx: boolean } {
  const ms = effectivePostedMs(job)
  if (!ms) return { text: null, approx: false }
  return { text: relLabel(ms), approx: !job.posted_date }
}

/* ------------------------------------------------------------------ pay */

function roundK(n: number): number {
  return Math.round(n / 1000)
}

/** "$48/hr" | "$45-55/hr" | "$120k" | "$115-130k" | "$8k/mo" | null. */
export function formatPay(pay: PayInfo | null): string | null {
  if (!pay) return null
  const { min, max, period } = pay
  if (min == null && max == null) return null
  const lo = min ?? max!
  const hi = max ?? min!
  const same = lo === hi
  if (period === 'hourly') {
    return same ? `$${Math.round(lo)}/hr` : `$${Math.round(lo)}-${Math.round(hi)}/hr`
  }
  if (period === 'monthly') {
    return same ? `$${roundK(lo)}k/mo` : `$${roundK(lo)}-${roundK(hi)}k/mo`
  }
  // yearly
  return same ? `$${roundK(lo)}k` : `$${roundK(lo)}-${roundK(hi)}k`
}

/* ------------------------------------------------------------ location */

export function primaryLocation(job: JobData): string {
  const first = (job.locations ?? []).find((l) => l.city || l.state)
  if (first) {
    const parts = [first.city, first.state].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  if (job.workplace === 'remote') return 'Remote'
  return 'Location not stated'
}

/* ------------------------------------------------------------ sponsorship */

export function needsSponsorship(wa: WorkAuthorization | undefined): boolean {
  return wa === 'need-sponsorship-now' || wa === 'need-sponsorship-future'
}

/** Chip text shown ONLY when the user needs sponsorship (DATA-MODEL decision 2). */
export function sponsorChipText(s: Sponsorship): string {
  switch (s) {
    case 'offers':
      return 'Sponsors visa'
    case 'none':
      return 'No sponsorship'
    case 'citizenship-required':
      return 'Citizenship required'
    default:
      return 'Sponsorship not stated'
  }
}

/* --------------------------------------------------------- card meta line */

/** "{mode} · {role type} · {term} · {posted}[ · {sponsor}]" (present parts only). */
export function cardMetaLine(job: JobData, opts: { needsSponsor: boolean }): string {
  const parts: string[] = []
  const wp = workplaceLabel(job.workplace)
  if (wp) parts.push(wp)
  const rt = roleTypeLabel(job.role_type)
  if (rt) parts.push(rt)
  if (job.term) parts.push(job.term)
  const age = effectiveAge(job)
  if (age.text) parts.push(age.approx ? `~${age.text}` : age.text)
  if (opts.needsSponsor) parts.push(sponsorChipText(job.sponsorship))
  return parts.join(' · ')
}

/** Detail meta pills: [mode?, "{roleType} {term}"?, pay-or-"Pay not stated", "Posted {x}"]. */
export function detailMetaPills(job: JobData): string[] {
  const pills: string[] = []
  const wp = workplaceLabel(job.workplace)
  if (wp) pills.push(wp)
  const rt = roleTypeLabel(job.role_type)
  const termPart = [rt, job.term].filter(Boolean).join(' · ')
  if (termPart) pills.push(termPart)
  pills.push(formatPay(job.pay) ?? 'Pay not stated')
  const age = effectiveAge(job)
  if (age.text) pills.push(age.approx ? `Found ~${age.text}` : `Posted ${age.text}`)
  return pills
}

/* ------------------------------------------------------ JD -> bullets/paras */

/**
 * Render a raw JD into readable blocks. Splits on blank lines / bullet markers;
 * keeps it calm and scannable. Returns [] when there is no description.
 */
export function jdBlocks(text: string | null): string[] {
  if (!text) return []
  return text
    .replace(/\r/g, '')
    .split(/\n{1,}|(?:^|\n)\s*[•\-•]\s+/g)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 1)
    .slice(0, 40)
}

/* ------------------------------------------------------- brief read model */

/** One assembled feed item: the user's verdict joined to its shared pool job. */
export interface BriefRow {
  jobId: string
  match: MatchData
  job: JobData
}

const QUALIFY_RANK: Record<string, number> = { yes: 2, stretch: 1, no: 0 }

function postedMs(job: Pick<JobData, 'posted_date'>): number {
  const t = job.posted_date ? Date.parse(job.posted_date) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * The pool's own dedupe identity for a job (normCompany|normTitle, the same key
 * the ingest pool merges on). Two jobs with the same identity are "the same
 * role" by the system's own definition; different normalized titles (e.g.
 * "Backend" vs "Full-Stack" at one company) stay distinct.
 */
export function roleIdentity(job: Pick<JobData, 'company' | 'title'>): string {
  return dedupKey(job.company, job.title)
}

/**
 * Assemble the brief feed from the user's matches + the shared job pool.
 *
 * 1. Keep only shown verdicts (yes|stretch) for an active, non-dismissed job.
 * 2. Order best-first: qualify (yes>stretch), then score, then recency.
 * 3. Collapse to ONE card per role identity. The shared pool can hold more than
 *    one row for a single role -- a pre-existing duplicate the idempotent upsert
 *    can no longer heal, or one posting surfaced under two apply URLs -- and the
 *    matcher writes a verdict per pool row, so without this the same role would
 *    render twice. Keying on the pool's own `roleIdentity` keeps the feed and
 *    the pool in agreement on what "the same role" is, so distinct roles are
 *    never merged. Since the list is already best-first, the kept card is the
 *    strongest fit for that role.
 */
export function assembleBriefRows(
  matches: readonly MatchData[],
  jobById: ReadonlyMap<string, JobData>,
  dismissedJobIds: ReadonlySet<string>,
): BriefRow[] {
  const out: BriefRow[] = []
  for (const match of matches) {
    if (match.qualify !== 'yes' && match.qualify !== 'stretch') continue
    const job = jobById.get(match.job_id)
    if (!job || job.active === false) continue
    if (dismissedJobIds.has(match.job_id)) continue
    out.push({ jobId: match.job_id, match, job })
  }
  out.sort((a, b) => {
    const q = (QUALIFY_RANK[b.match.qualify] ?? 0) - (QUALIFY_RANK[a.match.qualify] ?? 0)
    if (q) return q
    const s = (b.match.score ?? 0) - (a.match.score ?? 0)
    if (s) return s
    return postedMs(b.job) - postedMs(a.job)
  })
  const seen = new Set<string>()
  const deduped: BriefRow[] = []
  for (const r of out) {
    const key = roleIdentity(r.job)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }
  return deduped
}

/* --------------------------------------------------------- brief stats */

/**
 * The honest greeting numbers. Deliberately does NOT use the total pool size as
 * "postings read" (the same every visit -> reads as fake), nor the survivor /
 * verdict count (which can equal "worth your time" and breaks the pitch).
 *
 *  - scanVolume      : the SCAN VOLUME -- how many pool postings Alfred read in
 *    the user's role families this cycle (the hard-filter INPUT: active jobs
 *    tagged with any of the user's families). This is the headline "postings
 *    read" number: real, drifts as the pool changes, and ALWAYS >= worth (it is
 *    the input the qualified set is selected FROM). With no declared families
 *    Alfred reads the whole active pool for the user.
 *  - consideredTotal : all postings Alfred has actually scored for the user
 *    (drives the first-brief detection; not displayed as the headline number).
 *  - readLatestCycle : postings scored in the last 24h (the overnight read).
 *    A match row's created_at is the first time it was scored, so re-scores of
 *    existing roles never inflate this -- only genuinely new reads count.
 *  - worth / strong  : shown matches (yes|stretch) and strong fits (yes).
 *  - isFirstBrief    : every verdict was written in the last day, i.e. only the
 *    first read has happened -- so the copy avoids "while you slept".
 */
export interface BriefStats {
  poolSize: number
  scanVolume: number
  worth: number
  strong: number
  newCount: number
  consideredTotal: number
  readLatestCycle: number
  isFirstBrief: boolean
  /** True once a match run has COMPLETED for this user (from profile.last_match_at).
   *  Distinguishes "still warming up" (never ran) from an honest zero-result run. */
  matchRan: boolean
}

const DAY_MS = 86_400_000

export function computeBriefStats(
  matches: readonly MatchData[],
  rows: readonly BriefRow[],
  jobs: readonly JobData[],
  roleFamilies: readonly string[] | undefined,
  now: number = Date.now(),
  matchRan: boolean = false,
): BriefStats {
  let activePool = 0
  for (const j of jobs) if (j.active !== false) activePool++

  // Scan volume = the hard-filter INPUT: active pool jobs tagged with any of the
  // user's role families (resolved through the same mapping the matcher uses).
  // No declared families -> Alfred scans the whole active pool for the user.
  const familyIds = new Set(resolveRoleFamilyIds(roleFamilies))
  let scanVolume = activePool
  if (familyIds.size) {
    scanVolume = 0
    for (const j of jobs) {
      if (j.active === false) continue
      if ((j.role_family ?? []).some((f) => familyIds.has(f))) scanVolume++
    }
  }

  let readLatestCycle = 0
  for (const m of matches) {
    const t = Date.parse(m.created_at)
    if (Number.isFinite(t) && now - t <= DAY_MS) readLatestCycle++
  }
  const consideredTotal = matches.length
  const worth = rows.length
  return {
    poolSize: activePool,
    // Guarantee the scan number is never below the qualified count.
    scanVolume: Math.max(scanVolume, worth),
    worth,
    strong: rows.reduce((n, r) => n + (r.match.qualify === 'yes' ? 1 : 0), 0),
    newCount: rows.reduce((n, r) => n + (r.match.seen === false ? 1 : 0), 0),
    consideredTotal,
    readLatestCycle,
    isFirstBrief: consideredTotal > 0 && consideredTotal === readLatestCycle,
    matchRan,
  }
}

/** "via Greenhouse" style source attribution (DATA-MAP §8). */
export function sourceAttribution(job: JobData): string | null {
  const map: Record<string, string> = {
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    ashby: 'Ashby',
    workday: 'Workday',
    linkedin: 'LinkedIn',
  }
  const label = map[job.ats]
  return label ? `via ${label}` : null
}

/* ------------------------------------------------------- feed sort + filter */

export type BriefSort = 'latest' | 'fit'
export type BriefFilter = 'recent' | 'all'

/**
 * "Recent" = posted or found within this many days. Older matches are never
 * dropped -- they stay one tap away under the "All" filter -- they are only kept
 * out of the default view so a wall of weeks-old postings does not bury today's
 * fresh, strong matches. The realistic live pool reaches ~60-90 days, so this
 * window is what separates "this is new" from "this has been sitting here".
 */
export const RECENT_DAYS = 14

/**
 * Re-order an already-assembled feed by the user's chosen sort. `latest` puts
 * the freshest postings first (ties broken by fit), so the day's new roles rise;
 * `fit` is the original strongest-first order (ties broken by recency). Pure and
 * non-mutating -- assembleBriefRows still owns the dedupe/keep-best-per-role.
 */
export function sortBriefRows(rows: readonly BriefRow[], sort: BriefSort): BriefRow[] {
  const copy = [...rows]
  if (sort === 'latest') {
    copy.sort((a, b) => {
      const t = effectivePostedMs(b.job) - effectivePostedMs(a.job)
      if (t) return t
      const q = (QUALIFY_RANK[b.match.qualify] ?? 0) - (QUALIFY_RANK[a.match.qualify] ?? 0)
      if (q) return q
      return (b.match.score ?? 0) - (a.match.score ?? 0)
    })
  } else {
    copy.sort((a, b) => {
      const q = (QUALIFY_RANK[b.match.qualify] ?? 0) - (QUALIFY_RANK[a.match.qualify] ?? 0)
      if (q) return q
      const s = (b.match.score ?? 0) - (a.match.score ?? 0)
      if (s) return s
      return effectivePostedMs(b.job) - effectivePostedMs(a.job)
    })
  }
  return copy
}

/** Rows posted or found within `days`. Everything else lives under "All". */
export function filterRecent(rows: readonly BriefRow[], now: number = Date.now(), days: number = RECENT_DAYS): BriefRow[] {
  const cutoff = now - days * DAY_MS
  return rows.filter((r) => effectivePostedMs(r.job) >= cutoff)
}
