/**
 * HARD filters (code, before any LLM call) -- V1-PLAN section 9 + WORKFLOW.
 *
 * Pure functions over a JobData row + the user's TargetingPrefs. The matcher
 * runs these first to shrink the pool, then sends only survivors to Haiku for
 * the honest qualify/rank. The guiding rule (DATA-MODEL decision 2): never
 * FALSE-EXCLUDE. Exclude only on explicit signals; keep `unknown`/missing.
 *
 *   role_family   -- job must share >=1 family with the user's desired families
 *   role_type     -- job role_type must be in the user's intent (unknown kept)
 *   timing        -- drop internships/co-ops whose term has already started
 *   seniority     -- drop senior/staff/lead titles + 3+ YOE requirements
 *   work-auth     -- if the user needs sponsorship, drop ONLY explicit
 *                    none / citizenship-required (unknown is surfaced-with-flag)
 *   location      -- SOFT by default (ranking only); a hard exclude applies only
 *                    when the user explicitly restricts (not relocating + named
 *                    locations + no remote/anywhere)
 */
import type { JobData, TargetingPrefs, WorkAuthorization } from '../../types'
import { resolveRoleFamilyIds, normalizeIntent } from '../../constants'

export interface FilterVerdict {
  pass: boolean
  /** Set when pass === false: the first failing rule (for the dev preview). */
  reason?: string
}

/** True when the user's work authorization means they need visa sponsorship. */
export function needsSponsorship(wa: WorkAuthorization | undefined): boolean {
  return wa === 'need-sponsorship-now' || wa === 'need-sponsorship-future'
}

const SEASON_START_MONTH: Record<string, number> = {
  spring: 3,
  summer: 5,
  fall: 9,
  autumn: 9,
  winter: 12,
}

/**
 * Parse a term like "Summer 2026" / "Fall 2026" into the season's approximate
 * START time (ms). Requires BOTH a season word and a 4-digit year; returns null
 * otherwise (a bare year or unparseable term is treated as unknown timing).
 */
export function termStartMs(term: string | null | undefined): number | null {
  if (!term) return null
  const s = term.toLowerCase()
  const yearMatch = s.match(/\b(20\d\d)\b/)
  if (!yearMatch) return null
  const year = Number(yearMatch[1])
  for (const season of Object.keys(SEASON_START_MONTH)) {
    if (s.includes(season)) {
      return new Date(year, SEASON_START_MONTH[season] - 1, 1).getTime()
    }
  }
  return null
}

/**
 * An internship/co-op term is "passed" once its season has already begun: too
 * late to apply and start. New-grad terms are intentionally NOT timing-filtered
 * (a "2026" new-grad role is fine for a late-2026 graduate).
 */
export function isPassedInternshipTerm(job: JobData, nowMs: number): boolean {
  if (job.role_type !== 'internship' && job.role_type !== 'co-op') return false
  const start = termStartMs(job.term)
  return start != null && start < nowMs
}

const SENIOR_TITLE =
  /\b(senior|sr\.?|staff|principal|distinguished|architect|director|head\s+of|vp|vice\s+president|fellow)\b/i

export function isSeniorTitle(title: string): boolean {
  return SENIOR_TITLE.test(title ?? '')
}

function arrayIntersects(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  if (!a?.length || !b?.length) return false
  const set = new Set(a)
  return b.some((x) => set.has(x))
}

function locationsAllowAnywhere(locations: string[]): boolean {
  return locations.some((l) => /\b(remote|anywhere)\b/i.test(l))
}

function jobIsRemote(job: JobData): boolean {
  if (job.workplace === 'remote') return true
  return (job.locations ?? []).some((l) => /\bremote\b/i.test([l.city, l.state].filter(Boolean).join(' ')))
}

function jobMatchesAnyLocation(job: JobData, wanted: string[]): boolean {
  const hay = (job.locations ?? [])
    .map((l) => [l.city, l.state, l.country].filter(Boolean).join(' '))
    .join(' | ')
    .toLowerCase()
  return wanted.some((w) => {
    const t = w.toLowerCase().trim()
    return t.length > 1 && hay.includes(t)
  })
}

/**
 * Apply every hard filter. `targeting` may be partially populated (early
 * onboarding); each rule no-ops when its driving preference is absent so a thin
 * profile still gets a feed.
 */
export function hardFilter(targeting: TargetingPrefs | undefined, job: JobData, nowMs: number): FilterVerdict {
  if (job.active === false) return { pass: false, reason: 'inactive' }

  const t = targeting

  // role family: require overlap only when the user's declared families resolve
  // to >=1 taxonomy id. Free-text roles that map to no family add NO hard
  // constraint (they are left to the qualify/rank step) -- a custom role like
  // "Robotics" must never silently reject the whole pool.
  const familyIds = resolveRoleFamilyIds(t?.role_families)
  if (familyIds.length) {
    if (!arrayIntersects(familyIds, job.role_family)) {
      return { pass: false, reason: 'role family mismatch' }
    }
  }

  // role type / intent: drop a known role_type the user did not ask for.
  // Normalize the stored intent first (legacy 'both' / junk values) so a stale
  // intent can never hard-reject the whole pool. An empty normalized intent
  // means no role_type constraint (matches all stages), per the design.
  const intent = normalizeIntent(t?.intent)
  if (intent.length && job.role_type !== 'unknown') {
    if (!intent.includes(job.role_type)) {
      return { pass: false, reason: `role type ${job.role_type} not in intent` }
    }
  }

  // timing: internships/co-ops whose season already started.
  if (isPassedInternshipTerm(job, nowMs)) {
    return { pass: false, reason: `term passed (${job.term})` }
  }

  // seniority / qualification.
  if (isSeniorTitle(job.title)) return { pass: false, reason: 'senior title' }
  if (job.min_yoe != null && job.min_yoe >= 3) return { pass: false, reason: `${job.min_yoe}+ yrs required` }

  // work authorization: exclude only EXPLICIT no-sponsorship for users who need it.
  if (needsSponsorship(t?.work_authorization)) {
    if (job.sponsorship === 'none' || job.sponsorship === 'citizenship-required') {
      return { pass: false, reason: 'does not sponsor' }
    }
  }

  // location: hard-exclude only when the user explicitly restricts.
  if (t && t.open_to_relocate === false && t.locations?.length && !locationsAllowAnywhere(t.locations)) {
    if (!jobIsRemote(job) && !jobMatchesAnyLocation(job, t.locations)) {
      return { pass: false, reason: 'location restricted' }
    }
  }

  return { pass: true }
}

/** Soft location signal: does the job sit in a place the user wants? (ranking) */
export function jobMatchesPreferredLocation(job: JobData, targeting: TargetingPrefs | undefined): boolean {
  const wanted = targeting?.locations ?? []
  if (!wanted.length) return false
  if (locationsAllowAnywhere(wanted) && jobIsRemote(job)) return true
  return jobMatchesAnyLocation(job, wanted)
}
