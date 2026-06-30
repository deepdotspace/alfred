/**
 * Shared profile/onboarding helpers -- the targeting option lists, the
 * model<->UI mappings, profile defaults, a server-action caller, and small
 * client utilities. Imported by both the onboarding wizard and the Profile page
 * so the two surfaces stay in lockstep.
 */
import { getAuthToken } from 'deepspace'
import { ROLE_TAXONOMY, EXTRA_ROLE_LABELS } from '../../constants'
import type {
  ProfileData,
  TargetingPrefs,
  RoleType,
  WorkAuthorization,
  PayFloor,
} from '../../types'

/* ----------------------------------------------------------- option lists */

/**
 * Role chips = the 16 ROLE_TAXONOMY families (matching joins on these ids) plus
 * a richer set of specific early-career roles (EXTRA_ROLE_LABELS), stored as
 * free-text and mapped back to a family at match time by resolveRoleFamilyIds.
 */
export const ROLE_OPTION_LABELS: string[] = [
  ...ROLE_TAXONOMY.map((n) => n.label),
  ...EXTRA_ROLE_LABELS,
]

/** Locations (free-text), from the prototype's locOpts. */
export const LOCATION_OPTIONS: string[] = [
  'Remote', 'Anywhere', 'San Francisco', 'Bay Area', 'New York', 'Seattle',
  'Los Angeles', 'Boston', 'Austin', 'Chicago', 'Denver', 'Atlanta',
  'San Diego', 'Portland', 'Washington DC', 'Pittsburgh', 'Toronto',
  'Vancouver', 'London', 'Berlin',
]

/**
 * Stage = the role-type intent, a MULTI-SELECT of the three real early-career
 * stages. The data model already stores several (`targeting.intent: RoleType[]`),
 * so the UI writes the selected array directly -- no "Both" pseudo-value, no
 * stage<->intent mapping.
 */
export const STAGE_TYPE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'co-op', label: 'Co-op' },
  { value: 'new-grad-ft', label: 'New grad' },
]

/** The three real stages a user can target (excludes 'unknown'). */
const STAGE_INTENTS: RoleType[] = ['internship', 'co-op', 'new-grad-ft']

/** Toggle one stage in the intent array (add if absent, remove if present). */
export function toggleIntent(intent: readonly RoleType[], value: RoleType): RoleType[] {
  return intent.includes(value) ? intent.filter((x) => x !== value) : [...intent, value]
}

/**
 * Normalize a stored intent to the real stages: keep only valid stage values,
 * drop 'unknown' / dupes, and migrate any legacy 'both' string to all three.
 * An empty result is meaningful (no stage constraint), so it is preserved.
 */
export function normalizeIntent(intent: readonly (RoleType | string)[] | undefined): RoleType[] {
  if (!intent?.length) return []
  if (intent.some((x) => x === 'both')) return [...STAGE_INTENTS]
  const seen = new Set<RoleType>()
  for (const x of intent) if (STAGE_INTENTS.includes(x as RoleType)) seen.add(x as RoleType)
  return STAGE_INTENTS.filter((s) => seen.has(s))
}

/* ------------------------------------------------------- role id <-> label */

const LABEL_TO_ID = new Map(ROLE_TAXONOMY.map((n) => [n.label, n.id]))
const ID_TO_LABEL = new Map(ROLE_TAXONOMY.map((n) => [n.id, n.label]))

/** Family id for a chip label (custom strings map to themselves). */
export const roleLabelToId = (label: string): string => LABEL_TO_ID.get(label) ?? label
/** Chip label for a family id (custom ids show as-is). */
export const roleIdToLabel = (id: string): string => ID_TO_LABEL.get(id) ?? id
/** Selected role chip labels for a set of stored family ids. */
export const roleIdsToLabels = (ids: string[]): string[] => ids.map(roleIdToLabel)

export function toggleRole(ids: string[], chipLabel: string): string[] {
  const id = roleLabelToId(chipLabel)
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}
export function addCustomRole(ids: string[], query: string): string[] {
  const id = query.trim()
  if (!id) return ids
  // If it matches a taxonomy label, store its id; else store the raw string.
  const resolved = roleLabelToId(id)
  return ids.includes(resolved) ? ids : [...ids, resolved]
}

/* --------------------------------------------------------- pay <-> floor */

export type PayMode = 'year' | 'hour'
export function payToFloor(mode: PayMode, value: number): PayFloor {
  return mode === 'year'
    ? { amount: value * 1000, period: 'yearly' }
    : { amount: value, period: 'hourly' }
}
export function floorToPay(floor: PayFloor | null): { mode: PayMode; value: number } {
  if (!floor) return { mode: 'year', value: 60 }
  return floor.period === 'hourly'
    ? { mode: 'hour', value: floor.amount }
    : { mode: 'year', value: Math.round(floor.amount / 1000) }
}

/* ------------------------------------------------------- visa <-> workauth */

export const needsSponsorship = (wa: WorkAuthorization): boolean =>
  wa === 'need-sponsorship-now' || wa === 'need-sponsorship-future'
export const visaToWorkAuth = (on: boolean): WorkAuthorization =>
  on ? 'need-sponsorship-now' : 'citizen-or-pr'

/* --------------------------------------------------------- profile default */

export function defaultTargeting(): TargetingPrefs {
  return {
    role_families: [],
    intent: ['internship', 'co-op', 'new-grad-ft'],
    locations: ['Remote', 'San Francisco'],
    work_modes: ['onsite', 'hybrid', 'remote'],
    open_to_relocate: true,
    work_authorization: 'citizen-or-pr',
    pay_floor: { amount: 60000, period: 'yearly' },
    company_prefs: null,
    requirements_freetext: '',
    dealbreakers_freetext: '',
  }
}

/** A blank master profile (used before parse / for safe merges). */
export function defaultProfile(userId: string, name = '', email = ''): ProfileData {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    basics: { name, email, phone: '', location: '', links: { github: '', linkedin: '', portfolio: '', other: [] } },
    education: [],
    work: [],
    projects: [],
    skills: [],
    achievements: [],
    targeting: defaultTargeting(),
    voice: { resume_keys: [], cover_letter_keys: [], writing_sample: '', writing_references: [], stories_freetext: '' },
    settings: { digest_cadence: 'daily', email_enabled: true, notifications_enabled: true },
    created_at: now,
    updated_at: now,
  }
}

/* ----------------------------------------------------------- misc utils */

/** Time-of-day greeting (matches the prototype's enum). */
export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** A short "SAT · JUNE 28" style label (used elsewhere; handy here too). */
export function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

/** Strip em dashes from user-visible/AI text (house-rule backstop). */
export const stripEmDashes = (s: string): string => s.replace(/\s*—\s*/g, ', ')

/** Read a File as base64 (no data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(((r.result as string) || '').split(',')[1] ?? '')
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

/* ------------------------------------------------------- server actions */

export interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** POST a server action with the caller's JWT. */
export async function callAction<T>(name: string, params: unknown): Promise<ActionResponse<T>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
      body: JSON.stringify(params),
    })
    return (await res.json()) as ActionResponse<T>
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}
