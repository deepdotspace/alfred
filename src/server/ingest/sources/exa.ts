/**
 * Exa adapter (TIER-2): full-JD-text discovery restricted to ATS domains.
 * NEVER point at linkedin.com (it returns celebration / /posts/ noise). Gives
 * full JD `text` (good for tailoring) + a real publishedDate.
 *
 * See INGEST-PLAN.md section 2g.
 */
import type { RoleFamilyNode } from '../../../types'
import type { NormalizedJob } from '../types'
import { exaSearch, type IntegrationInvoke } from '../../integrations'
import { slugFromUrl } from '../normalize'
import { INTERN_RE, NEWGRAD_RE, slugToDisplay, windowAfterIso } from './common'

const EXA_DOMAINS = ['boards.greenhouse.io', 'jobs.lever.co', 'jobs.ashbyhq.com']

function companyFromUrl(url: string): string {
  const slug = slugFromUrl(url)
  if (slug) return slugToDisplay(slug.slug)
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown'
  }
}

export async function fetchExa(
  invoke: IntegrationInvoke,
  node: RoleFamilyNode,
  windowDays: number,
  numResults = 10,
): Promise<NormalizedJob[]> {
  const kw = node.keywords[0] ?? node.label.toLowerCase()
  const results = await exaSearch(invoke, {
    query: `${kw} internship OR new grad software role`,
    includeDomains: EXA_DOMAINS,
    startPublishedDate: windowAfterIso(windowDays),
    numResults,
    contents: { text: { maxCharacters: 1500 } },
  })
  const out: NormalizedJob[] = []
  for (const r of results) {
    if (!r.url || !r.title) continue
    if (!INTERN_RE.test(r.title) && !NEWGRAD_RE.test(r.title)) continue
    const postedMs = r.publishedDate ? Date.parse(r.publishedDate) : null
    out.push({
      source: 'exa',
      apply_url: r.url,
      title: r.title,
      company: companyFromUrl(r.url),
      description_text: r.text || null,
      role_type: INTERN_RE.test(r.title) ? 'internship' : 'new-grad-ft',
      posted_date: Number.isFinite(postedMs) ? postedMs : null,
    })
  }
  return out
}
