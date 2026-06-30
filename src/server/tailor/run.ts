/**
 * Tailoring orchestrator -- the full honest pipeline end to end.
 *
 *   load profile + job -> (enrich JD if missing) -> resume pipeline
 *   (generate -> verify -> regen -> re-verify) -> render one-page PDF -> build
 *   .docx -> [cover pipeline, gated on a writing sample] -> store binaries in R2
 *   (best-effort; scope=self) -> upsert generated_doc rows (with structured
 *   content + verified + gaps).
 *
 * Two entry points share the same pipeline:
 *   - runTailorJob   : the background tailor-doc Job (writes rows, stores R2).
 *   - previewTailor  : a bounded inline run for the dev proof (NO writes), so
 *                      the verify loop (first-pass flags -> clean re-verify) and
 *                      the one-page PDF can be proven like the spike.
 */
import { platformWorkerFetch } from 'deepspace/worker'
import type { ApplicationData, GeneratedDocData, JobData, ProfileData } from '../../types'
import { firecrawlScrape, type IntegrationInvoke } from '../integrations'
import { generateResumeRaw, assembleResume } from './generate'
import { buildJobContext, buildMasterContext, buildVoiceSample } from './context'
import { verifyResume } from './verify'
import type { VerifyReport } from './types'
import { runCoverPipeline, runResumePipeline } from './pipeline'
import { buildCoverDocx, buildResumeDocx } from './docx'
import { base64Bytes, renderCoverPdf, renderResumePdf } from './render'
import type {
  CoverResult,
  Envelope,
  OwnerRecords,
  ResumeResult,
  TailorCtx,
  TailorJobResult,
  TailorPayload,
  TailorPreviewResult,
} from './types'
import { hasWritingSample } from './types'

const POOL_LIMIT = 20_000

/* --------------------------------------------------------------- loads */

export async function loadProfileFor(records: OwnerRecords, userId: string): Promise<ProfileData | null> {
  const rows = (await records.query('profile', { where: { user_id: userId }, limit: 500 })) as Envelope<ProfileData>[]
  return rows.find((r) => r.data?.user_id === userId)?.data ?? null
}

export async function loadJobById(records: OwnerRecords, jobId: string): Promise<JobData | null> {
  const rows = (await records.query('job', { limit: POOL_LIMIT })) as Envelope<JobData>[]
  return rows.find((r) => r.recordId === jobId)?.data ?? null
}

/** If the job has no JD text, scrape the apply URL once (best-effort enrichment). */
async function ensureJobDescription(invoke: IntegrationInvoke, job: JobData): Promise<JobData> {
  if (job.description_text && job.description_text.trim().length > 120) return job
  if (!job.apply_url) return job
  try {
    const doc = await firecrawlScrape(invoke, { url: job.apply_url, formats: ['markdown'], onlyMainContent: true })
    const md = doc.markdown?.trim()
    if (md && md.length > 120) return { ...job, description_text: md.slice(0, 6000) }
  } catch {
    // best-effort; tailoring still works from the title + key skills
  }
  return job
}

/* --------------------------------------------------------------- proof */

function verifySummary(resume: ResumeResult, cover: CoverResult | null) {
  return {
    resumeFirstFlagged: resume.rounds[0]?.report.flagged.length ?? 0,
    resumeClean: resume.clean,
    coverFirstFlagged: cover?.rounds[0]?.report.flagged.length ?? 0,
    coverClean: cover?.clean ?? true,
  }
}

/* --------------------------------------------------------------- probe */

/**
 * Deterministic proof that the skeptic catches dishonesty: feed a deliberately
 * EMBELLISHED draft (claims absent from the real profile) to the verifier and
 * return its report. Used by the dev proof so "the verify loop flags
 * embellishment" is shown every run, regardless of whether a given live
 * generation happens to start clean.
 */
