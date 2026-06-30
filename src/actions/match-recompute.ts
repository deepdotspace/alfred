/**
 * match-recompute -- enqueue a FULL re-match for the signed-in caller.
 *
 * The on-demand "read the market for me again" path: profile changes and the
 * brief's pool-warming kick call this. It only ever matches the CALLER (userId
 * comes from the verified JWT, never params), so a user cannot recompute for
 * someone else. The work runs in the background match-user Job (owner context,
 * owner-billed Haiku ~$0.02-0.05).
 */
import type { ActionHandler } from 'deepspace/worker'
import { enqueueJob } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { MatchMode } from '../server/match/types'

export const matchRecompute: ActionHandler<Env> = async ({ userId, params, env }) => {
  const mode: MatchMode = params?.mode === 'incremental' ? 'incremental' : 'full'
  const jobId = await enqueueJob(
    env.JOB_ROOMS,
    `app:${env.APP_NAME}`,
    'match-user',
    { userId, mode },
    { maxAttempts: 1, enqueuedBy: userId },
  )
  return { success: true, data: { jobId, mode } }
}
