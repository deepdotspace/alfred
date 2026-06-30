/**
 * sample-brief -- the landing's live sample, served from the SHARED pool.
 *
 * Returns a small, SANITIZED set of real pool jobs (non-personal: title,
 * company, location, mode, term, pay, posted, ats) paired with a pre-written
 * honest fit read for the demo persona "Maya". No user data, no per-view AI
 * call, no apply links. The assembled payload is cached for a day (per isolate)
 * so repeated calls cost nothing, and it falls back to the committed fixture
 * when the pool is empty (fresh deploy).
 *
 * NOTE ON AUTH: the SDK gates /api/actions/:name behind a verified JWT, so this
 * action runs for signed-in callers (tests / owner / a signed-in admin). The
 * public landing itself renders the committed fixture (see sample-data.ts),
 * because signed-out visitors have no token. This action is the live-pool
 * mechanism + the fixture's source of truth. (Logged in docs/founder/sdk-issues.md.)
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { JobData } from '../types'
import {
  SAMPLE_BRIEF_FIXTURE,
  type SampleBriefData,
  type SampleEntry,
  type SampleJob,
  type SampleQualify,
  type SampleRead,
} from '../components/landing/sample-data'

interface QueryEnvelope<T> {
  recordId: string
  data: T
}

const TARGET_FAMILIES = ['pm', 'design', 'frontend', 'fullstack', 'swe-general', 'mobile', 'data-science']
const SANE_WORKPLACE = new Set(['remote', 'hybrid', 'onsite'])
const SANE_ROLETYPE = new Set(['internship', 'new-grad-ft'])
const RECENT_MS = 120 * 86_400_000
const WANT = 6

const DAY_MS = 24 * 60 * 60 * 1000
let cache: { at: number; data: SampleBriefData } | null = null

export const sampleBrief: ActionHandler<Env> = async ({ tools }) => {
  if (cache && Date.now() - cache.at < DAY_MS) {
    return { success: true, data: cache.data }
  }

  const q = await tools.query('job', { limit: 1200 })
  if (!q.success) return { success: true, data: SAMPLE_BRIEF_FIXTURE }
  const rows = (q.data as unknown as { records: QueryEnvelope<JobData>[] }).records ?? []

  const now = Date.now()
  const picked = rows
    .map((r) => r.data)
    .filter(isCleanSampleJob)
    .filter((j) => {
      const t = j.posted_date ? Date.parse(j.posted_date) : NaN
      return Number.isFinite(t) && now - t < RECENT_MS
    })
    .sort(byQualityThenRecency)
    .slice(0, WANT)

  if (picked.length < 3) {
    cache = { at: now, data: SAMPLE_BRIEF_FIXTURE }
    return { success: true, data: SAMPLE_BRIEF_FIXTURE }
  }

  const entries: SampleEntry[] = picked.map((j) => ({ job: sanitize(j), read: readFor(j) }))
  const strong = entries.reduce((n, e) => n + (e.read.qualify === 'yes' ? 1 : 0), 0)
  const data: SampleBriefData = {
    source: 'pool',
    persona: SAMPLE_BRIEF_FIXTURE.persona,
    stats: { read: rows.length, worth: entries.length, strong },
    entries,
    note: SAMPLE_BRIEF_FIXTURE.note,
  }
  cache = { at: now, data }
  return { success: true, data }
}

/* ----------------------------------------------------------------- filters */

function isCleanSampleJob(j: JobData): boolean {
  if (j.active === false) return false
  if (!j.company || !j.title) return false
  if (!SANE_WORKPLACE.has(j.workplace)) return false
  if (!SANE_ROLETYPE.has(j.role_type)) return false
  if (!j.description_text && !j.pay) return false
  return (j.role_family ?? []).some((f) => TARGET_FAMILIES.includes(f))
}

function qualityScore(j: JobData): number {
  let s = 0
  if (j.pay) s += 2
  if (j.description_text) s += 1
  if ((j.role_family ?? []).some((f) => f === 'pm' || f === 'design')) s += 2
  return s
}

