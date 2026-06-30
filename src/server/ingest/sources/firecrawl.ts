/**
 * Firecrawl adapter (TIER-2, cheap): Google-operator search for LinkedIn and
 * off-slug-list roles. Use the structured `url`/`title`/`description`; ignore the
 * heavy auto-scraped markdown (it can resolve to a careers page, not the post).
 *
 * See INGEST-PLAN.md section 2f.
 */
import type { RoleFamilyNode } from '../../../types'
import type { NormalizedJob } from '../types'
import { firecrawlSearch, type IntegrationInvoke } from '../../integrations'
import { slugFromUrl } from '../normalize'
import { INTERN_RE, NEWGRAD_RE, slugToDisplay, windowAfterDate } from './common'

const ATS_HOST_HINTS = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'linkedin.com/jobs']

/** Best-effort company label from the URL when search gives none. */
function companyFromUrl(url: string): string {
  const slug = slugFromUrl(url)
  if (slug) return slugToDisplay(slug.slug)
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown'
  }
}

export async function fetchFirecrawl(
  invoke: IntegrationInvoke,
  node: RoleFamilyNode,
  windowDays: number,
  limit = 10,
): Promise<NormalizedJob[]> {
  const after = windowAfterDate(windowDays)
  const kw = node.keywords[0] ?? node.label.toLowerCase()
  const query =
    `site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:linkedin.com/jobs ` +
    `"${kw} intern" OR "${kw} new grad" after:${after}`

  const docs = await firecrawlSearch(invoke, { query, limit })
  const out: NormalizedJob[] = []
  for (const d of docs) {
    const url = d.url || d.metadata?.sourceURL
    const title = String(d.metadata?.title || d.title || '')
    if (!url || !title) continue
    if (!ATS_HOST_HINTS.some((h) => url.includes(h))) continue
    if (!INTERN_RE.test(title) && !NEWGRAD_RE.test(title)) continue
    out.push({
      source: 'firecrawl',
      apply_url: url,
      title,
      company: companyFromUrl(url),
      description_text: d.metadata?.description || null,
      role_type: INTERN_RE.test(title) ? 'internship' : 'new-grad-ft',
      posted_date: null,
    })
  }
  return out
}
