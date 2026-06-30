/**
 * Deterministic rendering: structured content -> LaTeX -> latex-compiler -> PDF
 * with real selectable text, plus ONE-PAGE enforcement.
 *
 * Page counting: the LaTeX preamble disables PDF object-stream compression
 * (\pdfobjcompresslevel=0), so each page is emitted as an uncompressed object
 * and `/Type /Page` can be counted from the bytes. If the resume spills to 2
 * pages we trim the lowest-relevance content (last project bullet -> last
 * project -> trailing experience bullets -> last experience) and re-render,
 * keeping the STORED content identical to what the PDF shows.
 *
 * ALWAYS verify compiled === true before using a result (latex-compiler gotcha).
 */
import type { CoverDocContent, ResumeDocContent } from '../../types'
import { latexCompile, type IntegrationInvoke } from '../integrations'
import { generateCoverLatex, generateResumeLatex } from './latex'
import type { RenderResult } from './types'

/** Count PDF pages from base64 bytes (object-stream compression is off). */
export function countPdfPages(pdfBase64: string): number {
  let bin: string
  try {
    bin = atob(pdfBase64)
  } catch {
    return 1
  }
  const pages = bin.match(/\/Type\s*\/Page(?!s)/g)
  if (pages && pages.length > 0) return pages.length
  // Fallback: the page-tree root carries the total in /Count.
  const m = bin.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/) || bin.match(/\/Count\s+(\d+)\s*\/Type\s*\/Pages/)
  return m ? Math.max(1, parseInt(m[1], 10)) : 1
}

function base64Bytes(b64: string): number {
  // Decoded length without the padding inflation.
  const len = b64.length
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - pad
}

/**
 * Trim one increment of the lowest-relevance content. Returns a NEW content if
 * something could be trimmed, else null (nothing left to safely cut).
 */
function trimResume(content: ResumeDocContent): ResumeDocContent | null {
  const c: ResumeDocContent = {
    ...content,
    experience: content.experience.map((x) => ({ ...x, bullets: [...x.bullets] })),
    projects: content.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
  }

  // 1) Drop a bullet from the last project (if it has more than one).
  for (let i = c.projects.length - 1; i >= 0; i--) {
    if (c.projects[i].bullets.length > 1) {
      c.projects[i].bullets.pop()
      return c
    }
  }
  // 2) Drop the last project entirely.
  if (c.projects.length > 0) {
    c.projects = c.projects.slice(0, -1)
    return c
  }
  // 3) Trim a trailing bullet off the last experience (keep >= 2).
  for (let i = c.experience.length - 1; i >= 0; i--) {
    if (c.experience[i].bullets.length > 2) {
      c.experience[i].bullets.pop()
      return c
    }
  }
  // 4) Drop the last (least relevant) experience, if more than one remains.
  if (c.experience.length > 1) {
    c.experience = c.experience.slice(0, -1)
    return c
  }
  return null
}

const MAX_TRIM_ROUNDS = 6

/**
 * Render the resume to a one-page PDF. Returns the PDF + page count + the
 * content actually rendered (post-trim). Throws if compilation fails.
 */
export async function renderResumePdf(invoke: IntegrationInvoke, input: ResumeDocContent): Promise<RenderResult> {
  let content = input
  let lastResult: RenderResult | null = null

  for (let attempt = 0; attempt <= MAX_TRIM_ROUNDS; attempt++) {
    const latex = generateResumeLatex(content)
    const res = await latexCompile(invoke, { document: latex })
    if (!res.compiled || !res.pdfBase64) {
      throw new Error(`resume LaTeX compile failed: ${res.error ?? 'unknown error'}`)
    }
    const pages = countPdfPages(res.pdfBase64)
    lastResult = { pdfBase64: res.pdfBase64, pages, latex, content }
    if (pages <= 1) return lastResult

    const trimmed = trimResume(content)
    if (!trimmed) return lastResult // can't trim further; return the best we have
    content = trimmed
  }
  return lastResult as RenderResult
}

/** Render the cover letter to a PDF (one page expected; not force-trimmed). */
export async function renderCoverPdf(invoke: IntegrationInvoke, content: CoverDocContent): Promise<{ pdfBase64: string; pages: number }> {
  const latex = generateCoverLatex(content)
  const res = await latexCompile(invoke, { document: latex })
  if (!res.compiled || !res.pdfBase64) {
    throw new Error(`cover LaTeX compile failed: ${res.error ?? 'unknown error'}`)
  }
  return { pdfBase64: res.pdfBase64, pages: countPdfPages(res.pdfBase64) }
}

export { base64Bytes }
