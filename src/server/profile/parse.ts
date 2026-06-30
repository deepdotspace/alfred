/**
 * Resume parsing (server-side) -- turns uploaded resume file(s) into a single
 * merged, structured master profile, and pre-selects likely ROLE_TAXONOMY
 * families from the content.
 *
 * Extraction path (resolved live, June 2026):
 *  - PDF  -> Anthropic NATIVE document block. The DeepSpace anthropic proxy
 *            forwards arbitrary message content blocks (anthropic.yaml: content
 *            items are passthrough), and Claude reads base64 PDFs directly.
 *            Spiked against the dev proxy with a real resume -> correct read.
 *  - DOCX -> cloudconvert/convert-file (docx -> txt), then a text block. Claude
 *            has no native .docx reader, so we convert first.
 *  - text -> a plain text block (paste / fixtures / fallback).
 *
 * One Haiku call receives ALL sources at once and is instructed to MERGE them
 * (union experience/skills, dedupe) into one profile -- multiple resumes give
 * richer material, one structured output. Honest extraction only: the model is
 * told never to invent skills, titles, dates, employers, or metrics.
 */

import {
  HAIKU_MODEL,
  parseJsonLoose,
  type IntegrationInvoke,
  type AnthropicRaw,
} from '../integrations'
import { ROLE_TAXONOMY, ROLE_FAMILY_IDS } from '../../constants'
import type {
  ProfileBasics,
  EducationEntry,
  WorkEntry,
  ProjectEntry,
  SkillGroup,
} from '../../types'

/* ----------------------------------------------------------------- inputs */

export interface ResumeFileInput {
  name: string
  /** MIME type as reported by the browser (e.g. application/pdf). */
  mime: string
  /** base64 (no data: prefix) of the file bytes. */
  base64: string
}

export interface ParseResumeInput {
  files?: ResumeFileInput[]
  /** Optional raw text resume (paste / fixtures). */
  text?: string
}

/* ---------------------------------------------------------------- outputs */

/** The structured fields the parse pre-fills on the master profile. */
export interface ParsedProfile {
  basics: ProfileBasics
  education: EducationEntry[]
  work: WorkEntry[]
  projects: ProjectEntry[]
  skills: SkillGroup[]
  achievements: string[]
}

export interface ParseResumeResult extends ParsedProfile {
  /** ROLE_TAXONOMY ids to pre-select on the targeting step. */
  suggested_role_families: string[]
  /** 5-7 short "here's what I learned" labels for the done state. */
  chips: string[]
}

/* ----------------------------------------------------------- content blocks */

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }

const isPdf = (f: ResumeFileInput) =>
  f.mime === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')

const isDocx = (f: ResumeFileInput) =>
  f.mime.includes('word') ||
  f.mime.includes('officedocument') ||
  /\.docx?$/.test(f.name.toLowerCase())

/** Decode base64 -> utf-8 text (worker-safe, no Buffer). */
function base64ToText(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function inputFormatFor(file: ResumeFileInput): string {
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf') || file.mime === 'application/pdf') return 'pdf'
  if (n.endsWith('.doc')) return 'doc'
  return 'docx'
}

/**
 * Convert one file to plain text via cloudconvert (pdf/docx/doc -> txt). Returns
 * the converted text, or throws with a readable message on failure.
 */
export async function fileToPlainText(invoke: IntegrationInvoke, file: ResumeFileInput): Promise<string> {
  const res = (await invoke('cloudconvert/convert-file', {
    input_format: inputFormatFor(file),
    output_format: 'txt',
    file: file.base64,
  })) as { downloadUrl?: string }
  if (!res.downloadUrl) throw new Error('cloudconvert returned no downloadUrl')
  const r = await fetch(res.downloadUrl)
  if (!r.ok) throw new Error(`cloudconvert download failed (${r.status})`)
  return (await r.text()).trim()
}

/** Build the message content blocks for all sources. */
async function buildContent(
  invoke: IntegrationInvoke,
  input: ParseResumeInput,
): Promise<AnthropicContentBlock[]> {
  const blocks: AnthropicContentBlock[] = []
  for (const f of input.files ?? []) {
    if (isPdf(f)) {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.base64 } })
    } else if (isDocx(f)) {
      blocks.push({ type: 'text', text: `Resume document "${f.name}":\n\n${await fileToPlainText(invoke, f)}` })
    } else {
      // Unknown binary: best-effort decode as text.
      blocks.push({ type: 'text', text: `Resume document "${f.name}":\n\n${base64ToText(f.base64)}` })
    }
  }
  if (input.text && input.text.trim()) {
    blocks.push({ type: 'text', text: `Resume (text):\n\n${input.text.trim()}` })
  }
  return blocks
}

/* ------------------------------------------------------------------ prompt */

const TAXONOMY_LIST = ROLE_TAXONOMY.map((n) => `${n.id} = ${n.label}`).join('\n')

