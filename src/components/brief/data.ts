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
import { useUser, useQuery, useMutations, getAuthToken, type RecordData } from 'deepspace'
import type { ApplicationData, ApplicationStage, JobData, MatchData, ProfileData } from '../../types'
import type { MatchMode } from '../../server/match/types'
import { assembleBriefRows, computeBriefStats, needsSponsorship, type BriefRow, type BriefStats } from './helpers'

const QUERY_LIMIT = 5000

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
  recomputing: boolean
  recompute: (mode?: MatchMode) => Promise<void>
  markSeen: (jobId: string) => void
  saveRole: (jobId: string) => Promise<void>
  dismissRole: (jobId: string) => Promise<void>
  markApplied: (jobId: string) => Promise<void>
  appStage: (jobId: string) => ApplicationStage | null
}

async function callAction(name: string, body: Record<string, unknown>): Promise<void> {
  const token = await getAuthToken()
  await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
}

export function useBriefData(): BriefData {
  const { user: authUser } = useUser()
  const matchQ = useQuery<MatchData>('match', { limit: QUERY_LIMIT })
  const jobQ = useQuery<JobData>('job', { limit: QUERY_LIMIT })
  const appQ = useQuery<ApplicationData>('application', { limit: QUERY_LIMIT })
  const profileQ = useQuery<ProfileData>('profile', { limit: 5 })
  const appMut = useMutations<ApplicationData>('application')

  const [recomputing, setRecomputing] = useState(false)
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

  const recompute = useCallback(async (mode: MatchMode = 'full') => {
    setRecomputing(true)
    try {
      await callAction('match-recompute', { mode })
    } finally {
      // Leave a brief "reading" window; live match writes will refill the feed.
      setTimeout(() => setRecomputing(false), 1500)
    }
  }, [])

  // Pool-warming kick: once the profile is ready and there are zero matches,
  // ask Alfred to read the market a single time. Live writes refill the feed.
  useEffect(() => {
    if (kickedRef.current) return
    if (status !== 'ready' || !hasProfile) return
    if (matchQ.records.length > 0) return
    // A completed run that found zero survivors leaves zero match rows but sets
    // profile.last_match_at. Don't re-kick a full recompute on every mount in
    // that case -- show the honest empty state instead. Only warm the pool when
    // NO run has ever completed for this user.
    if (profile?.last_match_at) return
    kickedRef.current = true
    void recompute('full')
  }, [status, hasProfile, matchQ.records.length, profile, recompute])

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
    recomputing,
    recompute,
    markSeen,
    saveRole,
    dismissRole,
    markApplied,
    appStage,
  }
}