function byQualityThenRecency(a: JobData, b: JobData): number {
  const q = qualityScore(b) - qualityScore(a)
  if (q) return q
  return Date.parse(b.posted_date ?? '') - Date.parse(a.posted_date ?? '')
}

/* --------------------------------------------------------------- sanitize */

function deDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ')
}

function formatPay(j: JobData): string | null {
  const p = j.pay
  if (!p || (p.min == null && p.max == null)) return null
  const lo = p.min ?? p.max!
  const hi = p.max ?? p.min!
  const k = (n: number) => Math.round(n / 1000)
  if (p.period === 'hourly') return lo === hi ? `$${Math.round(lo)}/hr` : `$${Math.round(lo)}-${Math.round(hi)}/hr`
  if (p.period === 'monthly') return lo === hi ? `$${k(lo)}k/mo` : `$${k(lo)}-${k(hi)}k/mo`
  return lo === hi ? `$${k(lo)}k` : `$${k(lo)}-${k(hi)}k`
}

function locationOf(j: JobData): string {
  const first = (j.locations ?? []).find((l) => l.city || l.state)
  if (first) {
    const parts = [first.city, first.state].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  return j.workplace === 'remote' ? 'Remote' : 'Location not stated'
}

function jdBullets(text: string | null): string[] {
  if (!text) return []
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => deDash(s).trim())
    .filter((s) => s.length > 24 && s.length < 200)
    .slice(0, 4)
}

function sanitize(j: JobData): SampleJob {
  return {
    id: j.canonical_id,
    company: j.company,
    title: deDash(j.title),
    location: locationOf(j),
    workplace: j.workplace as SampleJob['workplace'],
    roleType: j.role_type as SampleJob['roleType'],
    term: j.term ? deDash(j.term) : null,
    pay: formatPay(j),
    postedDate: j.posted_date ?? new Date().toISOString(),
    ats: j.ats,
    jd: jdBullets(j.description_text),
  }
}

/* ----------------------------------------------- persona read (deterministic)
 * Honest, persona-anchored read for Maya (HCI 2026: Figma, React, design
 * systems, SQL basics, two internships). Generic at the persona level and
 * clearly a sample; the committed fixture carries the hand-written reads. */

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function readFor(j: JobData): SampleRead {
  const fams = j.role_family ?? []
  const jitter = hash(j.canonical_id)
  const has = (f: string) => fams.includes(f)

  if (has('pm') || has('design')) {
    return {
      qualify: 'yes',
      score: 80 + (jitter % 6),
      reason:
        'Your HCI background and design-systems work sit right on the seam this role lives on.',
      matched: [
        'HCI degree and two internships give you real product and design judgment',
        'Figma and design-systems experience map directly to the work',
        'You read and write enough React to collaborate closely with engineers',
      ],
      missing: [
        'The team’s specific domain will be new to you',
        'Formal experimentation or analytics depth is still light',
      ],
    }
  }

  if (has('frontend') || has('fullstack')) {
    const score = 70 + (jitter % 9)
    return {
      qualify: score >= 78 ? 'yes' : 'stretch',
      score,
      reason:
        'Your React and front-end fundamentals fit the front half; the deeper engineering will stretch you.',
      matched: [
        'Solid React and front-end skills from your internships',
        'You ship features end to end, not just mockups',
        'Your timing matches an early-career hire',
      ],
      missing: [
        'Backend and systems depth is lighter than the role wants',
        'You will be learning parts of their stack on the job',
      ],
    }
  }

  return {
    qualify: 'stretch',
    score: 58 + (jitter % 10),
    reason:
      'A real early-career role you could grow into, though it leans on engineering breadth your design-focused resume shows less of.',
    matched: [
      'Interface and interaction sense from your HCI and design work',
      'Two internships show you can ship on a real team',
      'You meet the early-career timing this role is built for',
    ],
    missing: [
      'The core skills here sit outside what you have built so far',
      'Expect a real ramp on their domain and stack',
    ],
  }
}
