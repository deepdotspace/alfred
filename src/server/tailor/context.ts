/**
 * Grounding context for the tailoring pipeline.
 *
 * Two jobs:
 *  1. buildMasterContext -- a faithful, VERBATIM dump of the master profile
 *     (every work bullet, every project, all skills, achievements, links). The
 *     generator is allowed to rephrase/reorder ONLY what appears here, and the
 *     verifier checks every output claim against this text. So it must reflect
 *     exactly what the profile contains -- never summarize away a detail.
 *  2. Deterministic header fields (name / role / contact / education) lifted
 *     straight from the profile so they can NEVER be model-fabricated.
 */
import type {
  JobData,
  ProfileData,
  ResumeEducationEntry,
} from '../../types'
import { ROLE_TAXONOMY } from '../../constants'

/* ----------------------------------------------------- deterministic header */

/** The contact line + its link targets, straight from profile.basics. */
export function buildContact(profile: ProfileData): {
  contact: string
  contactParts: { label: string; url: string | null }[]
} {
  const b = profile.basics
  const parts: { label: string; url: string | null }[] = []
  if (b?.email?.trim()) parts.push({ label: b.email.trim(), url: `mailto:${b.email.trim()}` })
  if (b?.phone?.trim()) parts.push({ label: b.phone.trim(), url: null })
  const links = b?.links
  if (links?.github?.trim()) parts.push({ label: cleanLink(links.github), url: links.github.trim() })
  if (links?.linkedin?.trim()) parts.push({ label: cleanLink(links.linkedin), url: links.linkedin.trim() })
  if (links?.portfolio?.trim()) parts.push({ label: cleanLink(links.portfolio), url: links.portfolio.trim() })
  if (b?.location?.trim()) parts.push({ label: b.location.trim(), url: null })
  return { contact: parts.map((p) => p.label).join(' · '), contactParts: parts }
}

function cleanLink(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/** Education lines straight from profile.education (never fabricated). */
export function buildEducation(profile: ProfileData): ResumeEducationEntry[] {
  return (profile.education ?? [])
    .map((e) => {
      const deg = [e.degree, e.field].filter(Boolean).join(' in ')
      const when = e.end ? `Expected ${e.end}` : ''
      const gpa = e.gpa ? `GPA ${e.gpa}` : ''
      const line = [deg, e.school, when, gpa].filter(Boolean).join(' · ')
      return { line }
    })
    .filter((e) => e.line.trim().length > 0)
}

/**
 * A safe default role line from the profile's targeting families + the job
 * title, used as a fallback when the model's role line fails verification.
 */
export function defaultRoleLine(profile: ProfileData, job: JobData): string {
  const fam = (profile.targeting?.role_families ?? [])[0]
  const label = ROLE_TAXONOMY.find((n) => n.id === fam)?.label
  if (label) return `${label} Engineer`.replace(/Engineer Engineer/, 'Engineer')
  return job.title || 'Software Engineer'
}

/* --------------------------------------------------------- master context */

function clamp(s: string | null | undefined, n: number): string {
  const v = (s ?? '').trim()
  return v.length > n ? `${v.slice(0, n)}...` : v
}

/** Verbatim master-profile dump the generator is grounded to + verified against. */
export function buildMasterContext(profile: ProfileData): string {
  const lines: string[] = []
  const b = profile.basics
  if (b?.name) lines.push(`NAME: ${b.name}`)
  if (b?.location) lines.push(`LOCATION: ${b.location}`)

  const edu = (profile.education ?? []).map((e) => {
    const deg = [e.degree, e.field].filter(Boolean).join(' in ')
    const when = [e.start, e.end].filter(Boolean).join(' to ')
    const gpa = e.gpa ? `GPA ${e.gpa}` : ''
    const extra = (e.details ?? []).join('; ')
    return `  - ${[deg, e.school, when, gpa, extra].filter(Boolean).join(', ')}`
  })
  if (edu.length) lines.push(`EDUCATION:\n${edu.join('\n')}`)

  const work = (profile.work ?? []).map((w) => {
    const head = `${w.title} at ${w.company}${[w.start, w.end].filter(Boolean).length ? ` (${[w.start, w.end].filter(Boolean).join(' to ')})` : ''}${w.location ? `, ${w.location}` : ''}`
    const bullets = (w.bullets ?? []).map((x) => `      * ${clamp(x, 400)}`)
    return [`  - ${head}`, ...bullets].join('\n')
  })
  if (work.length) lines.push(`EXPERIENCE (rephrase/reorder only what is here; never add a tech, metric, or claim not present):\n${work.join('\n')}`)

  const projects = (profile.projects ?? []).map((p) => {
    const desc = clamp(p.description || '', 240)
    const bullets = (p.bullets ?? []).map((x) => `      * ${clamp(x, 320)}`)
    const head = `${p.name}${p.link ? ` (${p.link})` : ''}${desc ? `: ${desc}` : ''}`
    return [`  - ${head}`, ...bullets].join('\n')
  })
  if (projects.length) lines.push(`PROJECTS:\n${projects.join('\n')}`)

  const skills = (profile.skills ?? []).map((g) => `  - ${g.category}: ${(g.items ?? []).join(', ')}`)
  if (skills.length) lines.push(`SKILLS (the ONLY skills the candidate has -- never list one not here):\n${skills.join('\n')}`)

  if (profile.achievements?.length) {
    lines.push(`ACHIEVEMENTS:\n${profile.achievements.map((a) => `  - ${clamp(a, 280)}`).join('\n')}`)
  }

  const t = profile.targeting
  if (t?.requirements_freetext?.trim()) lines.push(`IN THEIR OWN WORDS: ${clamp(t.requirements_freetext, 500)}`)
  if (t?.dealbreakers_freetext?.trim()) lines.push(`DEALBREAKERS: ${clamp(t.dealbreakers_freetext, 300)}`)

  return lines.join('\n\n')
}

/** A compact, faithful rendering of the target job for keyword mirroring. */
export function buildJobContext(job: JobData): string {
  const lines: string[] = []
  lines.push(`TITLE: ${job.title}`)
  lines.push(`COMPANY: ${job.company}`)
  if (job.role_type && job.role_type !== 'unknown') lines.push(`TYPE: ${job.role_type}${job.term ? ` (${job.term})` : ''}`)
  if (job.key_skills?.length) lines.push(`LISTED SKILLS: ${job.key_skills.slice(0, 24).join(', ')}`)
  if (job.description_text?.trim()) {
    lines.push(`DESCRIPTION:\n${job.description_text.replace(/\s+/g, ' ').trim().slice(0, 3500)}`)
  }
  return lines.join('\n')
}

/** The voice sample(s) for cover-letter voice matching, concatenated. */
export function buildVoiceSample(profile: ProfileData): string {
  const v = profile.voice
  const parts: string[] = []
  for (const r of v?.writing_references ?? []) {
    if (r.content?.trim()) parts.push(`--- ${r.title || 'sample'} ---\n${r.content.trim()}`)
  }
  if (v?.writing_sample?.trim()) parts.push(v.writing_sample.trim())
  return parts.join('\n\n').slice(0, 6000)
}
