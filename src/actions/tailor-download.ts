/**
 * tailor-download -- return a tailored document as base64 for the caller.
 *
 * Re-renders DETERMINISTICALLY from the stored structured content (resume ->
 * LaTeX -> latex-compiler; cover -> LaTeX; either -> .docx). This makes download
 * work in every environment (dev pre-deploy included, where the R2 copy 401s)
 * and on reload, with no R2 dependency. Caller-scoped: only the caller's own
 * generated_doc rows are read (filtered by the verified userId).
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { CoverDocContent, DocType, GeneratedDocData, ResumeDocContent } from '../types'
import { actionInvoker } from '../server/integrations'
import { latexCompile } from '../server/integrations'
import { generateCoverLatex, generateResumeLatex } from '../server/tailor/latex'
import { buildCoverDocx, buildResumeDocx } from '../server/tailor/docx'

interface DocEnvelope {
  recordId: string
  data: GeneratedDocData
}

function safeName(s: string): string {
  return (s || 'document').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document'
}

export const tailorDownload: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const jobId = typeof params?.jobId === 'string' ? params.jobId : ''
  const type: DocType = params?.type === 'cover_letter' ? 'cover_letter' : 'resume'
  const format = params?.format === 'docx' ? 'docx' : 'pdf'
  if (!jobId) return { success: false, error: 'jobId required' }

  const q = await tools.query('generated_doc', { where: { user_id: userId }, limit: 5000 })
  if (!q.success) return { success: false, error: 'could not load document' }
  const rows = (q.data as unknown as { records: DocEnvelope[] }).records ?? []
  const mine = rows.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId && r.data?.type === type)
  if (!mine?.data?.content) return { success: false, error: 'document not found' }

  const content = mine.data.content
  const isResume = type === 'resume'
  const who = isResume ? (content as ResumeDocContent).name : (content as CoverDocContent).signature
  const filename = `${safeName(who)}-${isResume ? 'resume' : 'cover-letter'}.${format}`

  if (format === 'docx') {
    const base64 = isResume ? buildResumeDocx(content as ResumeDocContent) : buildCoverDocx(content as CoverDocContent)
    return {
      success: true,
      data: { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    }
  }

  const latex = isResume ? generateResumeLatex(content as ResumeDocContent) : generateCoverLatex(content as CoverDocContent)
  const res = await latexCompile(actionInvoker(tools), { document: latex })
  if (!res.compiled || !res.pdfBase64) {
    return { success: false, error: `render failed: ${res.error ?? 'unknown'}` }
  }
  return { success: true, data: { base64: res.pdfBase64, filename, mimeType: 'application/pdf' } }
}
