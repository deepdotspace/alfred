/**
 * Tailoring-pipeline internal types.
 *
 * The pipeline runs server-side only (a background tailor-doc Job in OWNER
 * context, plus a dev preview action). It reuses the ingest/match minimal
 * records surface so it stays decoupled from the SDK and unit-testable.
 *
 * See docs/specs/TAILORING-SPIKE.md (the proven generate -> verify -> regen ->
 * re-verify -> render loop) and docs/specs/resume-rules.md.
 */
import type {
  CoverDocContent,
  ResumeDocContent,
  ProfileData,
} from '../../types'
import type { IntegrationInvoke } from '../integrations'
import type { Envelope, OwnerRecords } from '../ingest/types'

export type { Envelope, OwnerRecords } from '../ingest/types'

/** Why the tailor Job is running. */
export type TailorMode = 'generate' | 'refine'

/** Payload for the `tailor-doc` Job (one user x job per run). */
export interface TailorPayload {
  userId: string
  /** The job's recordId (the generated_doc.job_id / match.job_id key). */
  jobId: string
  mode: TailorMode
  /** Free-text "Refine with Alfred" note (refine mode only). */
  refineNote?: string
}

/** A single verifier finding against a generated claim. */
export interface VerifyFinding {
  /** The exact generated text the verifier judged. */
  claim: string
  verdict: 'supported' | 'embellished' | 'fabricated'
  /** Why it was flagged (only meaningful for embellished/fabricated). */
  note: string
  /** An honest rewrite the verifier suggests (constraint for regeneration). */
  fix: string
}

/** The verifier's report for one document. */
export interface VerifyReport {
  supported: number
  embellished: number
  fabricated: number
  /** Only the flagged (embellished/fabricated) findings. */
  flagged: VerifyFinding[]
  /**
   * True when the verifier did NOT return a usable result -- a call/parse
   * failure, or an absent/non-array/empty `findings` response that cannot be
   * trusted as a clean pass -- even after one retry. The pipeline must fail
   * closed on this: never stamp the document `clean`/`verified`.
   */
  verifierFailed?: boolean
}

/** One verify round captured for the proof (first pass dirty -> clean re-verify). */
export interface VerifyRound {
  round: number
  report: VerifyReport
}

/** The whole resume sub-pipeline result. */
export interface ResumeResult {
  content: ResumeDocContent
  gaps: string[]
  rounds: VerifyRound[]
  /** True once a verify pass returned zero flagged claims. */
  clean: boolean
}

/** The whole cover sub-pipeline result (null when gated out). */
export interface CoverResult {
  content: CoverDocContent
  rounds: VerifyRound[]
  clean: boolean
}

/** The records + integration surface a tailor run needs. */
export interface TailorCtx {
  records: OwnerRecords
  /** null only in pure unit tests (generation is then skipped / mocked). */
  invoke: IntegrationInvoke | null
  signal?: AbortSignal
  /** Optional progress callback (mirrors the Job's cycling status). */
  onProgress?: (fraction: number, message: string) => void
}

/** A compiled PDF + its verified page count. */
export interface RenderResult {
  pdfBase64: string
  pages: number
  /** The LaTeX actually compiled (after any one-page trim). */
  latex: string
  /** The content actually rendered (after any one-page trim). */
  content: ResumeDocContent
}

/** What the dev `tailor-preview` action returns (no writes) -- the proof. */
export interface TailorPreviewResult {
  job: { title: string; company: string }
  resume: ResumeResult
  cover: CoverResult | null
  coverGated: boolean
  render: { pages: number; pdfBytes: number; onePage: boolean }
}

/** What the tailor-doc Job returns as job.result (compact; content is in the row). */
export interface TailorJobResult {
  resumeDocId: string
  coverDocId: string | null
  coverGated: boolean
  gaps: string[]
  pages: number
  onePage: boolean
  verified: boolean
  /** A short proof summary for observability/logging. */
  verifySummary: { resumeFirstFlagged: number; resumeClean: boolean; coverFirstFlagged: number; coverClean: boolean }
}

/** Voice/sample presence check (DATA-MODEL decision 9 gating). */
export function hasWritingSample(profile: ProfileData): boolean {
  const v = profile.voice
  if (!v) return false
  if (v.writing_references?.length) return true
  if (v.writing_sample?.trim()) return true
  return false
}
