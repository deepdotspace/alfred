/**
 * useTailor -- the client read model + actions for one role's tailoring.
 *
 * Kicks the honest tailoring Job via the `tailor-start` action (userId comes
 * from the verified JWT server-side), observes its status via useJobs, and reads
 * the resulting structured content from the live `generated_doc` rows (useQuery,
 * read 'own'). So the tab/workspace render from the persisted record -- works in
 * dev (no R2 needed) and survives reload. Download re-renders deterministically
 * via `tailor-download` (PDF/DOCX), independent of R2.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useJobs, useQuery, getAuthToken } from 'deepspace'
import { SCOPE_ID } from '../../constants'
import type { CoverDocContent, GeneratedDocData, ResumeDocContent } from '../../types'

export type TailorState = 'idle' | 'working' | 'ready' | 'error'

const WORKING_STEPS = ['Reading the posting...', 'Matching to your experience...', 'Writing in your voice...']
const REFINE_STEPS_NOTE = ['Re-reading the posting...', 'Applying your notes...', 'Rewriting in your voice...']
const REFINE_STEPS_AUTO = ['Re-reading the posting...', 'Finding a sharper angle...', 'Rewriting in your voice...']

async function callAction<T = unknown>(name: string, body: Record<string, unknown>): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getAuthToken()
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return (await res.json().catch(() => ({ success: false, error: 'bad response' }))) as { success: boolean; data?: T; error?: string }
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export interface UseTailor {
  state: TailorState
  /** Cycling mono status while working. */
  statusText: string
  /** A re-run in progress (workspace refining overlay). */
  refining: boolean
  refineStatus: string
  resume: ResumeDocContent | null
  cover: CoverDocContent | null
  gaps: string[]
  coverGated: boolean
  lastRefine: string | null
  error: string | null
  /** Did the resume pass the honesty verify loop? false = some lines could not be verified -> degrade the trust note. */
  verified: boolean
  start: () => void
  refine: (note: string) => void
  download: (type: 'resume' | 'cover_letter', format: 'pdf' | 'docx') => Promise<string>
}

export function useTailor(jobId: string): UseTailor {
  const { getJob } = useJobs(SCOPE_ID)
  const docsQ = useQuery<GeneratedDocData>('generated_doc', { limit: 5000 })

  const [taskId, setTaskId] = useState<string | null>(null)
  const [refining, setRefining] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [refineSteps, setRefineSteps] = useState<string[]>(REFINE_STEPS_AUTO)
  const [lastRefine, setLastRefine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const resumeDoc = useMemo(
    () => docsQ.records.find((r) => r.data.job_id === jobId && r.data.type === 'resume')?.data ?? null,
    [docsQ.records, jobId],
  )
  const coverDoc = useMemo(
    () => docsQ.records.find((r) => r.data.job_id === jobId && r.data.type === 'cover_letter')?.data ?? null,
    [docsQ.records, jobId],
  )

  const job = taskId ? getJob(taskId) : undefined
  const jobStatus = job?.status

  // Derive coverGated: a resume doc exists but no cover doc -> gated (the Job
  // only writes a cover row when a writing sample exists).
  const coverGated = !!resumeDoc && !coverDoc

  const state: TailorState = (() => {
    if (jobStatus === 'failed') return 'error'
    if (taskId && (jobStatus === 'queued' || jobStatus === 'running')) return 'working'
    if (resumeDoc) return 'ready'
    if (taskId && jobStatus === 'succeeded') return 'working' // doc row landing
    return 'idle'
  })()

  // Cycle the working/refine status text on a timer (matches the prototype feel).
  useEffect(() => {
    if (state !== 'working' && !refining) {
      setStepIdx(0)
      return
    }
    const id = setInterval(() => setStepIdx((i) => Math.min(i + 1, 2)), 1500)
    return () => clearInterval(id)
  }, [state, refining])

  // Clear refining once the refine task completes and the doc has refreshed.
  useEffect(() => {
    if (refining && (jobStatus === 'succeeded' || jobStatus === 'failed')) {
      // brief grace so the updated doc streams in before the overlay drops
      const id = setTimeout(() => setRefining(false), 400)
      return () => clearTimeout(id)
    }
  }, [refining, jobStatus])

  const start = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setError(null)
    setStepIdx(0)
    void callAction<{ taskId: string }>('tailor-start', { jobId, mode: 'generate' }).then((r) => {
      if (r.success && r.data?.taskId) setTaskId(r.data.taskId)
      else {
        setError(r.error ?? 'Could not start tailoring')
        startedRef.current = false
      }
    })
  }, [jobId])

  const refine = useCallback(
    (note: string) => {
      const trimmed = note.trim()
      setRefineSteps(trimmed ? REFINE_STEPS_NOTE : REFINE_STEPS_AUTO)
      setRefining(true)
      setStepIdx(0)
      setError(null)
      void callAction<{ taskId: string }>('tailor-start', { jobId, mode: 'refine', refineNote: trimmed }).then((r) => {
        if (r.success && r.data?.taskId) {
          setTaskId(r.data.taskId)
          setLastRefine(trimmed ? `Leaned it toward: "${trimmed}"` : 'Freshened the summary and closing with a sharper angle.')
        } else {
          setError(r.error ?? 'Could not refine')
          setRefining(false)
        }
      })
    },
    [jobId],
  )

  const download = useCallback(
    async (type: 'resume' | 'cover_letter', format: 'pdf' | 'docx'): Promise<string> => {
      const r = await callAction<{ base64: string; filename: string; mimeType: string }>('tailor-download', { jobId, type, format })
      if (!r.success || !r.data) throw new Error(r.error ?? 'download failed')
      triggerDownload(base64ToBlob(r.data.base64, r.data.mimeType), r.data.filename)
      return r.data.filename
    },
    [jobId],
  )

  return {
    state,
    statusText: WORKING_STEPS[stepIdx] ?? WORKING_STEPS[0],
    refining,
    refineStatus: refineSteps[stepIdx] ?? refineSteps[0],
    resume: resumeDoc?.content ? (resumeDoc.content as ResumeDocContent) : null,
    cover: coverDoc?.content ? (coverDoc.content as CoverDocContent) : null,
    gaps: resumeDoc?.gaps ?? [],
    coverGated,
    lastRefine,
    error,
    verified: resumeDoc?.verified ?? true,
    start,
    refine,
    download,
  }
}
