/**
 * useBriefData -- the brief's read model + write actions.
 *
 * Joins the user's `match` verdicts (server-written, read 'own') with the shared
 * `job` pool and the user's `application` rows, orders the feed
 * (qualify yes>stretch, then score, then recency), and exposes the save /
 * dismiss / apply / mark-seen / recompute actions. All four record queries are
 * realtime (useQuery), so the brief updates live as the match Job writes rows.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser, useQuery, useMutations, useJobs, getAuthToken, type RecordData } from 'deepspace'
import type { ApplicationData, ApplicationStage, JobData, MatchData, ProfileData } from '../../types'
import type { MatchMode, MatchPayload } from '../../server/match/types'
import { SCOPE_ID } from '../../constants'
import { deriveSearchState, findLiveMatchJob, type SearchState } from './search'
import { assembleBriefRows, computeBriefStats, needsSponsorship, type BriefRow, type BriefStats } from './helpers'

const QUERY_LIMIT = 5000

/**
 * How long to hold the "searching" state after enqueueing, while waiting for the
 * JobRoom to report the new job. Bounded, so a dropped enqueue can never pin the
 * brief in a search that isn't happening.
 */
const KICK_GRACE_MS = 10_000

export type { BriefRow }

export interface BriefUser {
  id: string
  name: string
  firstName: string
  initial: string
}

export interface BriefData {
  status: 'loading' | 'ready'
  hasProfile: boolean
  user: BriefUser | null
  rows: BriefRow[]
  stats: BriefStats
  needsSponsor: boolean
  /** The live match run, read from the Job itself. See ./search. */
  search: SearchState
  recompute: (mode?: MatchMode) => Promise<void>
  markSeen: (jobId: string) => void
  saveRole: (jobId: string) => Promise<void>
  dismissRole: (jobId: string) => Promise<void>
  markApplied: (jobId: string) => Promise<void>
  appStage: (jobId: string) => ApplicationStage | null
}

async function callAction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getAuthToken()
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return (await res.json().catch(() => ({ success: false, error: 'bad response' }))) as {
    success: boolean
    data?: T
    error?: string
  }
}

