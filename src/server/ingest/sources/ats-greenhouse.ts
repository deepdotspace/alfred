/**
 * Greenhouse adapter (TIER-1, breadth). LIST endpoint only -- NEVER content=true
 * (verified 19.97 MB vs 1.83 MB). Big boards have huge totals but few EC roles,
 * so title-filter first, then US-filter. The list exposes `updated_at`, not a
 * true posted date -> posted_date_approx=true.
 *
 * See INGEST-PLAN.md section 2d.
 */
import type { RoleType } from '../../../types'
import type { NormalizedJob } from '../types'
import { parseLocation, isUsOrUnknown } from '../normalize'
import { INTERN_RE, NEWGRAD_RE, internRoleType, slugToDisplay, windowCutoffMs } from './common'

interface GhJob {
  title?: string
  absolute_url?: string
  updated_at?: string
  location?: { name?: string }
}

export async function fetchGreenhouse(slug: string, windowDays: number, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`, { signal })
  if (!res.ok) throw new Error(`greenhouse ${slug} ${res.status}`)
  const body = (await res.json()) as { jobs?: GhJob[] }
  const cutoff = windowCutoffMs(windowDays)
  const out: NormalizedJob[] = []

  for (const j of body.jobs ?? []) {
    try {
      if (!j.title || !j.absolute_url) continue
      const isIntern = INTERN_RE.test(j.title)
      const isNewGrad = NEWGRAD_RE.test(j.title)
      if (!isIntern && !isNewGrad) continue

      const locStr = j.location?.name ?? ''
      const locations = locStr ? [parseLocation(locStr)] : []
      if (!isUsOrUnknown(locations, locStr ? [locStr] : [])) continue

      const postedMs = j.updated_at ? Date.parse(j.updated_at) : null
      if (postedMs && postedMs < cutoff) continue

      const role_type: RoleType = isIntern ? internRoleType(j.title) : 'new-grad-ft'
      out.push({
        source: 'ats-greenhouse',
        apply_url: j.absolute_url,
        title: j.title,
        company: slugToDisplay(slug),
        locations,
        role_type,
        posted_date: postedMs,
        posted_date_approx: true,
        active: true,
      })
    } catch {
      // skip malformed
    }
  }
  return out
}
