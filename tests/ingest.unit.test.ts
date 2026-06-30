/**
 * Unit tests for the ingest pipeline pure logic: canonicalize, slug extraction,
 * dedupe key, pay parsing, keyword tagging, the SpeedyApply markdown parser, and
 * the cross-source dedupe/merge via upsertJob against an in-memory records mock.
 *
 * Run: npx vitest run tests/ingest.unit.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  canonicalizeUrl,
  slugFromUrl,
  dedupKey,
  parsePay,
  atsFromUrl,
  classifyUsLocation,
} from '../src/server/ingest/normalize'
import { tagByKeywords } from '../src/server/ingest/tag'
import { fetchSpeedyApply } from '../src/server/ingest/sources/speedyapply'
import { buildPoolMaps, upsertJob } from '../src/server/ingest/pool'
import { emptyStats, type NormalizedJob, type OwnerRecords, type Envelope } from '../src/server/ingest/types'

describe('canonicalizeUrl', () => {
  it('strips tracking params, /apply, trailing slash, lowercases host', () => {
    expect(canonicalizeUrl('https://Boards.Greenhouse.io/Stripe/jobs/123?gh_jid=999&utm_source=x')).toBe(
      'https://boards.greenhouse.io/Stripe/jobs/123',
    )
    expect(canonicalizeUrl('https://jobs.lever.co/acme/abc-123/apply/')).toBe('https://jobs.lever.co/acme/abc-123')
  })
})

describe('slugFromUrl + atsFromUrl', () => {
  it('extracts sweepable (ats, slug) for the three ATSes', () => {
    expect(slugFromUrl('https://boards.greenhouse.io/spacex/jobs/1')).toEqual({ ats: 'greenhouse', slug: 'spacex' })
    expect(slugFromUrl('https://jobs.lever.co/palantir/abc')).toEqual({ ats: 'lever', slug: 'palantir' })
    expect(slugFromUrl('https://jobs.ashbyhq.com/rivianvw.tech/xyz')).toEqual({ ats: 'ashby', slug: 'rivianvw.tech' })
    expect(slugFromUrl('https://nvidia.wd5.myworkdayjobs.com/job/123')).toBeNull()
    expect(atsFromUrl('https://nvidia.wd5.myworkdayjobs.com/job/123')).toBe('workday')
  })
})

describe('dedupKey', () => {
  it('collapses season/term + corporate suffixes so cross-posts match', () => {
    const a = dedupKey('Stripe, Inc.', 'Software Engineer Intern - Summer 2026')
    const b = dedupKey('Stripe', 'Software Engineer Internship (Summer 2026)')
    expect(a).toBe(b)
  })
})

describe('parsePay', () => {
  it('parses hourly and yearly', () => {
    expect(parsePay('$51/hr', 'speedyapply')).toMatchObject({ min: 51, max: 51, period: 'hourly', currency: 'USD' })
    expect(parsePay('$172k/yr', 'speedyapply')).toMatchObject({ min: 172000, max: 172000, period: 'yearly' })
    expect(parsePay('$33 - $51 per hour', 'ashby')).toMatchObject({ min: 33, max: 51, period: 'hourly' })
    expect(parsePay('', 'x')).toBeNull()
  })
})

describe('classifyUsLocation', () => {
  it('keeps US + unknown, rejects explicit non-US', () => {
    expect(classifyUsLocation('Palo Alto, CA')).toBe('us')
    expect(classifyUsLocation('Bangalore, India')).toBe('non-us')
    expect(classifyUsLocation('Remote')).toBe('unknown')
  })
})

describe('tagByKeywords', () => {
  it('maps titles to taxonomy families with word boundaries', () => {
    expect(tagByKeywords('Frontend Engineer Intern')).toContain('frontend')
    expect(tagByKeywords('Machine Learning Intern')).toContain('ml-ai')
    expect(tagByKeywords('Software Engineer Intern')).toContain('swe-general')
    // "ml" must not match inside "html"
    expect(tagByKeywords('HTML Email Designer')).not.toContain('ml-ai')
  })
})

describe('fetchSpeedyApply parser', () => {
  it('parses the Apply-column href (not the company href) + salary', async () => {
    const md = [
      '| Company | Position | Location | Salary | Posting | Age |',
      '|---|---|---|---|---|---|',
      '| <a href="https://careers.rivian.com"><strong>Rivian</strong></a> | Software Engineering Intern | Irvine, California | $51/hr | <a href="https://jobs.ashbyhq.com/rivianvw.tech/89feb2fe"><img src="x" width="70"/></a> | 24d |',
    ].join('\n')
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response(md, { status: 200 })) as typeof fetch
    try {
      const jobs = await fetchSpeedyApply('https://x/README.md', 'internship', 60)
      expect(jobs).toHaveLength(1)
      expect(jobs[0].company).toBe('Rivian')
      expect(jobs[0].apply_url).toBe('https://jobs.ashbyhq.com/rivianvw.tech/89feb2fe')
      expect(jobs[0].company_url).toBe('https://careers.rivian.com')
      expect(jobs[0].pay).toMatchObject({ min: 51, period: 'hourly' })
      expect(jobs[0].role_type).toBe('internship')
    } finally {
      globalThis.fetch = orig
    }
  })
})

/** In-memory records mock implementing the OwnerRecords slice. */
function makeRecords(): OwnerRecords & { rows: Map<string, Envelope<Record<string, unknown>>> } {
  const rows = new Map<string, Envelope<Record<string, unknown>>>()
  let n = 0
  return {
    rows,
    async query(collection) {
      return [...rows.values()].filter((r) => (r as { _c?: string })._c === collection)
    },
    async create(collection, data) {
      const recordId = `rec_${++n}`
      const env = { recordId, data, _c: collection } as Envelope<Record<string, unknown>> & { _c: string }
      rows.set(recordId, env)
      return { recordId, record: env }
    },
    async update(_collection, recordId, data) {
      const env = rows.get(recordId)
      if (env) env.data = { ...env.data, ...data }
      return { recordId, record: env }
    },
    async delete(_collection, recordId) {
      rows.delete(recordId)
      return { deleted: true }
    },
  }
}

