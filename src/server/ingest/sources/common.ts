/**
 * Shared adapter helpers: the intern/new-grad title regexes, the window cutoff,
 * the SimplifyJobs SWE category set, and a slug -> display-name helper.
 */
import type { RoleType } from '../../../types'

/** Word-boundary so it never matches "internal" / "international". */
export const INTERN_RE = /\bintern(ship)?\b/i
export const COOP_RE = /\bco[- ]?op\b/i
export const NEWGRAD_RE =
  /\b(new\s?grad(uate)?|new\s?college\s?grad|university\s?grad|college\s?grad|early\s?career|20\d\d\s?grad)\b/i

/** epoch-ms cutoff for "posted within `windowDays`". */
export function windowCutoffMs(windowDays: number, now = Date.now()): number {
  return now - windowDays * 86_400_000
}

/** ISO date `windowDays` ago (for firecrawl/exa `after:` and startPublishedDate). */
export function windowAfterIso(windowDays: number, now = Date.now()): string {
  return new Date(now - windowDays * 86_400_000).toISOString()
}

/** YYYY-MM-DD `windowDays` ago (for the firecrawl Google `after:` operator). */
export function windowAfterDate(windowDays: number, now = Date.now()): string {
  return new Date(now - windowDays * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The SimplifyJobs `category` values we keep (tech-ish, EC-relevant). Lowercased
 * for comparison. Verified label variants live + the long forms.
 */
export const SWE_CATEGORY_SET = new Set(
  [
    'Software Engineering',
    'Software',
    'AI/ML/Data',
    'Data Science, AI & Machine Learning',
    'Data Science',
    'Hardware Engineering',
    'Quantitative Finance',
    'Product Management',
  ].map((s) => s.toLowerCase()),
)

/** Decide internship vs co-op from the title for an intern-file row. */
export function internRoleType(title: string): RoleType {
  return COOP_RE.test(title) ? 'co-op' : 'internship'
}

/** Title-case a board slug into a rough display name when the ATS gives none. */
export function slugToDisplay(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** Strip HTML tags + collapse whitespace (for markdown/JD cells). */
export function stripTags(s: string): string {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}
