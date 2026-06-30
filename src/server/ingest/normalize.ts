/**
 * Normalize -> canonicalize -> dedupe-key -> merge.
 *
 * Pure functions (no I/O except Web Crypto for the hash) so they unit-test
 * cleanly. See INGEST-PLAN.md section 3.
 */
import type { Ats, JobLocation, JobData, PayInfo, PayPeriod } from '../../types'
import type { NormalizedJob } from './types'

/* --------------------------------------------------------------- URL / ATS */

const TRACKING_PARAMS = new Set([
  'gh_jid',
  'gh_src',
  'ref',
  'source',
  'src',
  'lever-source',
  'lever-origin',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
])

/**
 * Canonicalize an apply URL for stable dedupe: lowercase host, drop tracking
 * params (gh_jid / utm_* / ref / source), drop a trailing /apply|/application
 * segment and trailing slash. Path case is preserved (some ATS ids are
 * case-sensitive). Falls back to a trimmed lowercase string on parse failure.
 */
export function canonicalizeUrl(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '')
  }
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    const lk = key.toLowerCase()
    if (TRACKING_PARAMS.has(lk) || lk.startsWith('utm_')) u.searchParams.delete(key)
  }
  // Strip a trailing /apply or /application and any trailing slash.
  u.pathname = u.pathname.replace(/\/(apply|application)\/?$/i, '').replace(/\/+$/, '')
  let out = u.toString()
  // URL serialization re-adds a trailing slash for bare-origin URLs; trim it.
  out = out.replace(/\/$/, '')
  return out
}

const ATS_HOST_RULES: { test: (h: string) => boolean; ats: Ats }[] = [
  { test: (h) => h.includes('greenhouse.io'), ats: 'greenhouse' },
  { test: (h) => h.includes('lever.co'), ats: 'lever' },
  { test: (h) => h.includes('ashbyhq.com'), ats: 'ashby' },
  { test: (h) => h.includes('myworkdayjobs.com') || h.includes('workday'), ats: 'workday' },
  { test: (h) => h.includes('linkedin.com'), ats: 'linkedin' },
  { test: (h) => h.includes('icims.com') || h.includes('smartrecruiters.com'), ats: 'other' },
]

/** Classify the ATS behind a URL by host. */
export function atsFromUrl(raw: string): Ats {
  try {
    const h = new URL(raw).hostname.toLowerCase()
    for (const r of ATS_HOST_RULES) if (r.test(h)) return r.ats
    return 'other'
  } catch {
    return 'unknown'
  }
}

/**
 * Extract a sweepable (ats, slug) pair from an apply URL, or null. Only the
 * three ATSes we have list APIs for (greenhouse / lever / ashby) are sweepable;
 * workday/icims/etc return null (they have no public board-listing endpoint we
 * enumerate by slug).
 */
export function slugFromUrl(raw: string): { ats: Ats; slug: string } | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const segs = u.pathname.split('/').filter(Boolean)
  if (host.includes('greenhouse.io')) {
    // boards.greenhouse.io/{slug}/...  | job-boards.greenhouse.io/{slug}/...
    // boards.greenhouse.io/embed/job_board?for={slug}
    const embedFor = u.searchParams.get('for')
    const slug = segs[0] === 'embed' ? embedFor : segs[0]
    return slug ? { ats: 'greenhouse', slug: slug.toLowerCase() } : null
  }
  if (host.includes('lever.co')) {
    return segs[0] ? { ats: 'lever', slug: segs[0].toLowerCase() } : null
  }
  if (host.includes('ashbyhq.com')) {
    // jobs.ashbyhq.com/{slug}/...  | api.ashbyhq.com/posting-api/job-board/{slug}
    const apiIdx = segs.indexOf('job-board')
    const slug = apiIdx >= 0 ? segs[apiIdx + 1] : segs[0]
    return slug ? { ats: 'ashby', slug: slug.toLowerCase() } : null
  }
  return null
}

/** SHA-256 hex (first 24 chars) of the canonical apply URL = the job id. */
export async function canonicalId(canonicalUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalUrl)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex.slice(0, 24)
}

/* ------------------------------------------------------------- dedup key */

