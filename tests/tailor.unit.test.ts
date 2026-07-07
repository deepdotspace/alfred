/**
 * Tailor honesty-guarantee unit tests -- the fail-closed contract.
 *
 * The product promise is "Nothing invented. Ever. Checked before you see it."
 * These tests prove the guarantee is DERIVED, never asserted:
 *   - the deterministic backstop reports when it cannot resolve a flagged claim
 *     (allResolved=false) so the pipeline marks the doc clean:false (-> verified:false),
 *   - a flagged summary/role with no usable fix is blanked, not kept-and-claimed,
 *   - an empty/degenerate verifier response is NOT treated as a clean pass.
 * Pure logic + a mocked integration invoker; no SDK, no network.
 */
import { describe, it, expect } from 'vitest'
import { applyResumeFixes, applyCoverFixes } from '../src/server/tailor/fixes'
import { verifyResume } from '../src/server/tailor/verify'
import { runResumePipeline } from '../src/server/tailor/pipeline'
import { SONNET_MODEL, HAIKU_MODEL, type IntegrationInvoke } from '../src/server/integrations'
import type { CoverDocContent, JobData, ProfileData, ResumeDocContent } from '../src/types'
import type { VerifyFinding } from '../src/server/tailor/types'

/* ----------------------------------------------------------- fixtures */

function resume(over: Partial<ResumeDocContent> = {}): ResumeDocContent {
  return {
    name: 'Jordan Lee',
    role: 'Frontend Engineer',
    contact: 'j@x.test',
    contactParts: [{ label: 'j@x.test', url: 'mailto:j@x.test' }],
    summary: 'Frontend engineer who built a React dashboard at the campus lab.',
    experience: [
      { title: 'Intern', org: 'Campus Lab', location: null, dates: '2024', bullets: ['Built a React dashboard for lab metrics.'] },
    ],
    projects: [],
    skills: [{ category: 'Languages', items: ['JavaScript', 'TypeScript'] }],
    education: [{ line: 'BS in CS, State U' }],
    ...over,
  }
}

function finding(over: Partial<VerifyFinding> = {}): VerifyFinding {
  return { claim: '', verdict: 'fabricated', note: 'not in profile', fix: '', ...over }
}

/** AnthropicRaw-shaped response carrying `text` as the single text block. */
function rawText(text: string) {
  return { id: 'x', model: 'm', role: 'assistant', type: 'message', content: [{ type: 'text', text }], usage: {} }
}

/* ------------------------------------------------ deterministic backstop */

describe('applyResumeFixes (fail-closed backstop)', () => {
  it('replaces a matched bullet with the honest fix -> resolved', () => {
    const out = applyResumeFixes(resume(), [
      finding({ claim: 'Built a React dashboard for lab metrics.', verdict: 'embellished', fix: 'Built a React dashboard for the lab.' }),
    ])
    expect(out.allResolved).toBe(true)
    expect(out.content.experience[0].bullets).toEqual(['Built a React dashboard for the lab.'])
  })

  it('drops a matched bullet with no fix -> resolved (and removes empty experience)', () => {
    const out = applyResumeFixes(resume(), [finding({ claim: 'Built a React dashboard for lab metrics.', fix: '' })])
    expect(out.allResolved).toBe(true)
    expect(out.content.experience).toHaveLength(0) // entry had its only bullet dropped
  })

  it('BLANKS a flagged summary that has no usable fix (does not keep + claim handled)', () => {
    const out = applyResumeFixes(resume(), [
      finding({ claim: 'Frontend engineer who built a React dashboard at the campus lab.', fix: '' }),
    ])
    expect(out.allResolved).toBe(true)
    expect(out.content.summary).toBe('') // blanked, not left verbatim
  })

  it('BLANKS a flagged role that has no usable fix', () => {
    const out = applyResumeFixes(resume(), [finding({ claim: 'Frontend Engineer', fix: '' })])
    expect(out.allResolved).toBe(true)
    expect(out.content.role).toBe('')
  })

  it('reports allResolved:false when a flagged claim cannot be located', () => {
    const out = applyResumeFixes(resume(), [
      finding({ claim: 'Led a team of 8 engineers to ship a Kubernetes platform.', fix: '' }),
    ])
    expect(out.allResolved).toBe(false)
    // the unmatched (fabricated) claim was never in the doc, so nothing changed,
    // but the run is NOT clean -> the caller must withhold the verified stamp.
    expect(out.content.summary).toBe(resume().summary)
  })
})

describe('applyCoverFixes (fail-closed backstop)', () => {
  const cover = (paragraphs: string[]): CoverDocContent => ({
    date: 'June 30, 2026', salutation: 'Dear Acme team,', paragraphs, closing: 'Warmly,', signature: 'Jordan Lee',
  })

  it('drops a matched paragraph with no fix -> resolved', () => {
    const out = applyCoverFixes(cover(['I shipped a payments platform used by millions.', 'I would love to join.']), [
      finding({ claim: 'I shipped a payments platform used by millions.', fix: '' }),
    ])
    expect(out.allResolved).toBe(true)
    expect(out.content.paragraphs).toEqual(['I would love to join.'])
  })

  it('reports allResolved:false when a flagged sentence matches no paragraph', () => {
    const out = applyCoverFixes(cover(['I would love to join.']), [
      finding({ claim: 'I architected a global Kubernetes platform from scratch.', fix: '' }),
    ])
    expect(out.allResolved).toBe(false)
  })
})

