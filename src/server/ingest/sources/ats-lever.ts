/**
 * Lever adapter (TIER-1, breadth). Client-side title regex is the source of
 * truth (?commitment=Internship is unreliable -- verified 13 vs 15). createdAt
 * is already epoch MILLISECONDS (do NOT x1000). Has descriptionPlain.
 *
 * See INGEST-PLAN.md section 2e.
 */
import type { RoleType, Workplace } from '../../../types'
import type { NormalizedJob } from '../types'
import { parseLocation, isUsOrUnknown } from '../normalize'
import { INTERN_RE, NEWGRAD_RE, internRoleType, slugToDisplay, windowCutoffMs } from './common'

interface LeverPosting {
  text?: string
  hostedUrl?: string
  createdAt?: number
  descriptionPlain?: string
  categories?: { location?: string; commitment?: string; team?: string }
  workplaceType?: string
}

function leverWorkplace(p: LeverPosting): Workplace {
  const w = (p.workplaceType ?? '').toLowerCase()
  if (w.includes('remote')) return 'remote'
  if (w.includes('hybrid')) return 'hybrid'
  if (w.includes('onsite') || w.includes('on-site')) return 'onsite'
  if ((p.categories?.location ?? '').toLowerCase().includes('remote')) return 'remote'
  return 'unknown'
}

export async function fetchLever(slug: string, windowDays: number, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, { signal })
  if (!res.ok) throw new Error(`lever ${slug} ${res.status}`)
  const postings = (await res.json()) as LeverPosting[]
  const cutoff = windowCutoffMs(windowDays)
  const out: NormalizedJob[] = []

  for (const p of postings) {
    try {
      if (!p.text || !p.hostedUrl) continue
      const isIntern = INTERN_RE.test(p.text)
      const isNewGrad = NEWGRAD_RE.test(p.text)
      if (!isIntern && !isNewGrad) continue

      const locStr = p.categories?.location ?? ''
      const locations = locStr ? [parseLocation(locStr)] : []
      if (!isUsOrUnknown(locations, locStr ? [locStr] : [])) continue

      const postedMs = typeof p.createdAt === 'number' ? p.createdAt : null
      if (postedMs && postedMs < cutoff) continue

      const role_type: RoleType = isIntern ? internRoleType(p.text) : 'new-grad-ft'
      out.push({
        source: 'ats-lever',
        apply_url: p.hostedUrl,
        title: p.text,
        company: slugToDisplay(slug),
        locations,
        workplace: leverWorkplace(p),
        role_type,
        posted_date: postedMs,
        description_text: p.descriptionPlain || null,
        active: true,
      })
    } catch {
      // skip malformed
    }
  }
  return out
}
