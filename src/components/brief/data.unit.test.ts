/**
 * Unit tests for the brief read model (assembleBriefRows / roleIdentity).
 *
 * Regression for the live-QA bug: two IDENTICAL "Full-Stack Software Engineer
 * Intern @ Muru" cards rendered back-to-back. The shared job pool held two rows
 * for one role (a duplicate the idempotent upsert can no longer heal, or one
 * posting surfaced under two apply URLs), the matcher wrote a verdict per pool
 * row, and the feed rendered both. assembleBriefRows must collapse to one card
 * per role identity while keeping genuinely different roles separate.
 *
 * Run: npx vitest run src/components/brief/data.unit.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  assembleBriefRows,
  computeBriefStats,
  roleIdentity,
  effectivePostedMs,
  effectiveAge,
  sortBriefRows,
  filterRecent,
  type BriefRow,
} from './helpers'
import type { JobData, MatchData, Qualify } from '../../types'

function job(recordId: string, company: string, title: string, over: Partial<JobData> = {}): [string, JobData] {
  return [
    recordId,
    {
      canonical_id: `cid_${recordId}`,
      sources: ['simplify'],
      apply_url: `https://example.com/${recordId}`,
      ats: 'other',
      title,
      company,
      company_logo_url: null,
      company_url: null,
      locations: [],
      workplace: 'unknown',
      role_family: ['fullstack'],
      role_type: 'internship',
      term: null,
      pay: null,
      sponsorship: 'unknown',
      degrees: null,
      min_yoe: null,
      seniority: 'intern',
      key_skills: null,
      description_text: null,
      posted_date: '2026-06-01',
      first_ingested_at: '2026-06-01T00:00:00.000Z',
      last_seen_at: '2026-06-01T00:00:00.000Z',
      active: true,
      dedup_key: roleIdentity({ company, title }),
      tagged_by: 'keyword',
      ...over,
    },
  ]
}

function match(jobId: string, qualify: Qualify, score: number, over: Partial<MatchData> = {}): MatchData {
  return {
    user_id: 'u1',
    job_id: jobId,
    qualify,
    score,
    reason: 'fits',
    matched: [],
    missing: [],
    timing: 'good',
    created_at: '2026-06-01T00:00:00.000Z',
    seen: true,
    ...over,
  }
}

describe('assembleBriefRows', () => {
  it('collapses two pool rows for the same Muru role into ONE card (the live-QA bug), keeping the best fit', () => {
    // Two DISTINCT pool rows (distinct ids + apply URLs) for the same role, each
    // with its own match verdict -- exactly the duplicate observed in QA.
    const jobById = new Map<string, JobData>([
      job('jobA', 'Muru', 'Full-Stack Software Engineer Intern'),
      job('jobB', 'Muru', 'Full Stack Software Engineer Intern (Summer 2026)'),
    ])
    const matches = [match('jobA', 'yes', 78), match('jobB', 'yes', 82)]

    const rows = assembleBriefRows(matches, jobById, new Set())

    expect(rows).toHaveLength(1)
    // Best-first ordering means the higher-scoring verdict survives the collapse.
    expect(rows[0].jobId).toBe('jobB')
    expect(rows[0].match.score).toBe(82)
  })

  it('does NOT collapse genuinely different roles at the same company', () => {
    const jobById = new Map<string, JobData>([
      job('jobA', 'Muru', 'Full-Stack Software Engineer Intern'),
      job('jobB', 'Muru', 'Backend Software Engineer Intern'),
      job('jobC', 'Muru', 'Mobile Software Engineer Intern'),
    ])
    const matches = [match('jobA', 'yes', 82), match('jobB', 'yes', 80), match('jobC', 'stretch', 65)]

    const rows = assembleBriefRows(matches, jobById, new Set())

    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => r.jobId))).toEqual(new Set(['jobA', 'jobB', 'jobC']))
  })

  it('orders best-first (qualify > score) and drops no/inactive/dismissed', () => {
    const jobById = new Map<string, JobData>([
      job('strong', 'Acme', 'Software Engineer Intern'),
      job('stretch', 'Globex', 'Frontend Engineer Intern'),
      job('inactive', 'Initech', 'Backend Engineer Intern', { active: false }),
      job('dismissed', 'Umbrella', 'Platform Engineer Intern'),
    ])
    const matches = [
      match('stretch', 'stretch', 90),
      match('strong', 'yes', 70),
      match('inactive', 'yes', 95),
      match('dismissed', 'yes', 99),
      match('hidden', 'no', 100),
    ]

    const rows = assembleBriefRows(matches, jobById, new Set(['dismissed']))

    expect(rows.map((r) => r.jobId)).toEqual(['strong', 'stretch'])
  })
})

describe('computeBriefStats', () => {
  const NOW = Date.parse('2026-06-29T12:00:00.000Z')
  const recent = '2026-06-29T05:00:00.000Z' // ~7h ago (this cycle)
  const old = '2026-06-20T05:00:00.000Z' // 9 days ago (a prior cycle)

  function row(jobId: string, qualify: Qualify, score: number, created: string): { jobId: string; match: MatchData; job: JobData } {
    const [, j] = job(jobId, `Co${jobId}`, `Role ${jobId}`, { role_family: ['fullstack'] })
    return { jobId, job: j, match: match(jobId, qualify, score, { created_at: created }) }
  }

  /** A pool: `fam` fullstack jobs + `other` ml-ai jobs + `inactive` inactive fullstack jobs. */
  function pool(fam: number, other: number, inactive = 0): JobData[] {
    const out: JobData[] = []
    for (let i = 0; i < fam; i++) out.push(job(`f${i}`, `F${i}`, `FS ${i}`, { role_family: ['fullstack'] })[1])
    for (let i = 0; i < other; i++) out.push(job(`m${i}`, `M${i}`, `ML ${i}`, { role_family: ['ml-ai'] })[1])
    for (let i = 0; i < inactive; i++) out.push(job(`x${i}`, `X${i}`, `XS ${i}`, { role_family: ['fullstack'], active: false })[1])
    return out
  }

  it('"postings read" is the family SCAN VOLUME (hard-filter input), not the survivor count and not the full pool', () => {
    const matches = [
      match('a', 'yes', 80, { created_at: recent }),
      match('b', 'stretch', 60, { created_at: recent }),
      match('c', 'no', 30, { created_at: recent }),
    ]
    const rows = [row('a', 'yes', 80, recent), row('b', 'stretch', 60, recent)]
    // pool = 480 fullstack + 600 ml-ai; user targets fullstack only.
    const s = computeBriefStats(matches, rows, pool(480, 600), ['fullstack'], NOW)
    expect(s.scanVolume).toBe(480) // family-scoped scan, not 1080 pool, not 2 survivors
    expect(s.scanVolume).toBeGreaterThan(s.worth) // strictly above qualified
    expect(s.scanVolume).not.toBe(s.poolSize) // not the full static pool
    expect(s.worth).toBe(2)
    expect(s.strong).toBe(1)
    expect(s.consideredTotal).toBe(3)
  })

  it('scan volume excludes inactive jobs and other families; never below worth', () => {
    const rows = [row('a', 'yes', 80, recent), row('b', 'stretch', 60, recent)]
    const matches = rows.map((r) => r.match)
    const s = computeBriefStats(matches, rows, pool(50, 30, 10), ['fullstack'], NOW)
    expect(s.scanVolume).toBe(50) // 10 inactive fullstack + 30 ml-ai excluded
    expect(s.scanVolume).toBeGreaterThanOrEqual(s.worth)
  })

  it('a specific free-text role resolves to its family for the scan count too', () => {
    const rows = [row('a', 'yes', 80, recent)]
    const s = computeBriefStats(rows.map((r) => r.match), rows, pool(0, 40), ['Computer Vision'], NOW)
    // "Computer Vision" resolves to ml-ai, so it scans the 40 ml-ai jobs.
    expect(s.scanVolume).toBe(40)
  })

  it('no declared families -> Alfred scans the whole active pool', () => {
    const rows = [row('a', 'yes', 80, recent)]
    const s = computeBriefStats(rows.map((r) => r.match), rows, pool(20, 30, 5), [], NOW)
    expect(s.scanVolume).toBe(50) // all active (20 + 30), inactive excluded
    expect(s.poolSize).toBe(50)
  })

  it('readLatestCycle counts only the last 24h; first brief detected when all reads are recent', () => {
    const rows = [row('a', 'yes', 80, recent), row('b', 'stretch', 60, recent)]
    const s = computeBriefStats(rows.map((r) => r.match), rows, pool(100, 0), ['fullstack'], NOW)
    expect(s.readLatestCycle).toBe(2)
    expect(s.isFirstBrief).toBe(true)
  })

  it('a returning user (old reads present) is NOT a first brief', () => {
    const matches = [
      match('a', 'yes', 80, { created_at: old }),
      match('b', 'stretch', 60, { created_at: old }),
      match('c', 'yes', 78, { created_at: recent }),
    ]
    const rows = [row('a', 'yes', 80, old), row('c', 'yes', 78, recent), row('b', 'stretch', 60, old)]
    const s = computeBriefStats(matches, rows, pool(120, 0), ['fullstack'], NOW)
    expect(s.consideredTotal).toBe(3)
    expect(s.readLatestCycle).toBe(1)
    expect(s.isFirstBrief).toBe(false)
  })

  it('genuine empty: scan volume is real but nothing qualified (no fake zeros)', () => {
    const matches = [match('a', 'no', 30, { created_at: recent }), match('b', 'no', 20, { created_at: recent })]
    const s = computeBriefStats(matches, [], pool(300, 0), ['fullstack'], NOW)
    expect(s.scanVolume).toBe(300)
    expect(s.consideredTotal).toBe(2)
    expect(s.worth).toBe(0)
    expect(s.strong).toBe(0)
  })

  it('warming: no verdicts at all -> zero considered (hero shows warming, not zeros)', () => {
    const s = computeBriefStats([], [], pool(300, 0), ['fullstack'], NOW)
    expect(s.consideredTotal).toBe(0)
    expect(s.isFirstBrief).toBe(false)
  })
})