export async function probeVerifier(ctx: TailorCtx, userId: string): Promise<{ report: VerifyReport }> {
  if (!ctx.invoke) throw new Error('probeVerifier requires an integration invoker')
  const profile = await loadProfileFor(ctx.records, userId)
  if (!profile) throw new Error('no profile for user')
  const master = buildMasterContext(profile)
  const embellished = JSON.stringify({
    role: 'Senior Staff Engineer',
    summary: 'Senior engineer with 6 years of experience leading platform teams and shipping ML systems at scale.',
    experience: [
      {
        org: 'DeepSpace',
        title: 'Senior Software Engineer',
        bullets: [
          'Architected a Kubernetes microservices platform serving 10M+ daily active users with 99.99% uptime.',
          'Led a team of 8 engineers using Agile and Scrum to deliver a GraphQL API.',
          'Built and deployed TensorFlow deep-learning models to production for recommendation ranking.',
        ],
      },
    ],
    projects: [],
    skills: [{ category: 'Languages', items: ['Go', 'Rust', 'Scala'] }],
  })
  const report = await verifyResume(ctx.invoke, master, embellished)
  return { report }
}

/* --------------------------------------------------------------- preview */

export interface PreviewOpts {
  /** Inject a voice sample so the cover pipeline can be proven without persisting one. */
  injectWritingSample?: string
  /** Prove ONLY the cover pipeline (skip the resume verify/render) -- lighter. */
  coverOnly?: boolean
}

/** Inline, NO-WRITE run: proves the verify loop + one-page PDF (the dev proof). */
export async function previewTailor(ctx: TailorCtx, userId: string, jobId: string, opts: PreviewOpts = {}): Promise<TailorPreviewResult> {
  if (!ctx.invoke) throw new Error('previewTailor requires an integration invoker')
  const profile = await loadProfileFor(ctx.records, userId)
  if (!profile) throw new Error('no profile for user')
  let job = await loadJobById(ctx.records, jobId)
  if (!job) throw new Error('job not found')
  job = await ensureJobDescription(ctx.invoke, job)

  const master = buildMasterContext(profile)
  const jobCtx = buildJobContext(job)

  // Lighter cover-only proof: one resume generate for gaps, then the cover loop.
  if (opts.coverOnly) {
    const rawResume = await generateResumeRaw(ctx.invoke, master, jobCtx)
    const assembled = assembleResume(rawResume, profile, job)
    const voiceSample = opts.injectWritingSample?.trim() || buildVoiceSample(profile)
    const cover = await runCoverPipeline(ctx.invoke, master, jobCtx, profile, job, { voiceSample, gaps: assembled.gaps })
    return {
      job: { title: job.title, company: job.company },
      resume: { content: assembled.content, gaps: assembled.gaps, rounds: [], clean: true },
      cover,
      coverGated: false,
      render: { pages: 0, pdfBytes: 0, onePage: false },
    }
  }

  ctx.onProgress?.(0.15, 'Reading the posting...')
  const resume = await runResumePipeline(ctx.invoke, master, jobCtx, profile, job, { mode: 'generate' })

  ctx.onProgress?.(0.55, 'Rendering your resume...')
  const render = await renderResumePdf(ctx.invoke, resume.content)
  resume.content = render.content

  const voiceSample = opts.injectWritingSample?.trim() || buildVoiceSample(profile)
  const gated = !opts.injectWritingSample && !hasWritingSample(profile)
  let cover: CoverResult | null = null
  if (!gated) {
    ctx.onProgress?.(0.8, 'Writing in your voice...')
    cover = await runCoverPipeline(ctx.invoke, master, jobCtx, profile, job, { voiceSample, gaps: resume.gaps })
  }

  return {
    job: { title: job.title, company: job.company },
    resume,
    cover,
    coverGated: gated,
    render: { pages: render.pages, pdfBytes: base64Bytes(render.pdfBase64), onePage: render.pages <= 1 },
  }
}

