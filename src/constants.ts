import type { RoleFamilyNode } from './types'

/**
 * Brand / display name (shown in the UI). Safe to change freely -- it does NOT
 * drive the data layer.
 */
export const APP_NAME: string = 'Alfred'

/**
 * Deploy + scope identity (lowercase slug). This MUST equal `[vars] APP_NAME`
 * in wrangler.toml and the deploy `name` ("alfred"), because the worker
 * addresses the RecordRoom DO via `idFromName(`app:${env.APP_NAME}`)` and the
 * api-worker / R2 file routes scope under this slug. SCOPE_ID is derived from
 * APP_ID (not from the display name) so branding never desyncs the client from
 * the server DO.
 */
export const APP_ID = 'alfred'

/** Primary scope ID for the app's RecordRoom DO. Matches `app:${env.APP_NAME}`. */
export const SCOPE_ID = `app:${APP_ID}`

/** Roles and display config -- imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

/**
 * ROLE_TAXONOMY -- the bounded scan-cluster spine (V1-PLAN 4d).
 *
 * ~16 curated role-families. This single constant is shared by THREE phases:
 *  - INGEST tags each pool job to node id(s) (cheap title-keyword rules using
 *    `keywords`, plus a Haiku fallback) -> stored in job.role_family.
 *  - ONBOARDING pre-selects likely node ids from the user's resume and lets the
 *    user adjust -> stored in profile.targeting.role_families.
 *  - MATCHING hard-filters by role_family IN the user's desired families, i.e.
 *    job.role_family JOIN profile.targeting.role_families on these ids.
 *
 * A node is scanned only when >=1 active user wants it (demand-driven), keeping
 * paid scanning shared, bounded, cacheable, and predictable in cost. Free-text
 * user prefs do NOT create new clusters; they are classified onto these nodes
 * and feed the per-user qualify/rank step. Promote recurring long-tail prefs to
 * a new node here (with a tuned query) when one proves real.
 *
 * `simplify_category` values are BEST-EFFORT mappings to the SimplifyJobs
 * listing `category` field. TODO: verify each against the live SimplifyJobs
 * listings.json during ingest (P1) -- their category set is coarse, so several
 * nodes intentionally share one category and ingest disambiguates via keywords.
 */
export const ROLE_TAXONOMY: RoleFamilyNode[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    simplify_category: 'Software Engineering',
    keywords: ['frontend', 'front end', 'front-end', 'react', 'ui engineer', 'web developer', 'javascript', 'typescript'],
  },
  {
    id: 'backend',
    label: 'Backend',
    simplify_category: 'Software Engineering',
    keywords: ['backend', 'back end', 'back-end', 'api engineer', 'server', 'microservices', 'distributed services'],
  },
  {
    id: 'fullstack',
    label: 'Full-Stack',
    simplify_category: 'Software Engineering',
    keywords: ['full stack', 'full-stack', 'fullstack', 'web application engineer'],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    simplify_category: 'Software Engineering',
    keywords: ['mobile', 'ios', 'android', 'swift', 'kotlin', 'react native', 'flutter'],
  },
  {
    id: 'data-science',
    label: 'Data Science',
    simplify_category: 'Data Science, AI & Machine Learning',
    keywords: ['data science', 'data scientist', 'analytics', 'statistician', 'data analyst'],
  },
  {
    id: 'ml-ai',
    label: 'ML / AI Engineering',
    simplify_category: 'Data Science, AI & Machine Learning',
    keywords: ['machine learning', 'ml engineer', 'ai engineer', 'deep learning', 'llm', 'nlp', 'computer vision'],
  },
  {
    id: 'data-eng',
    label: 'Data Engineering',
    simplify_category: 'Data Science, AI & Machine Learning',
    keywords: ['data engineer', 'etl', 'data pipeline', 'data platform', 'spark', 'airflow', 'data warehouse'],
  },
  {
    id: 'devops',
    label: 'DevOps / Platform / SRE',
    simplify_category: 'Software Engineering',
    keywords: ['devops', 'site reliability', 'sre', 'platform engineer', 'infrastructure', 'cloud engineer', 'kubernetes'],
  },
  {
    id: 'security',
    label: 'Security',
    simplify_category: 'Software Engineering',
    keywords: ['security engineer', 'application security', 'appsec', 'cybersecurity', 'infosec', 'product security'],
  },
  {
    id: 'embedded',
    label: 'Embedded / Firmware',
    simplify_category: 'Hardware Engineering',
    keywords: ['embedded', 'firmware', 'embedded systems', 'rtos', 'microcontroller', 'hardware software'],
  },
  {
    id: 'systems',
    label: 'Systems',
    simplify_category: 'Software Engineering',
    keywords: ['systems engineer', 'systems programming', 'low level', 'operating systems', 'distributed systems', 'compilers'],
  },
  {
    id: 'qa-test',
    label: 'QA / Test',
    simplify_category: 'Software Engineering',
    keywords: ['qa engineer', 'quality assurance', 'test engineer', 'sdet', 'test automation'],
  },
  {
    id: 'gamedev',
    label: 'Game Dev',
    simplify_category: 'Software Engineering',
    keywords: ['game developer', 'game engineer', 'unity', 'unreal', 'gameplay', 'game programmer'],
  },
  {
    id: 'pm',
    label: 'Product Management',
    simplify_category: 'Product Management',
    keywords: ['product manager', 'associate product manager', 'apm', 'product management'],
  },
  {
    id: 'design',
    label: 'Product / UX Design',
    simplify_category: 'Product Management',
    keywords: ['ux designer', 'ui designer', 'product designer', 'ux/ui', 'user experience', 'interaction design'],
  },
  {
    id: 'swe-general',
    label: 'Software Engineering (general)',
    simplify_category: 'Software Engineering',
    keywords: ['software engineer', 'swe', 'software developer', 'software development engineer', 'sde', 'programmer'],
  },
]

