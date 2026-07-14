/**
 * The brief's in-flight-search state.
 *
 * These lock down the first-run bug: for the minutes the match Job spent reading,
 * the brief reported a finished, empty search. It inferred "a run completed" from
 * "a verdict row exists", and the matcher writes rejections as it goes, so the
 * first batch of `no` verdicts flipped the app into "I read N postings, none are
 * a strong enough fit" with most of them still unread. The run's own status is
 * now the only thing that decides.
 */
import { describe, it, expect } from 'vitest'
import type { JobView } from 'deepspace'
import {
  deriveSearchState,
  findLiveMatchJob,
  searchLogLines,
  IDLE_SEARCH,
} from '../src/components/brief/search'
import { encodeMatchProgress, parseMatchProgress, type MatchPayload } from '../src/server/match/types'

type MatchJob = JobView<MatchPayload, unknown>

function job(over: Partial<MatchJob> = {}): MatchJob {
  return {
    id: 'j1',
    type: 'match-user',
    status: 'running',
    payload: { userId: 'u1', mode: 'full' },
    attempts: 1,
    maxAttempts: 1,
    enqueuedAt: '2026-07-14T00:00:00.000Z',
    ...over,
  } as MatchJob
}

describe('match progress codec', () => {
  it('round-trips the run counters', () => {
    const msg = encodeMatchProgress({ total: 80, read: 30, kept: 3 })
    expect(parseMatchProgress(msg)).toEqual({ total: 80, read: 30, kept: 3 })
  })

  it('returns null for absent or malformed messages rather than inventing numbers', () => {
    expect(parseMatchProgress(undefined)).toBeNull()
    expect(parseMatchProgress('')).toBeNull()
    expect(parseMatchProgress('match 30/80: kept 3')).toBeNull() // the old debug string
    expect(parseMatchProgress('{"total":80}')).toBeNull()
    expect(parseMatchProgress('{"total":"80","read":1,"kept":0}')).toBeNull()
  })
})

describe('findLiveMatchJob', () => {
  it('finds the caller own running run', () => {
    expect(findLiveMatchJob([job()], 'u1')?.id).toBe('j1')
    expect(findLiveMatchJob([job({ status: 'queued' })], 'u1')?.id).toBe('j1')
  })

  it('ignores runs belonging to other users (the JobRoom is app-wide)', () => {
    const other = job({ id: 'j2', payload: { userId: 'u2', mode: 'full' }, enqueuedBy: 'u2' })
    expect(findLiveMatchJob([other], 'u1')).toBeUndefined()
  })

  it('ignores finished runs and other job types', () => {
    expect(findLiveMatchJob([job({ status: 'succeeded' })], 'u1')).toBeUndefined()
    expect(findLiveMatchJob([job({ status: 'failed' })], 'u1')).toBeUndefined()
    expect(findLiveMatchJob([job({ type: 'tailor' })], 'u1')).toBeUndefined()
  })

  it('has no live run when signed out', () => {
    expect(findLiveMatchJob([job()], null)).toBeUndefined()
  })
})

describe('deriveSearchState', () => {
  it('is idle when nothing is running', () => {
    expect(deriveSearchState({ job: undefined, kicking: false })).toEqual(IDLE_SEARCH)
  })

  it('is active the moment we enqueue, before the room reports the job', () => {
    // The gap that used to let the brief blink back to an empty state.
    const s = deriveSearchState({ job: undefined, kicking: true })
    expect(s.active).toBe(true)
    expect(s.phase).toBe('gathering')
    expect(s.read).toBe(0)
  })

  it('stays active for a queued run and reports no counters yet', () => {
    const s = deriveSearchState({ job: job({ status: 'queued' }), kicking: false })
    expect(s.active).toBe(true)
    expect(s.phase).toBe('gathering')
    expect(s.total).toBe(0)
  })

  it('reports the run real counters while reading', () => {
    const s = deriveSearchState({
      job: job({ progress: 0.375, progressMessage: encodeMatchProgress({ total: 80, read: 30, kept: 3 }) }),
      kicking: false,
    })
    expect(s.active).toBe(true)
    expect(s.phase).toBe('reading')
    expect(s.progress).toBeCloseTo(0.375)
    expect(s).toMatchObject({ total: 80, read: 30, kept: 3 })
  })

  it('THE BUG: a batch of rejections mid-run is still an ACTIVE search, not an empty result', () => {
    // 10 of 80 read, every one rejected. The old code saw a verdict row, decided
    // the run had finished, and announced "none are a strong enough fit".
    const s = deriveSearchState({
      job: job({ progress: 0.125, progressMessage: encodeMatchProgress({ total: 80, read: 10, kept: 0 }) }),
      kicking: false,
    })
    expect(s.active).toBe(true)
    expect(s.kept).toBe(0)
    expect(s.phase).toBe('reading')
  })

  it('moves to writing once every posting is read', () => {
    const s = deriveSearchState({
      job: job({ progress: 1, progressMessage: encodeMatchProgress({ total: 80, read: 80, kept: 6 }) }),
      kicking: false,
    })
    expect(s.phase).toBe('writing')
    expect(s.active).toBe(true)
  })

  it('goes inactive once the run reaches a terminal state', () => {
    for (const status of ['succeeded', 'failed', 'canceled'] as const) {
      expect(deriveSearchState({ job: job({ status }), kicking: false }).active).toBe(false)
    }
  })

  it('surfaces a failed run without claiming a search is running', () => {
    const s = deriveSearchState({ job: undefined, kicking: false, failed: true })
    expect(s.active).toBe(false)
    expect(s.failed).toBe(true)
  })

  it('clamps a progress value outside 0..1', () => {
    expect(deriveSearchState({ job: job({ progress: 1.4 }), kicking: false }).progress).toBe(1)
    expect(deriveSearchState({ job: job({ progress: -2 }), kicking: false }).progress).toBe(0)
  })
})

describe('searchLogLines', () => {
  it('only states numbers the run actually reported', () => {
    const early = searchLogLines({ ...IDLE_SEARCH, active: true, phase: 'gathering' })
    expect(early).toEqual(['Gathering the postings in your space.'])
    expect(early.join(' ')).not.toMatch(/\d/)
  })

  it('reads back the live counters', () => {
    const lines = searchLogLines({
      active: true,
      phase: 'reading',
      progress: 0.375,
      total: 80,
      read: 30,
      kept: 3,
      failed: false,
    })
    expect(lines).toContain('80 postings match the roles you want.')
    expect(lines).toContain('Read 30 of 80.')
    expect(lines).toContain('3 worth your time so far.')
  })

  it('stays within the visible window', () => {
    const lines = searchLogLines({
      active: true,
      phase: 'writing',
      progress: 1,
      total: 80,
      read: 80,
      kept: 6,
      failed: false,
    })
    expect(lines.length).toBeLessThanOrEqual(5)
    expect(lines[lines.length - 1]).toBe('Writing up your brief.')
  })
})