const SYSTEM = `You are Alfred, a meticulous, honest career butler reading a candidate's resume(s).
Extract a single structured master profile. If the candidate uploaded several resumes, MERGE them into ONE profile: take the union of experience and skills, and de-duplicate.

Rules:
- Extract ONLY what is actually present. Never invent skills, titles, dates, employers, metrics, or links. If a field is absent, use an empty string or empty array.
- Keep bullet points faithful to the resume's wording (light cleanup only).
- Do not use em dashes anywhere in your output.
- For suggested_role_families, choose the role families (by id) that best match this candidate's experience and apparent direction, from EXACTLY this list (use the ids):
${TAXONOMY_LIST}
- chips: 5 to 7 very short labels summarizing what you learned (e.g. the name, a degree+year, top skills, internship count). Each under ~22 characters.

Return ONE raw JSON object, no prose, no code fences, with this exact shape:
{
  "basics": { "name": "", "email": "", "phone": "", "location": "", "links": { "github": "", "linkedin": "", "portfolio": "", "other": [] } },
  "education": [ { "school": "", "degree": "", "field": "", "start": "", "end": "", "gpa": "", "details": [] } ],
  "work": [ { "title": "", "company": "", "location": "", "start": "", "end": "", "bullets": [] } ],
  "projects": [ { "name": "", "description": "", "link": "", "bullets": [] } ],
  "skills": [ { "category": "", "items": [] } ],
  "achievements": [],
  "suggested_role_families": [],
  "chips": []
}`

/* ----------------------------------------------------------- normalization */

/** Strip em dashes from every string (house-rule backstop on AI output). */
function stripEmDashes<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\s*—\s*/g, ', ') as unknown as T
  if (Array.isArray(value)) return value.map((v) => stripEmDashes(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = stripEmDashes(v)
    return out as T
  }
  return value
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

interface RawParsed {
  basics?: Partial<ProfileBasics> & { links?: Partial<ProfileBasics['links']> }
  education?: unknown[]
  work?: unknown[]
  projects?: unknown[]
  skills?: unknown[]
  achievements?: unknown
  suggested_role_families?: unknown
  chips?: unknown
}

function coerce(raw: RawParsed): ParseResumeResult {
  const b = raw.basics ?? {}
  const links: Partial<ProfileBasics['links']> = b.links ?? {}
  const basics: ProfileBasics = {
    name: str(b.name),
    email: str(b.email),
    phone: str(b.phone),
    location: str(b.location),
    links: {
      github: str(links.github),
      linkedin: str(links.linkedin),
      portfolio: str(links.portfolio),
      other: strArr(links.other),
    },
  }
  const education: EducationEntry[] = (raw.education ?? []).map((e) => {
    const x = (e ?? {}) as Record<string, unknown>
    return {
      school: str(x.school),
      degree: str(x.degree),
      field: str(x.field),
      start: str(x.start),
      end: str(x.end),
      gpa: str(x.gpa) || null,
      details: strArr(x.details),
    }
  })
  const work: WorkEntry[] = (raw.work ?? []).map((w) => {
    const x = (w ?? {}) as Record<string, unknown>
    return {
      title: str(x.title),
      company: str(x.company),
      location: str(x.location),
      start: str(x.start),
      end: str(x.end),
      bullets: strArr(x.bullets),
    }
  })
  const projects: ProjectEntry[] = (raw.projects ?? []).map((p) => {
    const x = (p ?? {}) as Record<string, unknown>
    return {
      name: str(x.name),
      description: str(x.description),
      link: str(x.link) || null,
      bullets: strArr(x.bullets),
    }
  })
  const skills: SkillGroup[] = (raw.skills ?? []).map((s) => {
    const x = (s ?? {}) as Record<string, unknown>
    return { category: str(x.category), items: strArr(x.items) }
  })
  const families = strArr(raw.suggested_role_families).filter((id) => ROLE_FAMILY_IDS.includes(id))
  return {
    basics,
    education,
    work,
    projects,
    skills,
    achievements: strArr(raw.achievements),
    suggested_role_families: [...new Set(families)],
    chips: strArr(raw.chips).slice(0, 7),
  }
}

/* ------------------------------------------------------------------- entry */

/** Concatenate all text blocks of an Anthropic response. */
function extractText(raw: AnthropicRaw): string {
  return (raw.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

/**
 * Parse resume file(s) and/or text into a merged structured profile + taxonomy
 * pre-selection. Throws on integration failure or unparseable model output; the
 * caller (action) maps that to a parse-fail result for the UI.
 */
export async function parseResume(
  invoke: IntegrationInvoke,
  input: ParseResumeInput,
): Promise<ParseResumeResult> {
  const content = await buildContent(invoke, input)
  if (content.length === 0) throw new Error('No resume content provided')

  const body: Record<string, unknown> = {
    model: HAIKU_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM,
    messages: [
      { role: 'user', content },
      { role: 'assistant', content: '{' },
    ],
  }
  const raw = (await invoke('anthropic/chat-completion', body)) as AnthropicRaw
  const text = extractText(raw)
  const candidate = text.trimStart().startsWith('{') ? text : `{${text}`
  const parsed = parseJsonLoose<RawParsed>(candidate)
  return stripEmDashes(coerce(parsed))
}
