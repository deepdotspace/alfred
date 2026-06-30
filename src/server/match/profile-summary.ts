/**
 * Compact, faithful profile summary for the Haiku qualify/rank prompt.
 *
 * Kept small (a few hundred tokens) but grounded: education, real work bullets,
 * projects, skills, and the user's own targeting + free-text words. The matcher
 * judges honesty against THIS text, so it must reflect only what the profile
 * actually contains -- never embellish.
 */
import { ROLE_TAXONOMY } from '../../constants'
import type { ProfileData } from '../../types'

function familyLabels(ids: string[] | undefined): string {
  if (!ids?.length) return 'not specified'
  return ids
    .map((id) => ROLE_TAXONOMY.find((n) => n.id === id)?.label ?? id)
    .join(', ')
}

function intentLabel(intent: string[] | undefined): string {
  if (!intent?.length) return 'not specified'
  const map: Record<string, string> = {
    internship: 'internship',
    'co-op': 'co-op',
    'new-grad-ft': 'new-grad full-time',
  }
  return intent.map((i) => map[i] ?? i).join(', ')
}

function clamp(s: string | null | undefined, n: number): string {
  const v = (s ?? '').trim()
  return v.length > n ? `${v.slice(0, n)}...` : v
}

/** Render the master profile as a stable, compact prompt block. */
export function buildProfileSummary(p: ProfileData): string {
  const lines: string[] = []
  const b = p.basics
  if (b?.name) lines.push(`Name: ${b.name}`)

  const edu = (p.education ?? [])
    .map((e) => {
      const deg = [e.degree, e.field].filter(Boolean).join(' in ')
      const when = e.end ? `graduating ${e.end}` : ''
      const gpa = e.gpa ? `GPA ${e.gpa}` : ''
      return [deg, e.school, when, gpa].filter(Boolean).join(', ')
    })
    .filter(Boolean)
  if (edu.length) lines.push(`Education: ${edu.join('; ')}`)

  const skills = (p.skills ?? [])
    .map((g) => `${g.category}: ${(g.items ?? []).join(', ')}`)
    .filter(Boolean)
  if (skills.length) lines.push(`Skills:\n  ${skills.join('\n  ')}`)

  const work = (p.work ?? []).slice(0, 4).map((w) => {
    const head = `${w.title} at ${w.company}${w.start || w.end ? ` (${[w.start, w.end].filter(Boolean).join(' to ')})` : ''}`
    const bullets = (w.bullets ?? []).slice(0, 3).map((x) => `    - ${clamp(x, 220)}`)
    return [`  - ${head}`, ...bullets].join('\n')
  })
  if (work.length) lines.push(`Experience:\n${work.join('\n')}`)

  const projects = (p.projects ?? []).slice(0, 5).map((pr) => {
    const desc = clamp(pr.description || (pr.bullets ?? [])[0] || '', 160)
    return `  - ${pr.name}${desc ? `: ${desc}` : ''}`
  })
  if (projects.length) lines.push(`Projects:\n${projects.join('\n')}`)

  if (p.achievements?.length) {
    lines.push(`Achievements: ${p.achievements.slice(0, 4).map((a) => clamp(a, 140)).join('; ')}`)
  }

  const t = p.targeting
  lines.push(
    `Targeting: families = ${familyLabels(t?.role_families)}; intent = ${intentLabel(t?.intent)}; ` +
      `locations = ${t?.locations?.length ? t.locations.join(', ') : 'open / flexible'}; ` +
      `relocate = ${t?.open_to_relocate ? 'yes' : 'no'}; work authorization = ${t?.work_authorization ?? 'unspecified'}`,
  )
  if (t?.requirements_freetext?.trim()) lines.push(`In their own words: ${clamp(t.requirements_freetext, 400)}`)
  if (t?.dealbreakers_freetext?.trim()) lines.push(`Dealbreakers: ${clamp(t.dealbreakers_freetext, 280)}`)

  return lines.join('\n')
}
