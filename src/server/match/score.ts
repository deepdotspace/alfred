/**
 * Haiku qualify + rank -- the honest per-(user, job) verdict.
 *
 * The scoring PROMPT here is FIXED on purpose: the digest score-floor (~60) is
 * calibrated against it (DATA-MODEL decision 1), so changing the wording or the
 * bands requires recalibrating the floor. Both the background match Job and the
 * dev preview call `scoreBatch`, so they always score identically.
 *
 * Honesty is the product. The prompt forces verdicts grounded in the candidate's
 * REAL profile, conservative bands, concrete matched/missing, and one specific
 * sentence (no generic praise / no slop). A strip backstop removes any em dash
 * Haiku produces (house rule: none in user-visible text).
 */
import type { JobData, Qualify, Timing } from '../../types'
import { haikuJson, type IntegrationInvoke } from '../integrations'
import type { Envelope, ScoredVerdict } from './types'

/* --------------------------------------------------------- em-dash backstop */

const EM_DASH = /\s*[—―]\s*/g

/** Replace em dashes with " -- " (house rule). En dashes/hyphens are left alone. */
export function stripEmDashes(s: string): string {
  return (s ?? '').replace(EM_DASH, ' -- ').replace(/\s{2,}/g, ' ').trim()
}

/* ----------------------------------------------------------- prompt (FIXED) */

export const SCORING_SYSTEM = [
  'You are Alfred, a meticulous and honest career butler helping an early-career candidate decide where to apply.',
  'You judge whether THIS candidate genuinely fits each role, grounded only in the profile you are given.',
  'You are conservative and truthful. You never inflate, never use generic praise, and would rather call a role a stretch or a no than oversell it.',
  'You never invent skills, experience, or credentials the candidate does not have.',
  '',
  'Score each role 0-100 and assign a verdict using these FIXED bands:',
  '  yes      (strong fit, 70-92): the candidate clearly qualifies; their real experience maps directly to the role.',
  '  stretch  (worth a look, 55-69): plausible but with real gaps, a reach, or thin evidence.',
  '  no       (below 55): wrong domain, requires experience or credentials the candidate lacks, or a seniority mismatch.',
  '',
  'Rules for every verdict:',
  '- The reason is ONE specific sentence that names something concrete from the candidate (a project, a stack, a real gap). No vague praise like "great fit for your skills".',
  '- matched: 2 to 4 concrete things from the profile that this role actually wants.',
  '- missing: 0 to 3 real gaps the role asks for that the profile does not show. Be honest; do not soften.',
  '- timing: "good" if the term/start suits an early-career candidate now, "late" if it looks past or tight, else "unknown".',
  '- Write in plain, calm, second-person voice ("you"). Do NOT use em dashes anywhere.',
].join('\n')

function jobLine(env: Envelope<JobData>, idx: number): string {
  const d = env.data
  const loc =
    (d.locations ?? [])
      .slice(0, 2)
      .map((l) => [l.city, l.state].filter(Boolean).join(', '))
      .filter(Boolean)
      .join(' / ') || (d.workplace === 'remote' ? 'Remote' : 'location not stated')
  const skills = d.key_skills?.length ? d.key_skills.slice(0, 12).join(', ') : ''
  const jd = d.description_text ? d.description_text.replace(/\s+/g, ' ').trim().slice(0, 420) : ''
  const parts = [
    `[${idx}] job_id: ${env.recordId}`,
    `    title: ${d.title}`,
    `    company: ${d.company}`,
    `    type: ${d.role_type}${d.term ? ` (${d.term})` : ''}; workplace: ${d.workplace}; location: ${loc}`,
  ]
  if (skills) parts.push(`    listed skills: ${skills}`)
  if (jd) parts.push(`    description: ${jd}`)
  return parts.join('\n')
}

/** Build the user prompt for one batch. */
export function buildScorePrompt(profileSummary: string, batch: Envelope<JobData>[]): string {
  return [
    'CANDIDATE PROFILE',
    profileSummary,
    '',
    `ROLES TO JUDGE (${batch.length})`,
    batch.map((e, i) => jobLine(e, i)).join('\n\n'),
    '',
    'Return a JSON object of this exact shape, with one entry per role above (same job_id values):',
    '{"verdicts":[{"job_id":"<id>","qualify":"yes|stretch|no","score":<0-100>,"reason":"<one specific sentence>","matched":["..."],"missing":["..."],"timing":"good|late|unknown"}]}',
  ].join('\n')
}

/* --------------------------------------------------------------- coercion */

const QUALIFY_OK = new Set<Qualify>(['yes', 'stretch', 'no'])
const TIMING_OK = new Set<Timing>(['good', 'late', 'unknown'])

function coerceQualify(q: unknown, score: number): Qualify {
  if (typeof q === 'string' && QUALIFY_OK.has(q as Qualify)) return q as Qualify
  // Fall back to the score bands so a malformed label still lands sensibly.
  if (score >= 70) return 'yes'
  if (score >= 55) return 'stretch'
  return 'no'
}

function coerceTiming(t: unknown): Timing {
  return typeof t === 'string' && TIMING_OK.has(t as Timing) ? (t as Timing) : 'unknown'
}

function coerceStrings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, max)
    .map((x) => stripEmDashes(x))
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

interface RawVerdict {
  job_id?: unknown
  qualify?: unknown
  score?: unknown
  reason?: unknown
  matched?: unknown
  missing?: unknown
  timing?: unknown
}

/**
 * Score one batch of jobs against the profile. Returns one ScoredVerdict per job
 * the model returned, keyed by the real job recordId. Throws on integration
 * failure (the caller records it and continues with the next batch).
 */
export async function scoreBatch(
  invoke: IntegrationInvoke,
  profileSummary: string,
  batch: Envelope<JobData>[],
): Promise<ScoredVerdict[]> {
  if (batch.length === 0) return []
  const validIds = new Set(batch.map((e) => e.recordId))

  const out = await haikuJson<{ verdicts?: RawVerdict[] }>(invoke, {
    system: SCORING_SYSTEM,
    user: buildScorePrompt(profileSummary, batch),
    // ~110 tokens/verdict headroom; comfortably covers a 10-job batch.
    maxTokens: 3500,
    temperature: 0,
  })

  const verdicts: ScoredVerdict[] = []
  for (const r of out.verdicts ?? []) {
    const jobId = typeof r.job_id === 'string' ? r.job_id : ''
    if (!validIds.has(jobId)) continue
    const score = clampScore(r.score)
    verdicts.push({
      job_id: jobId,
      qualify: coerceQualify(r.qualify, score),
      score,
      reason: stripEmDashes(typeof r.reason === 'string' ? r.reason : ''),
      matched: coerceStrings(r.matched, 4),
      missing: coerceStrings(r.missing, 3),
      timing: coerceTiming(r.timing),
    })
  }
  return verdicts
}
