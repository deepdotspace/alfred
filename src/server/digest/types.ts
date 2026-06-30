/**
 * Digest-pipeline internal types.
 *
 * The digest runs server-side only, in OWNER context (the cron's runTask, plus a
 * dev-gated action for verification). It reuses the same minimal records +
 * integration surfaces as ingest/match so it stays decoupled and testable.
 */
import type { JobData, MatchData } from '../../types'
import type { IntegrationInvoke } from '../integrations'
import type { Envelope, OwnerRecords } from '../ingest/types'

export type { Envelope, OwnerRecords } from '../ingest/types'

/** One selected digest line: a qualified match joined to its pool job. */
export interface DigestItem {
  jobId: string
  match: MatchData
  job: JobData
}

/** The records + integration surface a digest run needs. */
export interface DigestCtx {
  records: OwnerRecords
  /** null in pure unit tests (no live-verify / no send). */
  invoke: IntegrationInvoke | null
}

/** Options for a single user's digest run. */
export interface DigestRunOpts {
  /** Override the recipient (verification: send to the owner's verified addr). */
  toOverride?: string
  /** Compose + select but do NOT send (and do not advance the cursor). */
  dryRun?: boolean
  /** Ignore the cadence idempotency gate (verification only). */
  force?: boolean
  /** Skip the live-verify HEAD/GET pass (unit tests / offline). */
  skipVerify?: boolean
  /** Dev/verification only: return the composed HTML in the result. */
  includeHtml?: boolean
}

/** Why a user's digest run did what it did (returned to the dev action / logs). */
export type DigestOutcome =
  | 'sent'
  | 'dry-run'
  | 'skipped-not-due'
  | 'skipped-email-disabled'
  | 'skipped-no-profile'
  | 'skipped-no-email-address'
  | 'skipped-empty'
  | 'send-failed'

/** Result of one user's digest run. */
export interface DigestRunResult {
  userId: string
  outcome: DigestOutcome
  recipient: string | null
  cadence: string
  /** Items selected after the quality bar (before live-verify). */
  selected: number
  /** Items that survived live-verify (what the email actually contains). */
  delivered: number
  /** apply_urls dropped by live-verify. */
  droppedLinks: number
  subject: string | null
  /** Length of the composed HTML (proof it composed). */
  htmlLength: number
  /** The raw emailSend result, incl. the test-mode `message` if present. */
  sendResult: Record<string, unknown> | null
  /** Compact echo of the delivered items (for the taste-test report). */
  items: Array<{ company: string; title: string; qualify: string; score: number; reason: string }>
  /** The composed HTML, ONLY when opts.includeHtml (dev/verification). */
  html?: string
  error?: string
}

/** Result of a full cron pass over all eligible users. */
export interface DigestCronResult {
  scanned: number
  processed: number
  sent: number
  results: DigestRunResult[]
}