describe('feed freshness (effective date / sort / filter)', () => {
  const NOW = Date.parse('2026-06-29T12:00:00.000Z')

  function row(id: string, over: Partial<JobData> = {}, matchOver: Partial<MatchData> = {}): BriefRow {
    const [, j] = job(id, `Co_${id}`, `Role ${id}`, over)
    return { jobId: id, job: j, match: match(id, 'yes', 80, matchOver) }
  }

  it('effectivePostedMs uses posted_date when present, else first_ingested_at, else 0', () => {
    const [, dated] = job('a', 'A', 'A', { posted_date: '2026-06-20', first_ingested_at: '2026-06-25T00:00:00.000Z' })
    expect(effectivePostedMs(dated)).toBe(Date.parse('2026-06-20'))

    const [, undated] = job('b', 'B', 'B', { posted_date: null, first_ingested_at: '2026-06-25T00:00:00.000Z' })
    expect(effectivePostedMs(undated)).toBe(Date.parse('2026-06-25T00:00:00.000Z'))

    const [, none] = job('c', 'C', 'C', { posted_date: null, first_ingested_at: null as unknown as string })
    expect(effectivePostedMs(none)).toBe(0)
  })

  it('effectiveAge flags approximate only when it falls back to the ingest date', () => {
    const [, dated] = job('a', 'A', 'A', { posted_date: '2026-06-20' })
    expect(effectiveAge(dated).approx).toBe(false)

    const [, undated] = job('b', 'B', 'B', { posted_date: null, first_ingested_at: '2026-06-27T00:00:00.000Z' })
    expect(effectiveAge(undated).approx).toBe(true)
    expect(effectiveAge(undated).text).toBeTruthy()
  })

  it('sortBriefRows "latest" is freshest-first; "fit" is strongest-first', () => {
    const fresh = row('fresh', { posted_date: '2026-06-28' }, { qualify: 'stretch', score: 60 })
    const stale = row('stale', { posted_date: '2026-06-02' }, { qualify: 'yes', score: 95 })

    expect(sortBriefRows([stale, fresh], 'latest').map((r) => r.jobId)).toEqual(['fresh', 'stale'])
    // A strong-but-older role wins under "fit" even though it is much older.
    expect(sortBriefRows([fresh, stale], 'fit').map((r) => r.jobId)).toEqual(['stale', 'fresh'])
  })

  it('filterRecent keeps rows within RECENT_DAYS by effective date, including undated-but-newly-found', () => {
    const rows = [
      row('freshDated', { posted_date: '2026-06-28' }), // ~1d
      row('oldDated', { posted_date: '2026-06-01' }), // 28d
      row('undatedFresh', { posted_date: null, first_ingested_at: '2026-06-27T00:00:00.000Z' }), // ~2d
      row('undatedOld', { posted_date: null, first_ingested_at: '2026-05-01T00:00:00.000Z' }), // ~59d
    ]
    const kept = new Set(filterRecent(rows, NOW).map((r) => r.jobId))
    expect(kept).toEqual(new Set(['freshDated', 'undatedFresh']))
  })
})
