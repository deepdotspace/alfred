/**
 * P5 digest unit tests -- the pure logic: cadence/idempotency gate, the
 * quality-bar selection, and the no-em-dash email backstop. No SDK, no network.
 */
import { describe, it, expect } from 'vitest'
import { isDigestDue, pickItems } from '../src/server/digest/select'
import { digestSubject, stripEmDashes } from '../src/server/digest/email'
import { isDeadStatus } from '../src/server/digest/verify-links'
import { DIGEST_SCORE_FLOOR, DIGEST_MAX_ITEMS } from '../src/server/digest/constants'
import type { JobData, MatchData } from '../src/types'
import type { Envelope } from '../src/server/digest/types'

const DAY = 86_400_000

function job(over: Partial<JobData> = {}): JobData {
  return {
    canonical_id: 'c', sources: [], apply_url: 'https://x.test/a', ats: 'greenhouse',
    title: 'SWE Intern', company: 'Acme', company_logo_url: null, company_url: null,
    locations: [], workplace: 'remote', role_family: ['swe-general'], role_type: 'internship',
    term: null, pay: null, sponsorship: 'unknown', degrees: null, min_yoe: null, seniority: 'intern',
    key_skills: null, description_text: null, posted_date: null, first_ingested_at: '', last_seen_at: '',
    active: true, dedup_key: 'd', tagged_by: 'keyword', ...over,
  }
}
function match(jobId: string, over: Partial<MatchData> = {}): MatchData {
  return {
    user_id: 'u', job_id: jobId, qualify: 'yes', score: 80, reason: 'good fit', matched: [], missing: [],
    timing: 'good', created_at: '2026-06-28T00:00:00.000Z', seen: false, ...over,
  }
}
function env<T>(recordId: string, data: T): Envelope<T> {
  return { recordId, data }
}

describe('isDigestDue', () => {
  const now = Date.parse('2026-06-29T13:00:00.000Z') // ~9am ET

  it('is due when never sent', () => {
    expect(isDigestDue('daily', null, now)).toBe(true)
    expect(isDigestDue('weekly', null, now)).toBe(true)
  })
  it('daily: not due same ET day, due next ET day', () => {
    expect(isDigestDue('daily', '2026-06-29T08:00:00.000Z', now)).toBe(false)
    expect(isDigestDue('daily', '2026-06-28T08:00:00.000Z', now)).toBe(true)
  })
  it('weekly: due only after 7 days', () => {
    expect(isDigestDue('weekly', new Date(now - 3 * DAY).toISOString(), now)).toBe(false)
    expect(isDigestDue('weekly', new Date(now - 8 * DAY).toISOString(), now)).toBe(true)
  })
})

describe('pickItems (quality bar + novelty)', () => {
  const pool = new Map<string, JobData>([
    ['j1', job()], ['j2', job()], ['j3', job()], ['j4', job({ active: false })],
  ])

  it('keeps qualify yes/stretch above the floor, drops below + no + inactive', () => {
    const matches = [
      env('m1', match('j1', { qualify: 'yes', score: 85 })),
      env('m2', match('j2', { qualify: 'stretch', score: DIGEST_SCORE_FLOOR })),
      env('m3', match('j3', { qualify: 'yes', score: DIGEST_SCORE_FLOOR - 1 })), // below floor
      env('m4', match('j4', { qualify: 'yes', score: 90 })), // inactive job
      env('m5', match('j1', { qualify: 'no', score: 99 })), // no -> never
    ]
    const items = pickItems(matches, pool, new Set(), NaN)
    expect(items.map((i) => i.jobId).sort()).toEqual(['j1', 'j2'])
  })

  it('orders yes before stretch, then by score', () => {
    const matches = [
      env('a', match('j2', { qualify: 'stretch', score: 68 })),
      env('b', match('j1', { qualify: 'yes', score: 72 })),
      env('c', match('j3', { qualify: 'yes', score: 90 })),
    ]
    const items = pickItems(matches, pool, new Set(), NaN)
    expect(items.map((i) => i.jobId)).toEqual(['j3', 'j1', 'j2'])
  })

  it('excludes jobs already on the tracker', () => {
    const matches = [env('a', match('j1', { score: 88 })), env('b', match('j2', { score: 80 }))]
    const items = pickItems(matches, pool, new Set(['j1']), NaN)
    expect(items.map((i) => i.jobId)).toEqual(['j2'])
  })

  it('novelty: only matches created after the last digest', () => {
    const since = Date.parse('2026-06-28T12:00:00.000Z')
    const matches = [
      env('old', match('j1', { created_at: '2026-06-28T06:00:00.000Z', score: 90 })), // before
      env('new', match('j2', { created_at: '2026-06-28T18:00:00.000Z', score: 80 })), // after
    ]
    const items = pickItems(matches, pool, new Set(), since)
    expect(items.map((i) => i.jobId)).toEqual(['j2'])
  })

  it('caps at DIGEST_MAX_ITEMS', () => {
    const big = new Map<string, JobData>()
    const matches: Envelope<MatchData>[] = []
    for (let i = 0; i < DIGEST_MAX_ITEMS + 8; i++) {
      big.set(`k${i}`, job())
      matches.push(env(`m${i}`, match(`k${i}`, { score: 70 + (i % 20) })))
    }
    expect(pickItems(matches, big, new Set(), NaN).length).toBe(DIGEST_MAX_ITEMS)
  })
})

describe('isDeadStatus (link verify keeps transient 5xx)', () => {
  it('drops only the genuinely-gone statuses', () => {
    expect(isDeadStatus(404)).toBe(true)
    expect(isDeadStatus(410)).toBe(true)
    expect(isDeadStatus(451)).toBe(true)
  })
  it('keeps transient 5xx so a briefly-erroring ATS does not permanently exclude an alive job', () => {
    expect(isDeadStatus(500)).toBe(false)
    expect(isDeadStatus(502)).toBe(false)
    expect(isDeadStatus(503)).toBe(false)
  })
  it('keeps ok / anti-bot statuses', () => {
    expect(isDeadStatus(200)).toBe(false)
    expect(isDeadStatus(401)).toBe(false)
    expect(isDeadStatus(403)).toBe(false)
    expect(isDeadStatus(429)).toBe(false)
  })
})

describe('email copy backstop', () => {
  it('stripEmDashes removes em dashes', () => {
    expect(stripEmDashes('a — b')).not.toMatch(/—/)
    expect(stripEmDashes('a — b')).toBe('a -- b')
  })
  it('subject has no em dash and pluralizes', () => {
    expect(digestSubject(1, 'daily')).toBe('Your morning brief: 1 role worth your time')
    expect(digestSubject(3, 'weekly')).toBe('Your weekly brief: 3 roles worth your time')
    expect(digestSubject(5, 'daily')).not.toMatch(/—/)
  })
})