/* --------------------------------------------------------------- job run */

/** Minimal env shape for the best-effort R2 store (matches the worker Env). */
interface R2Env {
  PLATFORM_WORKER?: { fetch: (req: Request) => Promise<Response> }
  PLATFORM_WORKER_URL?: string
  APP_IDENTITY_TOKEN?: string
  APP_NAME: string
}

/**
 * Best-effort R2 upload (scope=self). Returns the file url, or null on failure
 * (e.g. dev pre-deploy where APP_IDENTITY_TOKEN is absent -> 401). The download
 * action re-renders deterministically, so a null here never breaks downloads.
 */
async function storeR2(env: R2Env, userId: string, key: string, base64: string, mimeType: string): Promise<string | null> {
  if (!env.APP_IDENTITY_TOKEN) return null
  try {
    const base = (env.PLATFORM_WORKER_URL ?? 'https://platform').replace(/\/$/, '')
    const res = await platformWorkerFetch(
      env as never,
      new Request(`${base}/internal/files/upload?scope=self`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-app-identity-token': env.APP_IDENTITY_TOKEN,
          'x-app-name': env.APP_NAME,
          'x-user-id': userId,
        },
        body: JSON.stringify({ data: base64, name: key, mimeType }),
      }),
    )
    if (!res.ok) return null
    const body = (await res.json().catch(() => ({}))) as { url?: string; key?: string }
    return body.url ?? (body.key ? `/api/files/${body.key}` : null)
  } catch {
    return null
  }
}

/* ------------------------------------------------------ in-flight marker */

/**
 * Clear the in-flight tailor marker on the (user, job) application row that the
 * `tailor-start` action stamped before enqueue. Called when the tailor job
 * finishes (success OR failure) so the idempotency guard reflects only live runs
 * and a legitimate retry is never blocked. Best-effort: the action's TTL guard
 * covers a missed clear (e.g. a crashed run that never reached this point).
 */
export async function clearTailorMarker(records: OwnerRecords, userId: string, jobId: string): Promise<void> {
  try {
    const rows = (await records.query('application', { where: { user_id: userId }, limit: 5000 })) as Envelope<ApplicationData>[]
    const mine = rows.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId)
    if (mine?.data?.tailor_task_id) {
      await records.update('application', mine.recordId, {
        tailor_task_id: null,
        tailor_started_at: null,
      } as unknown as Record<string, unknown>)
    }
  } catch {
    // best-effort; the tailor-start TTL guard covers a missed clear
  }
}

/* ----------------------------------------------------------- doc upsert */

async function upsertGeneratedDoc(
  records: OwnerRecords,
  userId: string,
  jobId: string,
  row: Omit<GeneratedDocData, 'user_id' | 'job_id' | 'created_at'>,
): Promise<string> {
  const existing = (await records.query('generated_doc', { where: { user_id: userId }, limit: 5000 })) as Envelope<GeneratedDocData>[]
  const mine = existing.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId && r.data?.type === row.type)
  const now = new Date().toISOString()
  if (mine) {
    await records.update('generated_doc', mine.recordId, { ...row } as unknown as Record<string, unknown>)
    return mine.recordId
  }
  const created = (await records.create('generated_doc', {
    user_id: userId,
    job_id: jobId,
    created_at: now,
    ...row,
  } as unknown as Record<string, unknown>)) as Envelope<unknown> | { recordId?: string }
  return (created as { recordId?: string }).recordId ?? ''
}

