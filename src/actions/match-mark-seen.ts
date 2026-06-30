/**
 * match-mark-seen -- clear a match's NEW badge (set seen=true).
 *
 * `match` is server-written (no client create/update/delete), so the brief
 * cannot flip `seen` with a client mutation. This action does the privileged
 * write, scoped defensively to the caller's own row.
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { MatchData } from '../types'

interface QueryEnvelope<T> {
  recordId: string
  data: T
}

export const matchMarkSeen: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const jobId = typeof params?.jobId === 'string' ? params.jobId : ''
  if (!jobId) return { success: false, error: 'jobId required' }

  const q = await tools.query('match', { where: { user_id: userId, job_id: jobId }, limit: 5 })
  if (!q.success) return q
  const rows = (q.data as unknown as { records: QueryEnvelope<MatchData>[] }).records ?? []
  const mine = rows.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId)
  if (!mine) return { success: true, data: { updated: false } }
  if (mine.data.seen === true) return { success: true, data: { updated: false } }

  const res = await tools.update('match', mine.recordId, { seen: true })
  if (!res.success) return res
  return { success: true, data: { updated: true } }
}