export function useBriefData(): BriefData {
  const { user: authUser } = useUser()
  const matchQ = useQuery<MatchData>('match', { limit: QUERY_LIMIT })
  const jobQ = useQuery<JobData>('job', { limit: QUERY_LIMIT })
  const appQ = useQuery<ApplicationData>('application', { limit: QUERY_LIMIT })
  const profileQ = useQuery<ProfileData>('profile', { limit: 5 })
  const appMut = useMutations<ApplicationData>('application')
  // The match run is a background Job; watch it rather than guessing at it.
  const { jobs: roomJobs, getJob, connected: jobsConnected } = useJobs<MatchPayload>(SCOPE_ID)

  const [taskId, setTaskId] = useState<string | null>(null)
  const [kicking, setKicking] = useState(false)
  const kickedRef = useRef(false)

  const profile = profileQ.records[0]?.data ?? null
  const needsSponsor = needsSponsorship(profile?.targeting?.work_authorization)

  const jobById = useMemo(() => {
    const m = new Map<string, JobData>()
    for (const r of jobQ.records) m.set(r.recordId, r.data)
    return m
  }, [jobQ.records])

  const appByJob = useMemo(() => {
    const m = new Map<string, RecordData<ApplicationData>>()
    for (const r of appQ.records) {
      const jid = r.data?.job_id
      if (jid) m.set(jid, r)
    }
    return m
  }, [appQ.records])

  const dismissedJobIds = useMemo(() => {
    const s = new Set<string>()
    for (const [jid, rec] of appByJob) if (rec.data.stage === 'dismissed') s.add(jid)
    return s
  }, [appByJob])

  const matches = useMemo(() => matchQ.records.map((r) => r.data), [matchQ.records])

  const rows = useMemo<BriefRow[]>(
    () => assembleBriefRows(matches, jobById, dismissedJobIds),
    [matches, jobById, dismissedJobIds],
  )

  const jobs = useMemo(() => jobQ.records.map((r) => r.data), [jobQ.records])

  const stats = useMemo(
    () => computeBriefStats(matches, rows, jobs, profile?.targeting?.role_families, Date.now(), !!profile?.last_match_at),
    [matches, rows, jobs, profile],
  )

  const status: 'loading' | 'ready' =
    matchQ.status === 'loading' || jobQ.status === 'loading' || profileQ.status === 'loading' ? 'loading' : 'ready'
  const hasProfile = profileQ.status === 'ready' && !!profile

  const user: BriefUser | null = authUser
    ? {
        id: authUser.id,
        name: authUser.name ?? '',
        firstName: (authUser.name ?? '').trim().split(/\s+/)[0] || 'there',
        initial: ((authUser.name ?? 'A').trim().charAt(0) || 'A').toUpperCase(),
      }
    : null

  // The user's live match run. Recovered from the JobRoom, not from local state,
  // so a reload mid-run rejoins the SAME run: without this the brief would see
  // no matches, conclude nothing had started, and enqueue a second (owner-billed)
  // run over the same 80 postings.
  const liveJob = useMemo(() => findLiveMatchJob(roomJobs, user?.id ?? null), [roomJobs, user?.id])
  const startedJob = taskId ? getJob(taskId) : undefined
  const activeJob = liveJob ?? startedJob
  const searchFailed = startedJob?.status === 'failed' || startedJob?.status === 'canceled'

  const search = useMemo(
    () => deriveSearchState({ job: activeJob, kicking, failed: searchFailed }),
    [activeJob, kicking, searchFailed],
  )

  // Hold "searching" from the POST until the room reports the job, so the brief
  // never blinks back to an empty state in the gap. Bounded by KICK_GRACE_MS.
  useEffect(() => {
    if (!kicking) return
    if (activeJob) {
      setKicking(false)
      return
    }
    const t = setTimeout(() => setKicking(false), KICK_GRACE_MS)
    return () => clearTimeout(t)
  }, [kicking, activeJob])

  const recompute = useCallback(async (mode: MatchMode = 'full') => {
    setKicking(true)
    try {
      const res = await callAction<{ jobId?: string }>('match-recompute', { mode })
      // Keep the jobId. The whole point: this is how the brief knows the search
      // is still running, instead of assuming it finished after a fixed delay.
      if (res.data?.jobId) setTaskId(res.data.jobId)
      else setKicking(false)
    } catch {
      setKicking(false)
    }
  }, [])

  // First-run kick: once the profile is ready and there are zero matches, ask
  // Alfred to read the market a single time. Live writes refill the feed.
  useEffect(() => {
    if (kickedRef.current) return
    if (status !== 'ready' || !hasProfile) return
    // Wait for the JobRoom snapshot before concluding nothing is running -- on a
    // reload mid-run the running job arrives with it.
    if (!jobsConnected) return
    if (activeJob) {
      kickedRef.current = true
      return
    }
    if (matchQ.records.length > 0) return
    // A completed run that found zero survivors leaves zero match rows but sets
    // profile.last_match_at. Don't re-kick a full recompute on every mount in
    // that case -- show the honest empty state instead. Only warm the pool when
    // NO run has ever completed for this user.
    if (profile?.last_match_at) return
    kickedRef.current = true
    void recompute('full')
  }, [status, hasProfile, jobsConnected, activeJob, matchQ.records.length, profile, recompute])

  const markSeen = useCallback((jobId: string) => {
    void callAction('match-mark-seen', { jobId })
  }, [])

  const buildApp = useCallback(
    (jobId: string, stage: ApplicationStage, appliedAt: string | null): ApplicationData => {
      const now = new Date().toISOString()
      return {
        user_id: user?.id ?? '',
        job_id: jobId,
        stage,
        resume_doc_id: null,
        cover_letter_doc_id: null,
        applied_at: appliedAt,
        notes: '',
        created_at: now,
        updated_at: now,
      }
    },
    [user?.id],
  )

  const upsertApp = useCallback(
    async (jobId: string, stage: ApplicationStage, appliedAt: string | null = null) => {
      const existing = appByJob.get(jobId)
      const now = new Date().toISOString()
      if (existing) {
        await appMut.put(existing.recordId, {
          stage,
          updated_at: now,
          ...(appliedAt ? { applied_at: appliedAt } : {}),
        })
      } else {
        await appMut.create(buildApp(jobId, stage, appliedAt))
      }
    },
    [appByJob, appMut, buildApp],
  )

  const saveRole = useCallback(
    async (jobId: string) => {
      const existing = appByJob.get(jobId)
      if (existing && existing.data.stage !== 'dismissed') return // already tracked
      await upsertApp(jobId, 'saved')
    },
    [appByJob, upsertApp],
  )

  const dismissRole = useCallback((jobId: string) => upsertApp(jobId, 'dismissed'), [upsertApp])

  const markApplied = useCallback(
    (jobId: string) => upsertApp(jobId, 'applied', new Date().toISOString()),
    [upsertApp],
  )

  const appStage = useCallback(
    (jobId: string): ApplicationStage | null => appByJob.get(jobId)?.data.stage ?? null,
    [appByJob],
  )

  return {
    status,
    hasProfile,
    user,
    rows,
    stats,
    needsSponsor,
    search,
    recompute,
    markSeen,
    saveRole,
    dismissRole,
    markApplied,
    appStage,
  }
}
