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

/**
 * One verify attempt. Returns a report ONLY when the verifier produced a usable
 * result: a successful parse whose `findings` is a well-formed, populated array.
 * The prompt requires one entry per claim (supported ones included), so real
 * content always yields >=1 finding -- an absent/non-array `findings`, an empty
 * array, or a salvaged `{}` is NOT a clean pass but a dropped/degenerate
 * response, so it returns null for the caller to retry / fail closed.
 */
async function runVerifyOnce(
  invoke: IntegrationInvoke,
  system: string,
  user: string,
): Promise<VerifyReport | null> {
  let out: { findings?: RawFinding[] }
  try {
    out = await haikuJson<{ findings?: RawFinding[] }>(invoke, {
      system,
      user,
      maxTokens: 4096,
      temperature: 0,
    })
  } catch {
    return null // call or JSON-parse failure -> not a verifiable result
  }
  if (!Array.isArray(out.findings) || out.findings.length === 0) return null
  const findings = out.findings.map(coerceFinding).filter((f): f is VerifyFinding => !!f)
  if (findings.length === 0) return null // entries present but none had a usable claim -> degenerate
  return toReport(findings)
}

async function runVerify(
  invoke: IntegrationInvoke,
  system: string,
  user: string,
): Promise<VerifyReport> {
  // A genuine clean pass returns findings with zero flagged; a dropped/degenerate
  // response returns null. Retry once before giving up so a transient blip does
  // not block an otherwise-honest document.
  const report = (await runVerifyOnce(invoke, system, user)) ?? (await runVerifyOnce(invoke, system, user))
  if (report) return report
  // Two attempts produced no usable verification. Fail closed: signal that the
  // content is UNVERIFIED so the pipeline never stamps it clean.
  return { supported: 0, embellished: 0, fabricated: 0, flagged: [], verifierFailed: true }
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
