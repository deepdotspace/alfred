/**
 * Ingest-internal types: the normalized partial job each source adapter emits,
 * the run stats, the chunked-Job state machine cursor, and a minimal records
 * surface so the pipeline is decoupled from the SDK (unit-testable).
 *
 * See docs/specs/INGEST-PLAN.md sections 2-4.
 */
import type {
  JobSource,
  Ats,
  Workplace,
  RoleType,
  Sponsorship,
  PayInfo,
  JobLocation,
} from '../../types'

/**
 * The common adapter output. Every source maps its payload onto this shape;
 * the pipeline then canonicalizes, dedupes/merges, tags, and upserts it onto
 * the real `JobData` row. `posted_date` is normalized to epoch MILLISECONDS
 * here regardless of the source's native unit (Simplify=seconds, Lever=ms).
 */
export interface NormalizedJob {
  source: JobSource
  /** Raw posting/apply URL as the source gave it (canonicalized downstream). */
  apply_url: string
  title: string
  company: string
  company_url?: string | null
  company_logo_url?: string | null
  locations?: JobLocation[]
  workplace?: Workplace
  role_type?: RoleType
  term?: string | null
  pay?: PayInfo | null
  sponsorship?: Sponsorship
  degrees?: string[] | null
  description_text?: string | null
  /** epoch ms; null when the source gives no date at all. */
  posted_date: number | null
  /** true when derived (Greenhouse updated_at proxy, SpeedyApply "Nd ago"). */
  posted_date_approx?: boolean
  active?: boolean | null
}

/** Run-level counters reported back as the Job result + mirrored to `meta`. */
export interface IngestStats {
  /** Total normalized jobs emitted by all adapters this run. */
  raw: number
  /** New pool rows created this run. */
  created: number
  /** Upserts that hit an existing row (the dedupe + freshness path). */
  merged: number
  /** Rows soft-expired this run. */
  expired: number
  /** Raw count per source. */
  bySource: Record<string, number>
  /** How newly-tagged jobs were tagged. */
  byTagger: { keyword: number; haiku: number }
  /** Slugs added to the ats_slug universe this run. */
  slugsSeeded: number
  /** Non-fatal adapter/source errors (source: message). */
  errors: string[]
}

export function emptyStats(): IngestStats {
  return {
    raw: 0,
    created: 0,
    merged: 0,
    expired: 0,
    bySource: {},
    byTagger: { keyword: 0, haiku: 0 },
    slugsSeeded: 0,
    errors: [],
  }
}

export type IngestMode = 'backfill' | 'delta'
export type IngestPhase = 'feeds' | 'ats' | 'integrations' | 'expire' | 'done'

/** Payload for the `ingest-pool` Job (and the cron that enqueues it). */
export interface IngestPayload {
  mode: IngestMode
  windowDays: number
  /** Cap the ATS sweep (backfill). Omit for the full ~1,541-slug universe. */
  maxSlugs?: number
  /** Cap firecrawl/exa nodes per run (cost guard). Default a small set. */
  maxNodes?: number
  /** Cap jobs kept per feed file. Omit for all. Bounds a first backfill. */
  maxPerFeed?: number
  /** Skip the paid firecrawl/exa phase entirely (free-only run). */
  skipIntegrations?: boolean
}

/**
 * The serializable cursor carried across alarm ticks via ctx.continue. Kept
 * small: the only large member is `slugs` (~30 KB of "ats|slug" strings derived
 * once from the feeds), which is well within a DO state row.
 */
export interface IngestState {
  mode: IngestMode
  windowDays: number
  maxSlugs: number | null
  maxNodes: number
  maxPerFeed: number | null
  skipIntegrations: boolean
  phase: IngestPhase
  /** index into the FEEDS list (0..3). */
  feedIdx: number
  /**
   * The current feed's normalized jobs, fetched ONCE then drained in
   * write-budget chunks across ticks (so the 11 MB Simplify file is never
   * re-fetched per tick). Simplify rows carry no description, so this stays
   * small enough for a DO state row.
   */
  feedBuffer: NormalizedJob[]
  /** the derived ATS universe as "ats|slug" strings (deduped). */
  slugs: string[]
  /** cursor into `slugs` for the ATS sweep. */
  slugIdx: number
  /** active taxonomy node ids for the firecrawl/exa phase. */
  nodes: string[]
  /** cursor into `nodes`. */
  nodeIdx: number
  /** cursor into the pool for the chunked soft-expiry pass. */
  expireIdx: number
  stats: IngestStats
  /** start-of-run ISO, used as first_ingested_at / last_seen_at base. */
  startedAt: string
}

/** A DO record envelope as returned by the cron-context records helpers. */
export interface Envelope<T> {
  recordId: string
  data: T
  createdBy?: string
  createdAt?: string | number
  updatedAt?: string | number
}

/**
 * Minimal records surface (the slice of the cron/job context we use). Matches
 * `buildCronContext(...).records`: query returns the already-unwrapped array.
 */
export interface OwnerRecords {
  query(collection: string, opts?: { where?: Record<string, unknown>; limit?: number }): Promise<unknown[]>
  create(collection: string, data: Record<string, unknown>): Promise<unknown>
  update(collection: string, recordId: string, data: Record<string, unknown>): Promise<unknown>
  delete(collection: string, recordId: string): Promise<unknown>
}