/** Convenience: every taxonomy node id (the scan-cluster set). */
export const ROLE_FAMILY_IDS: string[] = ROLE_TAXONOMY.map((n) => n.id)

/**
 * EXTRA_ROLE_LABELS -- richer, more specific early-career roles offered in the
 * role picker on top of the 16 taxonomy families. These are stored verbatim as
 * free-text intent (they are NOT taxonomy ids), so the chip shows exactly what
 * the user picked. `resolveRoleFamilyIds` maps the ones that fall under an
 * existing family back to a taxonomy id at match time (so they participate in
 * the role-family hard filter); the rest stay pure free-text the qualify/rank
 * step still reads. Nothing here changes how ingest tags the pool.
 */
export const EXTRA_ROLE_LABELS: string[] = [
  'LLM / GenAI Engineering',
  'Computer Vision',
  'NLP',
  'MLOps',
  'Data Analyst',
  'Analytics Engineering',
  'Business Intelligence',
  'Cloud Engineering',
  'Infrastructure Engineering',
  'Site Reliability (SRE)',
  'Robotics',
  'AR / VR',
  'Compilers',
  'Hardware Engineering',
  'Developer Relations',
  'Solutions Engineering',
  'Sales Engineering',
  'Research Engineer',
  'Technical Program Management',
  'IT / Support',
]

/**
 * Map the user's stored `role_families` (taxonomy ids AND/OR free-text labels)
 * to the set of taxonomy ids they imply, for the matcher's role-family HARD
 * filter. Resolution is, in order: exact taxonomy id, exact taxonomy label,
 * then a node whose keyword appears in the label. A free-text role that resolves
 * to nothing simply contributes NO hard constraint (it is left to the qualify/
 * rank step) -- it must never silently reject the whole pool.
 */
export function resolveRoleFamilyIds(roleFamilies: readonly string[] | undefined): string[] {
  if (!roleFamilies?.length) return []
  const out = new Set<string>()
  for (const raw of roleFamilies) {
    const entry = (raw ?? '').trim()
    if (!entry) continue
    if (ROLE_FAMILY_IDS.includes(entry)) {
      out.add(entry)
      continue
    }
    const s = entry.toLowerCase()
    const byLabel = ROLE_TAXONOMY.find((n) => n.label.toLowerCase() === s)
    if (byLabel) {
      out.add(byLabel.id)
      continue
    }
    for (const n of ROLE_TAXONOMY) {
      if (n.keywords.some((k) => s.includes(k.toLowerCase()))) out.add(n.id)
    }
  }
  return [...out]
}
