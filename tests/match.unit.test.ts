/**
 * Unit tests for the matcher's HARD filters (pure, no I/O). These prove the
 * filters reject mismatches deterministically before any LLM cost is spent.
 */
import { describe, it, expect } from 'vitest'
import { hardFilter, needsSponsorship, isPassedInternshipTerm, isSeniorTitle } from '../src/server/match/filters'
import { resolveRoleFamilyIds } from '../src/constants'
import { toggleIntent, normalizeIntent } from '../src/components/profile/shared'
import type { JobData, RoleType, TargetingPrefs } from '../src/types'

function job(overrides: Partial<JobData> = {}): JobData {
  return {
    canonical_id: 'c1',
    sources: ['simplify'],
    apply_url: 'https://boards.greenhouse.io/acme/jobs/1',
    ats: 'greenhouse',
    title: 'Software Engineer Intern',
    company: 'Acme',
    company_logo_url: null,
    company_url: null,
    locations: [{ city: 'San Francisco', state: 'CA', country: 'US' }],
    workplace: 'onsite',
    role_family: ['swe-general', 'backend'],
    role_type: 'internship',
    term: 'Fall 2026',
    pay: null,
    sponsorship: 'unknown',
    degrees: null,
    min_yoe: null,
    seniority: 'intern',
    key_skills: null,
    description_text: null,
    posted_date: '2026-06-20',
    first_ingested_at: '2026-06-20T00:00:00.000Z',
    last_seen_at: '2026-06-27T00:00:00.000Z',
    active: true,
    dedup_key: 'acme|software engineer',
    tagged_by: 'keyword',
    ...overrides,
  }
}

const targeting: TargetingPrefs = {
  role_families: ['fullstack', 'backend', 'frontend', 'swe-general'],
  intent: ['internship', 'co-op', 'new-grad-ft'],
  locations: [],
  work_modes: [],
  open_to_relocate: true,
  work_authorization: 'unsure',
  pay_floor: null,
  company_prefs: null,
  requirements_freetext: '',
  dealbreakers_freetext: '',
}

const NOW = new Date('2026-06-28T12:00:00.000Z').getTime()

describe('hardFilter', () => {
  it('keeps an in-family early-career role', () => {
    expect(hardFilter(targeting, job(), NOW).pass).toBe(true)
  })

  it('rejects a role outside the desired families', () => {
    const v = hardFilter(targeting, job({ role_family: ['ml-ai'] }), NOW)
    expect(v.pass).toBe(false)
    expect(v.reason).toMatch(/role family/)
  })

  it('rejects an inactive job', () => {
    expect(hardFilter(targeting, job({ active: false }), NOW).pass).toBe(false)
  })

  it('rejects a senior title', () => {
    const v = hardFilter(targeting, job({ title: 'Senior Backend Engineer' }), NOW)
    expect(v.pass).toBe(false)
    expect(v.reason).toMatch(/senior/)
  })

  it('rejects 3+ years of experience', () => {
    expect(hardFilter(targeting, job({ min_yoe: 4 }), NOW).pass).toBe(false)
  })

  it('rejects an internship whose term has already started', () => {
    const v = hardFilter(targeting, job({ role_type: 'internship', term: 'Summer 2026' }), NOW)
    expect(v.pass).toBe(false)
    expect(v.reason).toMatch(/term passed/)
  })

  it('keeps a new-grad role with a bare year term (no timing filter)', () => {
    expect(hardFilter(targeting, job({ role_type: 'new-grad-ft', term: '2026' }), NOW).pass).toBe(true)
  })

  it('rejects a role type not in the user intent', () => {
    const internOnly: TargetingPrefs = { ...targeting, intent: ['internship'] }
    expect(hardFilter(internOnly, job({ role_type: 'new-grad-ft', term: null }), NOW).pass).toBe(false)
  })

  it('normalizes a legacy "both" intent at the filter (stale intent never rejects the pool)', () => {
    // Pre-fix: a stored ['both'] made the role_type filter reject every job ->
    // silent zero matches. It must normalize to all three stages and keep them.
    const legacy: TargetingPrefs = { ...targeting, intent: ['both' as RoleType] }
    expect(hardFilter(legacy, job({ role_type: 'new-grad-ft', term: null }), NOW).pass).toBe(true)
    expect(hardFilter(legacy, job({ role_type: 'internship', term: 'Fall 2026' }), NOW).pass).toBe(true)
  })

  it('treats a junk-only intent as no stage constraint (matches all stages)', () => {
    const junk: TargetingPrefs = { ...targeting, intent: ['garbage' as RoleType] }
    expect(hardFilter(junk, job({ role_type: 'new-grad-ft', term: null }), NOW).pass).toBe(true)
  })

  it('excludes explicit no-sponsorship only when the user needs it', () => {
    const needsVisa: TargetingPrefs = { ...targeting, work_authorization: 'need-sponsorship-now' }
    expect(hardFilter(needsVisa, job({ sponsorship: 'none' }), NOW).pass).toBe(false)
    // unknown sponsorship is surfaced, not excluded
    expect(hardFilter(needsVisa, job({ sponsorship: 'unknown' }), NOW).pass).toBe(true)
    // a citizen is never sponsorship-filtered
    expect(hardFilter(targeting, job({ sponsorship: 'none' }), NOW).pass).toBe(true)
  })

  it('keeps unknown role_type even when intent is set', () => {
    expect(hardFilter(targeting, job({ role_type: 'unknown', term: null }), NOW).pass).toBe(true)
  })

  it('a free-text role that resolves to a family still constrains by that family', () => {
    // "Computer Vision" resolves to ml-ai; a backend job should be rejected.
    const cv: TargetingPrefs = { ...targeting, role_families: ['Computer Vision'] }
    expect(hardFilter(cv, job({ role_family: ['backend'] }), NOW).pass).toBe(false)
    expect(hardFilter(cv, job({ role_family: ['ml-ai'] }), NOW).pass).toBe(true)
  })

  it('a free-text role that maps to NO family adds no hard constraint (never rejects the whole pool)', () => {
    // The latent 0-matches bug: a custom role like "Robotics" used to make the
    // role_family filter reject every job. It must now pass through to ranking.
    const custom: TargetingPrefs = { ...targeting, role_families: ['Robotics'] }
    expect(hardFilter(custom, job({ role_family: ['backend'] }), NOW).pass).toBe(true)
    expect(hardFilter(custom, job({ role_family: ['ml-ai'] }), NOW).pass).toBe(true)
  })
})