const TERM_WORDS =
  /\b(summer|fall|winter|spring|autumn|20\d\d|fy\d\d|q[1-4]|h[12]|intern(ship)?|co[- ]?op|new\s?grad|university\s?grad|early\s?career)\b/gi

function norm(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[‐-―]/g, '-') // normalize unicode dashes
    .replace(TERM_WORDS, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normCompany(company: string): string {
  // Drop common corporate suffixes so "Stripe" and "Stripe, Inc." collapse.
  return norm(company).replace(/\b(inc|llc|ltd|corp|co|gmbh|technologies|technology|labs)\b/g, '').replace(/\s+/g, ' ').trim()
}

export function normTitle(title: string): string {
  return norm(title)
}

/** norm(company)+'|'+norm(title) -- the secondary (cross-URL) dedupe key. */
export function dedupKey(company: string, title: string): string {
  return `${normCompany(company)}|${normTitle(title)}`
}

/* -------------------------------------------------------- US location filter */

const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md',
  'ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc',
  'sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
])
const US_STATE_NAMES = [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware','florida',
  'georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine',
  'maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska',
  'nevada','new hampshire','new jersey','new mexico','new york','north carolina','north dakota','ohio',
  'oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota','tennessee','texas',
  'utah','vermont','virginia','washington','west virginia','wisconsin','wyoming','district of columbia',
]
const NON_US_MARKERS = [
  'canada','india','united kingdom',' uk',' u.k','england','scotland','ireland','germany','france',
  'spain','italy','netherlands','poland','romania','portugal','sweden','switzerland','israel','singapore',
  'australia','japan','china','hong kong','taiwan','korea','mexico','brazil','argentina','colombia',
  'chile','latam','emea','apac','bangalore','hyderabad','toronto','vancouver','london','dublin','berlin',
  'munich','paris','amsterdam','warsaw','tel aviv','sydney','tokyo','beijing','shanghai','mexico city',
  'são paulo','sao paulo',
]

export type UsVerdict = 'us' | 'non-us' | 'unknown'

/**
 * Classify a free-text location. US markers win; explicit non-US markers are
 * rejected; everything else is `unknown` (kept -- location is a SOFT signal, we
 * never false-exclude per DATA-MODEL decision 2 spirit).
 */
export function classifyUsLocation(loc: string): UsVerdict {
  const s = (loc ?? '').toLowerCase().trim()
  if (!s) return 'unknown'
  if (/\b(remote)\b/.test(s) && /\b(us|u\.s|usa|united states)\b/.test(s)) return 'us'
  if (/\b(united states|usa|u\.s\.a|u\.s\.)\b/.test(s)) return 'us'
  for (const m of NON_US_MARKERS) if (s.includes(m)) return 'non-us'
  if (US_STATE_NAMES.some((n) => s.includes(n))) return 'us'
  // "City, ST" -> 2-letter trailing token.
  const tokens = s.split(/[,/|]/).map((t) => t.trim()).filter(Boolean)
  for (const t of tokens) {
    const m = t.match(/\b([a-z]{2})\b$/)
    if (m && US_STATES.has(m[1])) return 'us'
  }
  return 'unknown'
}

/** True unless the location is explicitly non-US (unknown is kept). */
export function isUsOrUnknown(locations: JobLocation[] | undefined, rawStrings: string[] = []): boolean {
  const verdicts: UsVerdict[] = []
  for (const l of locations ?? []) {
    verdicts.push(classifyUsLocation([l.city, l.state, l.country].filter(Boolean).join(', ')))
  }
  for (const r of rawStrings) verdicts.push(classifyUsLocation(r))
  if (verdicts.some((v) => v === 'us')) return true
  if (verdicts.length > 0 && verdicts.every((v) => v === 'non-us')) return false
  return true // unknown / empty -> keep
}

/** Parse a "City, ST" / "City, State" / "US, CA, Santa Clara" string. */
export function parseLocation(raw: string): JobLocation {
  const s = (raw ?? '').trim()
  if (!s) return { city: null, state: null, country: null }
  if (/\b(remote)\b/i.test(s)) return { city: null, state: 'Remote', country: classifyUsLocation(s) === 'us' ? 'US' : null }
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 1) return { city: parts[0], state: null, country: null }
  // Common "City, ST" -> last token is state.
  const last = parts[parts.length - 1]
  const country = classifyUsLocation(s) === 'us' ? 'US' : null
  return { city: parts[0], state: last, country }
}