/* ------------------------------------------------------- verify heuristic */

describe('verifyResume (empty/degenerate response is NOT a clean pass)', () => {
  it('treats an empty findings array as a verifier failure (after retry)', async () => {
    let calls = 0
    const invoke: IntegrationInvoke = async () => {
      calls++
      return rawText(JSON.stringify({ findings: [] }))
    }
    const report = await verifyResume(invoke, 'master', '{}')
    expect(report.verifierFailed).toBe(true)
    expect(report.flagged).toHaveLength(0)
    expect(calls).toBe(2) // one retry before failing closed
  })

  it('treats a salvaged {} (no findings key) as a verifier failure', async () => {
    const invoke: IntegrationInvoke = async () => rawText('}') // haikuJson prefills "{" -> "{}"
    const report = await verifyResume(invoke, 'master', '{}')
    expect(report.verifierFailed).toBe(true)
  })

  it('a populated supported-only response is a genuine clean pass', async () => {
    const invoke: IntegrationInvoke = async () =>
      rawText(JSON.stringify({ findings: [{ claim: 'Built X', verdict: 'supported', note: '', fix: '' }] }))
    const report = await verifyResume(invoke, 'master', '{}')
    expect(report.verifierFailed).toBeFalsy()
    expect(report.flagged).toHaveLength(0)
    expect(report.supported).toBe(1)
  })

  it('a transient empty response recovers on the retry', async () => {
    let calls = 0
    const invoke: IntegrationInvoke = async () => {
      calls++
      if (calls === 1) return rawText(JSON.stringify({ findings: [] }))
      return rawText(JSON.stringify({ findings: [{ claim: 'X', verdict: 'fabricated', note: 'n', fix: '' }] }))
    }
    const report = await verifyResume(invoke, 'master', '{}')
    expect(report.verifierFailed).toBeFalsy()
    expect(report.flagged).toHaveLength(1)
  })
})

/* ------------------------------------------------ pipeline clean derivation */

const profile = {
  user_id: 'u',
  basics: { name: 'Jordan Lee', email: 'j@x.test', location: 'NYC' },
  education: [],
  targeting: { role_families: [] },
} as unknown as ProfileData

const job = { title: 'Frontend Engineer', company: 'Acme' } as unknown as JobData

const GENERATE_PAYLOAD = {
  role: 'Frontend Engineer',
  summary: 'Frontend engineer who built a React dashboard at the campus lab.',
  experience: [{ org: 'Campus Lab', title: 'Intern', dates: '2024', bullets: ['Built a React dashboard for lab metrics.'] }],
  projects: [],
  skills: [{ category: 'Languages', items: ['JavaScript'] }],
  gaps: ['No production Kubernetes experience yet.'],
}

/** Mock invoker: Sonnet -> the generated draft; Haiku (verify) -> `verifyPayload`. */
function pipelineInvoke(verifyPayload: unknown): IntegrationInvoke {
  return async (endpoint, body) => {
    expect(endpoint).toBe('anthropic/chat-completion')
    if (body.model === SONNET_MODEL) return rawText(JSON.stringify(GENERATE_PAYLOAD))
    if (body.model === HAIKU_MODEL) return rawText(JSON.stringify(verifyPayload))
    throw new Error(`unexpected model ${String(body.model)}`)
  }
}

describe('runResumePipeline clean derivation (-> verified)', () => {
  it('clean:true when the verifier finds nothing to flag', async () => {
    const verifyPayload = {
      findings: [
        { claim: 'Built a React dashboard for lab metrics.', verdict: 'supported', note: '', fix: '' },
        { claim: 'Frontend engineer who built a React dashboard at the campus lab.', verdict: 'supported', note: '', fix: '' },
      ],
    }
    const res = await runResumePipeline(pipelineInvoke(verifyPayload), 'master', 'jobctx', profile, job, { mode: 'generate' })
    expect(res.clean).toBe(true)
  })

  it('clean:false when a flagged claim survives every round + the backstop', async () => {
    // The verifier keeps flagging a fabricated claim that is NOT in the draft and
    // offers no fix, so the deterministic backstop can never resolve it.
    const verifyPayload = {
      findings: [{ claim: 'Led a team of 8 engineers to ship a Kubernetes platform.', verdict: 'fabricated', note: 'invented', fix: '' }],
    }
    const res = await runResumePipeline(pipelineInvoke(verifyPayload), 'master', 'jobctx', profile, job, { mode: 'generate' })
    expect(res.clean).toBe(false) // run.ts stores `verified: resume.clean` -> verified:false
  })

  it('clean:false when the verifier returns an empty findings array (parse/empty failure)', async () => {
    const res = await runResumePipeline(pipelineInvoke({ findings: [] }), 'master', 'jobctx', profile, job, { mode: 'generate' })
    expect(res.clean).toBe(false)
  })
})
