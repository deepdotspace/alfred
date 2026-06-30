/**
 * Ashby adapter (TIER-1, best free STRUCTURED source -- no title regex needed
 * for interns: employmentType==='Intern' is reliable). locationName can be null
 * (fallback chain). Has descriptionPlain (free, ~8 KB) + a comp summary.
 *
 * See INGEST-PLAN.md section 2c.
 */
import type { RoleType } from '../../../types'
import type { NormalizedJob } from '../types'
import { parseLocation, parsePay, isUsOrUnknown } from '../normalize'
import { NEWGRAD_RE, slugToDisplay, windowCutoffMs } from './common'

interface AshbyJob {
  title?: string
  employmentType?: string
  isListed?: boolean
  isRemote?: boolean
  locationName?: string | null
  address?: { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
  secondaryLocations?: { locationName?: string }[]
  publishedAt?: string
  jobUrl?: string
  applyUrl?: string
  descriptionPlain?: string
  compensation?: { compensationTierSummary?: string }
}

function ashbyLocation(j: AshbyJob): string {
  if (j.locationName) return j.locationName
  const pa = j.address?.postalAddress
  if (pa) return [pa.addressLocality, pa.addressRegion, pa.addressCountry].filter(Boolean).join(', ')
  if (j.secondaryLocations?.[0]?.locationName) return j.secondaryLocations[0].locationName!
  return 'Unspecified'
}

export async function fetchAshby(slug: string, windowDays: number, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`, {
    signal,
  })
  if (!res.ok) throw new Error(`ashby ${slug} ${res.status}`)
  const body = (await res.json()) as { jobs?: AshbyJob[] }
  const cutoff = windowCutoffMs(windowDays)
  const out: NormalizedJob[] = []

  for (const j of body.jobs ?? []) {
    try {
      if (j.isListed === false) continue
      if (!j.title || !j.jobUrl) continue
      const isIntern = j.employmentType === 'Intern'
      const isNewGrad = j.employmentType === 'FullTime' && NEWGRAD_RE.test(j.title)
      if (!isIntern && !isNewGrad) continue

      const locStr = ashbyLocation(j)
      const locations = [parseLocation(locStr)]
      if (!isUsOrUnknown(locations, [locStr])) continue

      const postedMs = j.publishedAt ? Date.parse(j.publishedAt) : null
      if (postedMs && postedMs < cutoff) continue

      const role_type: RoleType = isIntern ? 'internship' : 'new-grad-ft'
      out.push({
        source: 'ats-ashby',
        apply_url: j.jobUrl,
        title: j.title,
        company: slugToDisplay(slug),
        locations,
        workplace: j.isRemote ? 'remote' : 'onsite',
        role_type,
        posted_date: postedMs,
        description_text: j.descriptionPlain || null,
        pay: parsePay(j.compensation?.compensationTierSummary ?? null, 'ashby'),
        active: true,
      })
    } catch {
      // skip malformed
    }
  }
  return out
}
