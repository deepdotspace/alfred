/**
 * useTrackerData -- the kanban board's read model + write actions.
 *
 * Joins the user's `application` rows (owner-scoped, read 'own') with the shared
 * `job` pool, groups them by stage, and exposes advance / dismiss. `dismissed`
 * applications (the brief-feed hide) are filtered OUT of the board entirely; a
 * tracker "dismiss" instead marks the card `rejected` so it lands in the Rejected
 * column. Both record queries are realtime, so the board updates live.
 */
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutations, type RecordData } from 'deepspace'
import type { ApplicationData, ApplicationStage, JobData } from '../../types'
import { nextStage } from './columns'

const QUERY_LIMIT = 5000

export interface TrackerCardRow {
  /** application recordId (the row we mutate). */
  appId: string
  jobId: string
  stage: ApplicationStage
  job: JobData
  /** stable order within a column (newest first). */
  updatedMs: number
}

export interface TrackerData {
  status: 'loading' | 'ready'
  byStage: Map<ApplicationStage, TrackerCardRow[]>
  total: number
  advance: (appId: string, stage: ApplicationStage) => Promise<void>
  dismiss: (appId: string) => Promise<void>
  open: (jobId: string) => void
}

function ms(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

export function useTrackerData(): TrackerData {
  const appQ = useQuery<ApplicationData>('application', { limit: QUERY_LIMIT })
  const jobQ = useQuery<JobData>('job', { limit: QUERY_LIMIT })
  const appMut = useMutations<ApplicationData>('application')
  const navigate = useNavigate()

  const jobById = useMemo(() => {
    const m = new Map<string, RecordData<JobData>>()
    for (const r of jobQ.records) m.set(r.recordId, r)
    return m
  }, [jobQ.records])

  const byStage = useMemo(() => {
    const m = new Map<ApplicationStage, TrackerCardRow[]>()
    for (const r of appQ.records) {
      const app = r.data
      // `dismissed` is the feed-level hide -- never shown on the board.
      if (app.stage === 'dismissed') continue
      const jobRec = jobById.get(app.job_id)
      if (!jobRec) continue
      const row: TrackerCardRow = {
        appId: r.recordId,
        jobId: app.job_id,
        stage: app.stage,
        job: jobRec.data,
        updatedMs: ms(app.updated_at) || ms(app.created_at),
      }
      const list = m.get(app.stage) ?? []
      list.push(row)
      m.set(app.stage, list)
    }
    for (const list of m.values()) list.sort((a, b) => b.updatedMs - a.updatedMs)
    return m
  }, [appQ.records, jobById])

  const total = useMemo(() => {
    let n = 0
    for (const list of byStage.values()) n += list.length
    return n
  }, [byStage])

  const advance = useCallback(
    async (appId: string, stage: ApplicationStage) => {
      const next = nextStage(stage)
      if (!next) return
      const now = new Date().toISOString()
      await appMut.put(appId, {
        stage: next,
        updated_at: now,
        ...(next === 'applied' ? { applied_at: now } : {}),
      })
    },
    [appMut],
  )

  const dismiss = useCallback(
    async (appId: string) => {
      await appMut.put(appId, { stage: 'rejected', updated_at: new Date().toISOString() })
    },
    [appMut],
  )

  const open = useCallback(
    (jobId: string) => {
      // Deep-link the role into the brief. Selecting it there needs brief.tsx to
      // read `?job=` (P4 SEAM); today this lands the user on the brief.
      navigate(`/brief?job=${encodeURIComponent(jobId)}`)
    },
    [navigate],
  )

  const status: 'loading' | 'ready' =
    appQ.status === 'loading' || jobQ.status === 'loading' ? 'loading' : 'ready'

  return { status, byStage, total, advance, dismiss, open }
}