/* ----------------------------------------------------------------- pay */

/**
 * Parse a pay string like "$51/hr", "$172k/yr", "$33 - $51 per hour".
 * Returns null when nothing parseable is present.
 */
export function parsePay(raw: string | null | undefined, source: string): PayInfo | null {
  if (!raw) return null
  const s = raw.replace(/[‐-―]/g, '-').toLowerCase()
  const nums = [...s.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/g)]
    .map((m) => {
      let n = parseFloat(m[1].replace(/,/g, ''))
      if (m[2] === 'k') n *= 1000
      return n
    })
    .filter((n) => Number.isFinite(n) && n > 0)
  if (nums.length === 0) return null
  let period: PayPeriod = 'yearly'
  if (/\b(hour|hr|\/h)\b/.test(s) || /\/hr/.test(s)) period = 'hourly'
  else if (/\b(month|mo)\b/.test(s) || /\/mo/.test(s)) period = 'monthly'
  else if (/\b(year|yr|annum|annual)\b/.test(s) || /\/yr/.test(s)) period = 'yearly'
  else if (nums[0] < 200) period = 'hourly' // bare small number is almost always hourly
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return { min, max, currency: 'USD', period, source }
}

/* --------------------------------------------------------------- merge */

/** ATS precedence for choosing the canonical apply URL when sources disagree. */
const ATS_RANK: Record<Ats, number> = {
  ashby: 5,
  greenhouse: 5,
  lever: 5,
  workday: 5,
  other: 3, // smartrecruiters / icims
  linkedin: 2,
  unknown: 1,
}

function firstNonNull<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== null && v !== undefined && v !== '') return v
  return null
}

/**
 * Merge a freshly-seen job into the existing pool row (richest-wins). Returns a
 * partial patch for `records.update`. Never touches canonical_id, role_family,
 * tagged_by, or first_ingested_at (tagging is once-per-job; id is immutable).
 */
export function mergeInto(existing: JobData, incoming: JobData, now: string): Partial<JobData> {
  const patch: Partial<JobData> = { last_seen_at: now }

  // Union sources.
  const sources = [...new Set([...(existing.sources ?? []), ...(incoming.sources ?? [])])]
  if (sources.length !== (existing.sources ?? []).length) patch.sources = sources

  // apply_url + ats by ATS precedence (direct employer beats aggregator).
  if (ATS_RANK[incoming.ats] > ATS_RANK[existing.ats]) {
    patch.apply_url = incoming.apply_url
    patch.ats = incoming.ats
  }

  // Fill enrichment fields only when the existing row lacks them.
  if (!existing.pay && incoming.pay) patch.pay = incoming.pay
  if (existing.sponsorship === 'unknown' && incoming.sponsorship !== 'unknown') patch.sponsorship = incoming.sponsorship
  if (!existing.degrees?.length && incoming.degrees?.length) patch.degrees = incoming.degrees
  if (!existing.description_text && incoming.description_text) patch.description_text = incoming.description_text
  if (!existing.company_logo_url && incoming.company_logo_url) patch.company_logo_url = incoming.company_logo_url
  if (!existing.company_url && incoming.company_url) patch.company_url = incoming.company_url
  if (!existing.locations?.length && incoming.locations?.length) patch.locations = incoming.locations
  if (existing.workplace === 'unknown' && incoming.workplace !== 'unknown') patch.workplace = incoming.workplace
  if (!existing.term && incoming.term) patch.term = incoming.term
  if (existing.role_type === 'unknown' && incoming.role_type !== 'unknown') patch.role_type = incoming.role_type

  // posted_date: prefer the earliest known true (non-approx) date.
  const ed = firstNonNull(existing.posted_date)
  const id = firstNonNull(incoming.posted_date)
  if (!ed && id) patch.posted_date = id

  // Refresh active when a source reasserts it.
  if (incoming.active === true && existing.active !== true) patch.active = true

  return patch
}
