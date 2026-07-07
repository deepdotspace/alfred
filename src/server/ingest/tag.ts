/**
 * Taxonomy tagging: cheap title-keyword rules first, a bounded Haiku fallback
 * only for the ambiguous cases (0 matches, or >2 -- too noisy to trust). Each
 * job is tagged ONCE ever (pool.ts never re-tags an existing canonicalId).
 *
 * See INGEST-PLAN.md section 3.
 */
import { ROLE_TAXONOMY, ROLE_FAMILY_IDS } from '../../constants'
import type { TaggedBy } from '../../types'
import { haikuJson, type IntegrationInvoke } from '../integrations'

export interface TagResult {
  families: string[]
  taggedBy: TaggedBy
}

/** Lowercased keyword -> family id, longest-first so specific beats general. */
const KEYWORD_RULES: { kw: string; family: string }[] = ROLE_TAXONOMY.flatMap((node) =>
  node.keywords.map((kw) => ({ kw: kw.toLowerCase(), family: node.id })),
).sort((a, b) => b.kw.length - a.kw.length)

/**
 * Keyword tagging over the title (+ optional SimplifyJobs category prior).
 * Returns the distinct matched family ids (may be empty).
 */
export function tagByKeywords(title: string, simplifyCategory?: string | null): string[] {
  const hay = ` ${(title ?? '').toLowerCase()} `
  const families = new Set<string>()
  for (const { kw, family } of KEYWORD_RULES) {
    // word-ish boundary so "ml" doesn't match "html", "ios" not "studios".
    const re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    if (re.test(hay)) families.add(family)
  }
  // Category prior: nudge toward the family the source already bucketed it in,
  // but only as a tiebreaker -- never the sole signal (categories are coarse).
  if (families.size === 0 && simplifyCategory) {
    const cat = simplifyCategory.toLowerCase()
    for (const node of ROLE_TAXONOMY) {
      if (node.simplify_category.toLowerCase() === cat && node.id === 'swe-general') families.add(node.id)
    }
  }
  return [...families]
}

interface HaikuTagOut {
  family_ids?: string[]
}

/**
 * Tag a job. Keyword rules decide unless they yield 0 or an over-broad (>2) set,
 * in which case one Haiku call classifies into the bounded ROLE_FAMILY_IDS set.
 * `invoke` null disables the fallback (free-only / test) -> falls back to
 * ['swe-general'] tagged as keyword.
 */
export async function tagJob(
  title: string,
  description: string | null | undefined,
  simplifyCategory: string | null | undefined,
  invoke: IntegrationInvoke | null,
): Promise<TagResult> {
  const kw = tagByKeywords(title, simplifyCategory)
  if (kw.length >= 1 && kw.length <= 2) return { families: kw, taggedBy: 'keyword' }

  if (!invoke) {
    return { families: kw.length ? kw.slice(0, 2) : ['swe-general'], taggedBy: 'keyword' }
  }

  try {
    const out = await haikuJson<HaikuTagOut>(invoke, {
      system:
        'You classify an early-career software/tech job into 1-2 role families. ' +
        `Choose ONLY from this exact id list: ${ROLE_FAMILY_IDS.join(', ')}. ` +
        'Return JSON {"family_ids": string[]} with 1 or 2 ids, most specific first. ' +
        'If unsure, return ["swe-general"].',
      user: `Title: ${title}\n\n${(description ?? '').slice(0, 600)}`,
      maxTokens: 80,
    })
    const valid = (out.family_ids ?? []).filter((id) => ROLE_FAMILY_IDS.includes(id))
    if (valid.length) return { families: valid.slice(0, 2), taggedBy: 'haiku' }
  } catch {
    // fall through to the keyword/default below
  }
  return { families: kw.length ? kw.slice(0, 2) : ['swe-general'], taggedBy: 'keyword' }
}
