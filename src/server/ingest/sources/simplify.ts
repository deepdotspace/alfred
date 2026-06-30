/**
 * SimplifyJobs adapter (TIER-1 backbone): the curated GitHub listings.json.
 * Gives sponsorship + degrees + a direct ATS apply URL. ~11.6 MB per file;
 * filter HARD before keeping anything. date_posted is epoch SECONDS.
 *
 * See INGEST-PLAN.md section 2a.
 */
import type { RoleType, Sponsorship } from '../../../types'
import type { NormalizedJob } from '../types'
import { parseLocation, isUsOrUnknown } from '../normalize'
import { SWE_CATEGORY_SET, internRoleType, windowCutoffMs } from './common'

export const SIMPLIFY_INTERN_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json'
export const SIMPLIFY_NEWGRAD_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json'

interface SimplifyRow {
  url?: string
  company_name?: string
  company_url?: string
  title?: string
  locations?: string[]
  terms?: string[]
  degrees?: string[]
  category?: string
  sponsorship?: string
  date_posted?: number
  active?: boolean
  is_visible?: boolean
}

function mapSponsorship(raw: string | undefined): Sponsorship {
  switch ((raw ?? '').trim()) {
    case 'Offers Sponsorship':
      return 'offers'
    case 'Does Not Offer Sponsorship':
      return 'none'
    case 'U.S. Citizenship is Required':
      return 'citizenship-required'
    default:
      return 'unknown'
  }
}

export async function fetchSimplify(
  url: string,
  fileRole: 'internship' | 'new-grad-ft',
  windowDays: number,
  signal?: AbortSignal,
): Promise<NormalizedJob[]> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`simplify ${res.status}`)
  const rows = (await res.json()) as SimplifyRow[]
  const cutoff = windowCutoffMs(windowDays)
  const out: NormalizedJob[] = []

  for (const r of rows) {
    try {
      if (r.active !== true || r.is_visible !== true) continue
      if (!r.url || !r.company_name || !r.title) continue
      if (!SWE_CATEGORY_SET.has((r.category ?? '').toLowerCase())) continue
      const postedMs = (r.date_posted ?? 0) * 1000
      if (!postedMs || postedMs < cutoff) continue

      const locations = (r.locations ?? []).map(parseLocation)
      if (!isUsOrUnknown(locations, r.locations ?? [])) continue

      const role_type: RoleType = fileRole === 'internship' ? internRoleType(r.title) : 'new-grad-ft'
      out.push({
        source: 'simplify',
        apply_url: r.url,
        title: r.title,
        company: r.company_name,
        company_url: r.company_url || null,
        locations,
        role_type,
        term: r.terms?.[0] ?? null,
        degrees: r.degrees?.length ? r.degrees : null,
        sponsorship: mapSponsorship(r.sponsorship),
        posted_date: postedMs,
        active: true,
      })
    } catch {
      // skip a malformed row, keep going
    }
  }
  return out
}
