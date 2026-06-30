/**
 * The honest tailoring loop (TAILORING-SPIKE, proven live):
 *   GENERATE (Sonnet, grounded) -> VERIFY (Haiku skeptic) -> if flagged, REGEN
 *   with the findings as hard constraints -> RE-VERIFY -> repeat until clean
 *   (or the round cap). Each round is captured so the proof can show the
 *   first-pass embellishments and the clean re-verify.
 *
 * Rendering (LaTeX -> PDF) and one-page enforcement live in render.ts; this
 * module owns only the content + honesty loop.
 */
import type { CoverDocContent, JobData, ProfileData, ResumeDocContent } from '../../types'
import type { IntegrationInvoke } from '../integrations'
import {
  assembleCover,
  assembleResume,
  generateCoverParagraphs,
  generateResumeRaw,
  refineResumeRaw,
  regenerateCoverParagraphs,
  regenerateResumeRaw,
} from './generate'
import { flaggedToConstraints, verifyCover, verifyResume } from './verify'
import { applyCoverFixes, applyResumeFixes } from './fixes'
import type { CoverResult, ResumeResult, VerifyRound } from './types'

/** Max regen rounds after the first pass (so up to MAX_ROUNDS+1 total). */
const MAX_ROUNDS = 3

/** Serialize only the tailored claims (not the deterministic header) for the verifier. */
function resumeForVerify(content: ResumeDocContent): string {
  return JSON.stringify(
    {
      role: content.role,
      summary: content.summary,
      experience: content.experience.map((x) => ({ org: x.org, title: x.title, bullets: x.bullets })),
      projects: content.projects.map((p) => ({ name: p.name, description: p.description, bullets: p.bullets })),
      skills: content.skills,
    },
    null,
    1,
  )
}

export interface ResumePipelineOpts {
  mode: 'generate' | 'refine'
  /** Refine note (refine mode). */
  note?: string
  /** Previous content JSON (refine mode) so the model improves rather than restarts. */
  previousJson?: string
}

export async function runResumePipeline(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
  profile: ProfileData,
  job: JobData,
  opts: ResumePipelineOpts,
): Promise<ResumeResult> {
  const rounds: VerifyRound[] = []

  let raw =
    opts.mode === 'refine'
      ? await refineResumeRaw(invoke, masterContext, jobContext, opts.previousJson ?? '{}', opts.note ?? '')
      : await generateResumeRaw(invoke, masterContext, jobContext)
  let { content, gaps } = assembleResume(raw, profile, job)

  let report = await verifyResume(invoke, masterContext, resumeForVerify(content))
  rounds.push({ round: 1, report })

  let round = 1
  while (report.flagged.length > 0 && round <= MAX_ROUNDS) {
    raw = await regenerateResumeRaw(
      invoke,
      masterContext,
      jobContext,
      resumeForVerify(content),
      flaggedToConstraints(report),
    )
    const next = assembleResume(raw, profile, job)
    content = next.content
    gaps = next.gaps.length ? next.gaps : gaps
    report = await verifyResume(invoke, masterContext, resumeForVerify(content))
    round++
    rounds.push({ round, report })
  }

  // Deterministic honesty backstop: if the loop did not fully converge, apply the
  // verifier's own honest fixes so the shipped resume contains no flagged claim.
  if (report.flagged.length > 0) {
    content = applyResumeFixes(content, report.flagged)
  }

  return { content, gaps, rounds, clean: true }
}

export interface CoverPipelineOpts {
  note?: string
  /** Voice sample (already concatenated) for tone matching. */
  voiceSample: string
  /** Gaps surfaced by the resume pipeline, so the letter speaks to them honestly. */
  gaps: string[]
}

export async function runCoverPipeline(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
  profile: ProfileData,
  job: JobData,
  opts: CoverPipelineOpts,
): Promise<CoverResult> {
  const rounds: VerifyRound[] = []

  let paragraphs = await generateCoverParagraphs(invoke, masterContext, jobContext, opts.voiceSample, opts.gaps, opts.note)
  let report = await verifyCover(invoke, masterContext, JSON.stringify({ paragraphs }, null, 1))
  rounds.push({ round: 1, report })

  let round = 1
  while (report.flagged.length > 0 && round <= MAX_ROUNDS) {
    paragraphs = await regenerateCoverParagraphs(
      invoke,
      masterContext,
      opts.voiceSample,
      JSON.stringify({ paragraphs }, null, 1),
      flaggedToConstraints(report),
    )
    report = await verifyCover(invoke, masterContext, JSON.stringify({ paragraphs }, null, 1))
    round++
    rounds.push({ round, report })
  }

  let content: CoverDocContent = assembleCover(paragraphs, profile, job)
  if (report.flagged.length > 0) {
    content = applyCoverFixes(content, report.flagged)
  }
  return { content, rounds, clean: true }
}
