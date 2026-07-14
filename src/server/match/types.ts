/**
 * Match-pipeline internal types.
 *
 * The matcher runs server-side only (a per-user fan-out background Job in OWNER
 * context, plus a dev preview action). It reuses the ingest pipeline's minimal
 * records surface so it stays decoupled from the SDK and unit-testable.
 *
 * See docs/specs/V1-PLAN.md section 9 + docs/specs/WORKFLOW.md.
 */
import type { Qualify, Timing } from '../../types'
import type { IntegrationInvoke } from '../integrations'
import type { Envelope, OwnerRecords } from '../ingest/types'

export type { Envelope, OwnerRecords } from '../ingest/types'

/** Why the match Job is running for this user. */
export type MatchMode = 'full' | 'incremental'

/** Payload for the `match-user` Job (one user per job; cron fans out). */
export interface MatchPayload {
  userId: string
  /**
   * full        = re-score every hard-filtered job and overwrite verdicts
   *               (profile change / on-demand recompute).
   * incremental = only score hard-filtered jobs the user has no verdict for yet
   *               (cheap; the daily cron cadence + new pool jobs).
   */
  mode: MatchMode
}

/**
 * Live progress the match Job reports on every alarm tick.
 *
 * The Job's `progressMessage` is the SDK's only per-tick string channel, so the
 * run's real counters are encoded into it and parsed back by the brief. Every
 * number the "reading the market" state shows is therefore measured, never
 * simulated: the brief must not invent a count it cannot stand behind.
 */
export interface MatchProgress {
  /** Hard-filter survivors this run will score. */
  total: number
  /** Postings scored so far. */
  read: number
  /** Verdicts kept for the feed so far (qualify yes|stretch). */
  kept: number
}

export function encodeMatchProgress(p: MatchProgress): string {
  return JSON.stringify(p)
}

/** Parse a Job progressMessage back into counters. Null when absent or malformed. */
export function parseMatchProgress(message: string | undefined | null): MatchProgress | null {
  if (!message) return null
  try {
    const p = JSON.parse(message) as Partial<MatchProgress>
    if (typeof p.total !== 'number' || typeof p.read !== 'number' || typeof p.kept !== 'number') return null
    if (!Number.isFinite(p.total) || !Number.isFinite(p.read) || !Number.isFinite(p.kept)) return null
    return { total: p.total, read: p.read, kept: p.kept }
  } catch {
    return null
  }
}

/** Run counters reported as the Job result. */
export interface MatchStats {
  /** Active pool jobs considered. */
  poolSize: number
  /** Jobs that passed the hard filters. */
  survived: number
  /** Jobs actually sent to Haiku this run. */
  scored: number
  /** Verdicts written (create + update). */
  written: number
  created: number
  updated: number
  /** Verdicts in the feed (qualify yes|stretch). */
  kept: number
  /** Verdicts dropped from the feed (qualify no). */
  dropped: number
  errors: string[]
}

export function emptyMatchStats(): MatchStats {
  return { poolSize: 0, survived: 0, scored: 0, written: 0, created: 0, updated: 0, kept: 0, dropped: 0, errors: [] }
}

/**
 * The serializable cursor carried across alarm ticks. The hard-filtered,
 * ordered list of job recordIds is computed ONCE on the first tick (so the
 * candidate set is stable even if ingest mutates the pool mid-run), then the
 * batches are drained across ticks.
 */
export interface MatchState {
  userId: string
  mode: MatchMode
  /** Hard-filtered job recordIds to score, best-first. */
  jobIds: string[]
  /** Cursor into jobIds. */
  cursor: number
  stats: MatchStats
  startedAt: string
}

/** One Haiku verdict for a (user, job) pair. `job_id` is the job's recordId. */
export interface ScoredVerdict {
  job_id: string
  qualify: Qualify
  score: number
  reason: string
  matched: string[]
  missing: string[]
  timing: Timing
}

/** The records + integration surface a match run needs. */
export interface MatchCtx {
  records: OwnerRecords
  /** null in pure unit tests (scoring is then skipped / mocked). */
  invoke: IntegrationInvoke | null
  signal?: AbortSignal
}

/** A rejected job, for the dev preview's "filters reject mismatches" proof. */
export interface RejectedExample {
  title: string
  company: string
  reason: string
}

/** What the dev `match-preview` action returns (no writes). */
export interface PreviewResult {
  poolSize: number
  survived: number
  scored: number
  rejectedSamples: RejectedExample[]
  verdicts: ScoredVerdict[]
  /** Echo of the resolved job title/company so the report can name them. */
  jobs: Record<string, { title: string; company: string }>
}