/** The full tailor-doc Job: runs the pipeline, renders, stores, writes rows. */
export async function runTailorJob(ctx: TailorCtx, payload: TailorPayload, env: R2Env): Promise<TailorJobResult> {
  if (!ctx.invoke) throw new Error('runTailorJob requires an integration invoker')
  const { userId, jobId, mode, refineNote } = payload

  const profile = await loadProfileFor(ctx.records, userId)
  if (!profile) throw new Error('no profile for user')
  let job = await loadJobById(ctx.records, jobId)
  if (!job) throw new Error('job not found')

  ctx.onProgress?.(0.1, 'Reading the posting...')
  job = await ensureJobDescription(ctx.invoke, job)
  const master = buildMasterContext(profile)
  const jobCtx = buildJobContext(job)

  // For a refine, start from the existing resume content if present.
  let previousJson: string | undefined
  if (mode === 'refine') {
    const existing = (await ctx.records.query('generated_doc', { where: { user_id: userId }, limit: 5000 })) as Envelope<GeneratedDocData>[]
    const prior = existing.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId && r.data?.type === 'resume')
    if (prior?.data?.content) previousJson = JSON.stringify(prior.data.content)
  }

  ctx.onProgress?.(0.3, 'Matching to your experience...')
  const resume = await runResumePipeline(ctx.invoke, master, jobCtx, profile, job, {
    mode,
    note: refineNote,
    previousJson,
  })

  ctx.onProgress?.(0.6, 'Shaping a one-page resume...')
  const render = await renderResumePdf(ctx.invoke, resume.content)
  resume.content = render.content
  const resumeDocx = buildResumeDocx(resume.content)

  // Cover letter: gated on a writing sample existing (DATA-MODEL decision 9).
  const gated = !hasWritingSample(profile)
  let cover: CoverResult | null = null
  let coverDocx: string | null = null
  let coverPdf: { pdfBase64: string; pages: number } | null = null
  if (!gated) {
    ctx.onProgress?.(0.8, 'Writing in your voice...')
    cover = await runCoverPipeline(ctx.invoke, master, jobCtx, profile, job, {
      voiceSample: buildVoiceSample(profile),
      gaps: resume.gaps,
      note: mode === 'refine' ? refineNote : undefined,
    })
    coverPdf = await renderCoverPdf(ctx.invoke, cover.content)
    coverDocx = buildCoverDocx(cover.content)
  }

  // Store binaries (best-effort; download re-renders deterministically regardless).
  ctx.onProgress?.(0.92, 'Saving your documents...')
  const resumePdfUrl = await storeR2(env, userId, `tailor/${jobId}/resume.pdf`, render.pdfBase64, 'application/pdf')
  const resumeDocxUrl = await storeR2(
    env,
    userId,
    `tailor/${jobId}/resume.docx`,
    resumeDocx,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )

  const resumeDocId = await upsertGeneratedDoc(ctx.records, userId, jobId, {
    type: 'resume',
    template: 'jakes',
    r2_key: `tailor/${jobId}/resume.pdf`,
    pdf_url: resumePdfUrl,
    docx_url: resumeDocxUrl,
    verified: resume.clean,
    gaps: resume.gaps,
    content: resume.content,
  })

  let coverDocId: string | null = null
  if (cover && coverPdf) {
    const coverPdfUrl = await storeR2(env, userId, `tailor/${jobId}/cover.pdf`, coverPdf.pdfBase64, 'application/pdf')
    const coverDocxUrl = coverDocx
      ? await storeR2(env, userId, `tailor/${jobId}/cover.docx`, coverDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      : null
    coverDocId = await upsertGeneratedDoc(ctx.records, userId, jobId, {
      type: 'cover_letter',
      template: 'letter',
      r2_key: `tailor/${jobId}/cover.pdf`,
      pdf_url: coverPdfUrl,
      docx_url: coverDocxUrl,
      verified: cover.clean,
      gaps: [],
      content: cover.content,
    })
  }

  ctx.onProgress?.(1, 'Ready.')
  return {
    resumeDocId,
    coverDocId,
    coverGated: gated,
    gaps: resume.gaps,
    pages: render.pages,
    onePage: render.pages <= 1,
    verified: resume.clean,
    verifySummary: verifySummary(resume, cover),
  }
}