describe('resolveRoleFamilyIds', () => {
  it('passes taxonomy ids through unchanged', () => {
    expect(resolveRoleFamilyIds(['backend', 'frontend'])).toEqual(['backend', 'frontend'])
  })
  it('maps specific free-text labels to a taxonomy id via keywords', () => {
    expect(resolveRoleFamilyIds(['NLP'])).toContain('ml-ai')
    expect(resolveRoleFamilyIds(['Site Reliability (SRE)'])).toContain('devops')
    expect(resolveRoleFamilyIds(['Compilers'])).toContain('systems')
  })
  it('returns nothing for an unmappable custom role', () => {
    expect(resolveRoleFamilyIds(['Robotics'])).toEqual([])
    expect(resolveRoleFamilyIds([])).toEqual([])
    expect(resolveRoleFamilyIds(undefined)).toEqual([])
  })
})

describe('stage intent (multi-select)', () => {
  it('toggleIntent adds and removes', () => {
    expect(toggleIntent([], 'internship')).toEqual(['internship'])
    expect(toggleIntent(['internship', 'co-op'], 'co-op')).toEqual(['internship'])
  })
  it('normalizeIntent keeps valid stages, drops junk, and migrates legacy "both"', () => {
    expect(normalizeIntent(['co-op', 'internship'])).toEqual(['internship', 'co-op'])
    expect(normalizeIntent(['unknown' as RoleType, 'new-grad-ft'])).toEqual(['new-grad-ft'])
    expect(normalizeIntent(['both'])).toEqual(['internship', 'co-op', 'new-grad-ft'])
    expect(normalizeIntent([])).toEqual([])
  })
})

describe('helpers', () => {
  it('needsSponsorship reads the work-authorization enum', () => {
    expect(needsSponsorship('need-sponsorship-now')).toBe(true)
    expect(needsSponsorship('need-sponsorship-future')).toBe(true)
    expect(needsSponsorship('citizen-or-pr')).toBe(false)
    expect(needsSponsorship('unsure')).toBe(false)
  })

  it('isPassedInternshipTerm only applies to internships/co-ops', () => {
    expect(isPassedInternshipTerm(job({ role_type: 'internship', term: 'Spring 2026' }), NOW)).toBe(true)
    expect(isPassedInternshipTerm(job({ role_type: 'new-grad-ft', term: 'Spring 2026' }), NOW)).toBe(false)
    expect(isPassedInternshipTerm(job({ role_type: 'internship', term: 'Fall 2026' }), NOW)).toBe(false)
  })

  it('isSeniorTitle flags senior/staff/principal', () => {
    expect(isSeniorTitle('Staff Software Engineer')).toBe(true)
    expect(isSeniorTitle('Principal Engineer')).toBe(true)
    expect(isSeniorTitle('Software Engineer Intern')).toBe(false)
  })
})