describe('upsertJob cross-source dedupe + merge', () => {
  it('same canonical URL -> one row created, second merges (no dup) and adds pay', async () => {
    const records = makeRecords()
    const now = new Date().toISOString()
    const stats = emptyStats()
    const maps = await buildPoolMaps(records)

    const fromSimplify: NormalizedJob = {
      source: 'simplify',
      apply_url: 'https://jobs.ashbyhq.com/acme/abc-1?utm_source=x',
      title: 'Software Engineer Intern',
      company: 'Acme',
      sponsorship: 'offers',
      posted_date: Date.now(),
    }
    const fromSpeedy: NormalizedJob = {
      source: 'speedyapply',
      apply_url: 'https://jobs.ashbyhq.com/acme/abc-1/apply',
      title: 'Software Engineer Intern',
      company: 'Acme',
      pay: { min: 50, max: 50, currency: 'USD', period: 'hourly', source: 'speedyapply' },
      posted_date: Date.now(),
    }

    // invoke=null disables Haiku -> keyword tagging only (deterministic test).
    await upsertJob(records, maps, fromSimplify, null, now, stats)
    await upsertJob(records, maps, fromSpeedy, null, now, stats)

    const jobRows = (await records.query('job')) as Envelope<Record<string, unknown>>[]
    expect(jobRows).toHaveLength(1)
    expect(stats.created).toBe(1)
    expect(stats.merged).toBe(1)
    const row = jobRows[0].data as Record<string, unknown>
    expect(row.sources).toEqual(expect.arrayContaining(['simplify', 'speedyapply']))
    expect(row.pay).toMatchObject({ min: 50, period: 'hourly' }) // merged in from SpeedyApply
    expect(row.sponsorship).toBe('offers') // kept from Simplify
    expect((row.role_family as string[])).toContain('swe-general')
    expect(row.tagged_by).toBe('keyword')
  })
})
