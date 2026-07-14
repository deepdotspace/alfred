/**
 * The brief's view of an in-flight match run.
 *
 * Before this existed the brief guessed: `recompute()` flipped a local flag and a
 * 1500ms setTimeout flipped it back, while the real match Job read 80 postings
 * through Haiku across DO alarm ticks for minutes. So ~1.5s in, the UI believed
 * the search was over. Worse, the greeting treated "any verdict row exists" as
 * "a run completed" -- and the matcher writes rejections as it goes, so the first
 * batch of `no` verdicts made the app announce "I read N postings, none are a
 * strong enough fit" while 70 of 80 were still unread.
 *
 * The Job already knows all of this. These helpers read it: `findLiveMatchJob`
 * recovers the user's running job from the JobRoom (so a reload rejoins the same
 * run instead of starting a second, owner-billed one), and `deriveSearchState`
 * turns the Job's real status + counters into what the UI renders. Every number
 * here is measured. Nothing is simulated.
 */
import type { JobView } from 'deepspace'
import { parseMatchProgress, type MatchPayload } from '../../server/match/types'

/** Which real stage of the run we are in. Derived from Job status + progress. */
export type SearchPhase = 'gathering' | 'reading' | 'writing'

export interface SearchState {
  /** A match run for this user is in flight right now. Survives a page reload. */
  active: boolean
  phase: SearchPhase
  /** Real 0..1 completion reported by the Job. */
  progress: number
  /** Hard-filter survivors this run will read. 0 until the first tick reports. */
  total: number
  /** Postings read so far. */
  read: number
  /** Postings kept for the feed so far. */
  kept: number
  /** The run we started this session ended badly. */
  failed: boolean
}

export const IDLE_SEARCH: SearchState = {
  active: false,
  phase: 'gathering',
  progress: 0,
  total: 0,
  read: 0,
  kept: 0,
  failed: false,
}

type MatchJobView = JobView<MatchPayload, unknown>

function isRunning(job: MatchJobView | undefined): boolean {
  return !!job && (job.status === 'queued' || job.status === 'running')
}

/**
 * The caller's own in-flight `match-user` job, if any.
 *
 * The JobRoom is app-wide (`app:alfred`), so it carries every user's jobs --
 * match strictly on the caller's id or a stranger's run would drive this user's
 * brief.
 */
export function findLiveMatchJob(
  jobs: readonly MatchJobView[],
  userId: string | null,
): MatchJobView | undefined {
  if (!userId) return undefined
  return jobs.find(
    (j) =>
      j.type === 'match-user' &&
      isRunning(j) &&
      (j.payload?.userId === userId || j.enqueuedBy === userId),
  )
}

export function deriveSearchState({
  job,
  kicking,
  failed = false,
}: {
  /** The user's live match job, from findLiveMatchJob (or the one we just started). */
  job: MatchJobView | undefined
  /** We have POSTed the action but the room has not reported the job yet. */
  kicking: boolean
  failed?: boolean
}): SearchState {
  const running = isRunning(job)
  if (!running && !kicking) return { ...IDLE_SEARCH, failed }

  const counters = parseMatchProgress(job?.progressMessage)
  const progress = typeof job?.progress === 'number' ? Math.max(0, Math.min(1, job.progress)) : 0

  // 'gathering' = enqueued, or running but no tick has reported counters yet
  // (the hard filter is still choosing which postings to read).
  // 'writing'   = every posting is read; the last verdicts are landing.
  const phase: SearchPhase =
    !job || job.status === 'queued' || !counters ? 'gathering' : progress >= 1 ? 'writing' : 'reading'

  return {
    active: true,
    phase,
    progress,
    total: counters?.total ?? 0,
    read: counters?.read ?? 0,
    kept: counters?.kept ?? 0,
    failed: false,
  }
}

/**
 * The rolling log. Every line restates something the run actually reported, so
 * the log is a live readout rather than a scripted performance.
 */
export function searchLogLines(s: SearchState): string[] {
  const lines: string[] = ['Gathering the postings in your space.']
  if (s.total > 0) {
    lines.push(`${s.total.toLocaleString()} ${s.total === 1 ? 'posting matches' : 'postings match'} the roles you want.`)
    lines.push(`Read ${s.read.toLocaleString()} of ${s.total.toLocaleString()}.`)
  }
  if (s.kept > 0) {
    lines.push(`${s.kept.toLocaleString()} worth your time so far.`)
  }
  if (s.phase === 'writing') {
    lines.push('Writing up your brief.')
  }
  return lines.slice(-5)
}

export const PHASE_LABEL: Record<SearchPhase, string> = {
  gathering: 'Gathering the postings in your space',
  reading: 'Reading every posting',
  writing: 'Writing up your brief',
}
