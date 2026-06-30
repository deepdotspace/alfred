/**
 * VERIFY step (Haiku skeptic) -- the honesty guarantee.
 *
 * Haiku 4.5 supports assistant prefill, so haikuJson() returns clean JSON. The
 * verifier classifies every generated claim against the master profile;
 * embellished + fabricated findings are the flagged set that drives a
 * constrained regeneration. This is the product's trust differentiator, not a
 * cosmetic check (TAILORING-SPIKE: a single generation pass embellishes).
 */
import { haikuJson, type IntegrationInvoke } from '../integrations'
import { stripEmDashes } from './sanitize'
import { VERIFY_SYSTEM, COVER_VERIFY_SYSTEM, buildVerifyPrompt, buildCoverVerifyPrompt } from './prompts'
import type { VerifyFinding, VerifyReport } from './types'

interface RawFinding {
  claim?: unknown
  verdict?: unknown
  note?: unknown
  fix?: unknown
}

function coerceFinding(r: RawFinding): VerifyFinding | null {
  const claim = typeof r.claim === 'string' ? stripEmDashes(r.claim) : ''
  if (!claim) return null
  const v = typeof r.verdict === 'string' ? r.verdict.toLowerCase() : ''
  const verdict: VerifyFinding['verdict'] =
    v === 'fabricated' ? 'fabricated' : v === 'embellished' ? 'embellished' : 'supported'
  return {
    claim,
    verdict,
    note: typeof r.note === 'string' ? stripEmDashes(r.note) : '',
    fix: typeof r.fix === 'string' ? stripEmDashes(r.fix) : '',
  }
}

function toReport(findings: VerifyFinding[]): VerifyReport {
  let supported = 0
  let embellished = 0
  let fabricated = 0
  const flagged: VerifyFinding[] = []
  for (const f of findings) {
    if (f.verdict === 'supported') supported++
    else {
      if (f.verdict === 'embellished') embellished++
      else fabricated++
      flagged.push(f)
    }
  }
  return { supported, embellished, fabricated, flagged }
}

async function runVerify(
  invoke: IntegrationInvoke,
  system: string,
  user: string,
): Promise<VerifyReport> {
  const out = await haikuJson<{ findings?: RawFinding[] }>(invoke, {
    system,
    user,
    maxTokens: 4096,
    temperature: 0,
  })
  const findings = (out.findings ?? []).map(coerceFinding).filter((f): f is VerifyFinding => !!f)
  return toReport(findings)
}

export function verifyResume(invoke: IntegrationInvoke, masterContext: string, generatedJson: string): Promise<VerifyReport> {
  return runVerify(invoke, VERIFY_SYSTEM, buildVerifyPrompt(masterContext, generatedJson))
}

export function verifyCover(invoke: IntegrationInvoke, masterContext: string, paragraphsJson: string): Promise<VerifyReport> {
  return runVerify(invoke, COVER_VERIFY_SYSTEM, buildCoverVerifyPrompt(masterContext, paragraphsJson))
}

/** Render the flagged findings as a constraint block for the regen prompt. */
export function flaggedToConstraints(report: VerifyReport): string {
  return report.flagged
    .map((f, i) => `${i + 1}. [${f.verdict}] "${f.claim}"\n   why: ${f.note}\n   honest fix: ${f.fix}`)
    .join('\n')
}
