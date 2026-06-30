/**
 * SpeedyApply adapter (TIER-1, the only free SALARY source). Markdown tables in
 * README.md (interns) + NEW_GRAD_USA.md (new grads). The Apply-column href is
 * the ATS link (NOT the company href). Column count varies -> detect via header.
 *
 * See INGEST-PLAN.md section 2b.
 */
import type { NormalizedJob } from '../types'
import { parseLocation, parsePay, isUsOrUnknown } from '../normalize'
import { stripTags, windowCutoffMs } from './common'

export const SPEEDY_INTERN_URL =
  'https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md'
export const SPEEDY_NEWGRAD_URL =
  'https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md'

const HREF_RE = /href="([^"]+)"/i
const STRONG_RE = /<strong>(.*?)<\/strong>/i

/** Parse a markdown table row into trimmed cell strings (drops leading/trailing |). */
function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function ageToPostedMs(ageCell: string, now: number): { ms: number | null; approx: boolean } {
  const m = ageCell.match(/(\d+)\s*d/i)
  if (m) return { ms: now - parseInt(m[1], 10) * 86_400_000, approx: true }
  return { ms: null, approx: true }
}

export async function fetchSpeedyApply(
  url: string,
  fileRole: 'internship' | 'new-grad-ft',
  windowDays: number,
  signal?: AbortSignal,
): Promise<NormalizedJob[]> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`speedyapply ${res.status}`)
  const md = await res.text()
  const now = Date.now()
  const cutoff = windowCutoffMs(windowDays, now)
  const out: NormalizedJob[] = []

  const lines = md.split('\n')
  // Column layout (carried until a new header redefines it).
  let cols: { company: number; title: number; location: number; salary: number; posting: number; age: number } | null =
    null

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      continue
    }
    const cells = splitRow(line)
    const lower = cells.map((c) => c.toLowerCase())

    // Header row?
    if (lower.includes('company') && lower.includes('position')) {
      cols = {
        company: lower.indexOf('company'),
        title: lower.indexOf('position'),
        location: lower.indexOf('location'),
        salary: lower.indexOf('salary'),
        posting: lower.indexOf('posting'),
        age: lower.indexOf('age'),
      }
      continue
    }
    // Separator row (|---|---|) -> skip.
    if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue
    if (!cols) continue
    // Data rows carry anchor tags.
    if (!line.includes('<a ')) continue

    try {
      const companyCell = cells[cols.company] ?? ''
      const company = stripTags((companyCell.match(STRONG_RE)?.[1] ?? companyCell)).trim()
      if (!company) continue
      const company_url = companyCell.match(HREF_RE)?.[1] ?? null

      const title = stripTags(cells[cols.title] ?? '')
      if (!title) continue

      const postingCell = cols.posting >= 0 ? cells[cols.posting] ?? '' : ''
      const apply_url = postingCell.match(HREF_RE)?.[1]
      if (!apply_url) continue

      const locStr = cols.location >= 0 ? stripTags(cells[cols.location] ?? '') : ''
      const locations = locStr ? [parseLocation(locStr)] : []
      if (!isUsOrUnknown(locations, locStr ? [locStr] : [])) continue

      const salaryStr = cols.salary >= 0 ? stripTags(cells[cols.salary] ?? '') : ''
      const pay = parsePay(salaryStr, 'speedyapply')

      const ageCell = cols.age >= 0 ? cells[cols.age] ?? '' : ''
      const { ms, approx } = ageToPostedMs(ageCell, now)
      if (ms !== null && ms < cutoff) continue

      out.push({
        source: 'speedyapply',
        apply_url,
        title,
        company,
        company_url,
        locations,
        role_type: fileRole,
        pay,
        posted_date: ms,
        posted_date_approx: approx,
        active: true,
      })
    } catch {
      // skip a malformed row
    }
  }
  return out
}
