/**
 * GENERATE + REGEN steps (Sonnet) for the resume and cover letter.
 *
 * Sonnet 4.6 does NOT support assistant prefill, so sonnetJsonRobust() forces
 * raw-JSON and tolerates trailing prose. We coerce the loose model output into the typed
 * content, then deep-strip em dashes. Deterministic header fields (name /
 * contact / education) are assembled from the profile here, NOT from the model,
 * so they can never be fabricated.
 */
import type {
  CoverDocContent,
  JobData,
  ProfileData,
  ResumeDocContent,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  SkillGroup,
} from '../../types'
import type { IntegrationInvoke } from '../integrations'
import { sonnetJsonRobust } from './json'
import { buildContact, buildEducation, defaultRoleLine } from './context'
import { deepStrip, stripEmDashes } from './sanitize'
import {
  GENERATE_SYSTEM,
  COVER_SYSTEM,
  buildGeneratePrompt,
  buildRegenPrompt,
  buildCoverPrompt,
  buildCoverRegenPrompt,
  refineDirective,
} from './prompts'

/* ------------------------------------------------------------- raw shapes */

interface RawExp {
  org?: unknown
  title?: unknown
  location?: unknown
  dates?: unknown
  bullets?: unknown
  provenance?: unknown
}
interface RawProj {
  name?: unknown
  link?: unknown
  description?: unknown
  bullets?: unknown
  provenance?: unknown
}
interface RawSkill {
  category?: unknown
  items?: unknown
}
interface RawResume {
  role?: unknown
  summary?: unknown
  experience?: unknown
  projects?: unknown
  skills?: unknown
  gaps?: unknown
}

/* --------------------------------------------------------------- coercion */

function str(v: unknown): string {
  return typeof v === 'string' ? stripEmDashes(v) : ''
}
function strOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? stripEmDashes(s) : null
}
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => stripEmDashes(x))
}

function coerceExperience(v: unknown): ResumeExperienceEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .map((r: RawExp) => ({
      title: str(r.title),
      org: str(r.org),
      location: strOrNull(r.location),
      dates: str(r.dates),
      bullets: strArr(r.bullets),
    }))
    .filter((e) => (e.title || e.org) && e.bullets.length > 0)
}

function coerceProjects(v: unknown): ResumeProjectEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .map((r: RawProj) => ({
      name: str(r.name),
      link: strOrNull(r.link),
      description: strOrNull(r.description),
      bullets: strArr(r.bullets),
    }))
    .filter((p) => p.name.length > 0)
}

function coerceSkills(v: unknown): SkillGroup[] {
  if (!Array.isArray(v)) return []
  return v
    .map((r: RawSkill) => ({ category: str(r.category), items: strArr(r.items) }))
    .filter((g) => g.items.length > 0)
}

/**
 * Assemble typed, em-dash-free ResumeDocContent: model output for the tailored
 * body + deterministic profile fields for the header. Returns content + gaps.
 */
export function assembleResume(raw: RawResume, profile: ProfileData, job: JobData): { content: ResumeDocContent; gaps: string[] } {
  const { contact, contactParts } = buildContact(profile)
  const role = str(raw.role) || defaultRoleLine(profile, job)
  const content: ResumeDocContent = {
    name: profile.basics?.name?.trim() || 'Your Name',
    role,
    contact,
    contactParts,
    summary: str(raw.summary),
    experience: coerceExperience(raw.experience),
    projects: coerceProjects(raw.projects),
    skills: coerceSkills(raw.skills),
    education: buildEducation(profile),
  }
  return { content: deepStrip(content), gaps: strArr(raw.gaps) }
}

/* --------------------------------------------------------------- generate */

export async function generateResumeRaw(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
): Promise<RawResume> {
  return sonnetJsonRobust<RawResume>(invoke, {
    system: GENERATE_SYSTEM,
    user: buildGeneratePrompt(masterContext, jobContext),
    maxTokens: 4096,
    temperature: 0.2,
  })
}

export async function regenerateResumeRaw(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
  previousJson: string,
  flagged: string,
): Promise<RawResume> {
  return sonnetJsonRobust<RawResume>(invoke, {
    system: GENERATE_SYSTEM,
    user: buildRegenPrompt(masterContext, jobContext, previousJson, flagged),
    maxTokens: 4096,
    temperature: 0,
  })
}

/** Refine pass: re-generate from the master + a user instruction (honesty held). */
export async function refineResumeRaw(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
  previousJson: string,
  note: string,
): Promise<RawResume> {
  const directive = refineDirective(note)
  return sonnetJsonRobust<RawResume>(invoke, {
    system: GENERATE_SYSTEM,
    user: [
      buildGeneratePrompt(masterContext, jobContext),
      '',
      'YOUR CURRENT DRAFT (improve this, do not start from scratch):',
      previousJson,
      '',
      directive,
    ].join('\n'),
    maxTokens: 4096,
    temperature: 0.2,
  })
}

/* --------------------------------------------------------------- cover */

interface RawCover {
  paragraphs?: unknown
}

export async function generateCoverParagraphs(
  invoke: IntegrationInvoke,
  masterContext: string,
  jobContext: string,
  voiceSample: string,
  gaps: string[],
  note?: string,
): Promise<string[]> {
  const base = buildCoverPrompt(masterContext, jobContext, voiceSample, gaps)
  const user = note?.trim() ? `${base}\n\n${refineDirective(note)}` : base
  const raw = await sonnetJsonRobust<RawCover>(invoke, {
    system: COVER_SYSTEM,
    user,
    maxTokens: 2048,
    temperature: 0.3,
  })
  return strArr(raw.paragraphs)
}

export async function regenerateCoverParagraphs(
  invoke: IntegrationInvoke,
  masterContext: string,
  voiceSample: string,
  previousJson: string,
  flagged: string,
): Promise<string[]> {
  const raw = await sonnetJsonRobust<RawCover>(invoke, {
    system: COVER_SYSTEM,
    user: buildCoverRegenPrompt(masterContext, voiceSample, previousJson, flagged),
    maxTokens: 2048,
    temperature: 0,
  })
  return strArr(raw.paragraphs)
}

/** Assemble cover content (deterministic salutation/closing/signature + body). */
export function assembleCover(paragraphs: string[], profile: ProfileData, job: JobData): CoverDocContent {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return deepStrip({
    date,
    salutation: `Dear ${job.company || 'Hiring'} team,`,
    paragraphs,
    closing: 'Warmly,',
    signature: profile.basics?.name?.trim() || 'Your Name',
  })
}
