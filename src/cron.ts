/**
 * Cron tasks (AppCronRoom -> runTask). Cron stays LIGHT: it only ENQUEUES the
 * ingest Job, never fans out inline. The Job does the chunked, ceiling-safe work.
 *
 * IMPORTANT: the CronRoom DO never auto-arms -- worker.ts pokes it (the warmer
 * middleware) so the alarm actually fires. Without that, lastRunAt stays null
 * and the pool stays empty in prod with everything else green.
 *
 * See INGEST-PLAN.md section 5.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext, enqueueJob } from 'deepspace/worker'
import type { Env } from '../worker'
import type { IngestPayload, OwnerRecords, Envelope } from './server/ingest/types'
import { loadMeta } from './server/ingest/meta'
import { runDigestCron } from './server/digest/run'
import type { ProfileData } from './types'

export const tasks: CronTask[] = [
  // Every 30 min: SimplifyJobs + SpeedyApply (free) + the first-run/once-a-day
  // firecrawl+exa (guarded inside the Job). Skips the heavy ATS sweep.
  { name: 'ingest-delta', intervalMinutes: 30 },
  // Weekly full sweep (60-day window, full ATS slug universe). Mon 04:00 ET.
  { name: 'ingest-backfill', schedule: '0 4 * * 1', timezone: 'America/New_York' },
  // Daily: refresh each active user's brief by enqueuing an INCREMENTAL match
  // (scores only jobs the user has no verdict for yet -> picks up new pool jobs
  // cheaply). 05:00 ET, after the weekly backfill window. On-demand FULL
  // recomputes (profile changes) go through the match-recompute action.
  { name: 'match-refresh', schedule: '0 5 * * *', timezone: 'America/New_York' },
  // Daily morning brief: send each due user their digest of NEW qualified
  // matches. Runs after match-refresh so overnight verdicts are in. Per-user
  // cadence (daily/weekly) + idempotency are enforced inside runDigestCron via
  // the digest_state cursor; this single 07:00 ET task covers both cadences.
  { name: 'digest', schedule: '0 7 * * *', timezone: 'America/New_York' },
]

async function enqueueIngest(env: Env, payload: IngestPayload): Promise<void> {
  await enqueueJob(env.JOB_ROOMS, `app:${env.APP_NAME}`, 'ingest-pool', payload, {
    maxAttempts: 1,
    enqueuedBy: 'cron',
  })
}

export async function runTask(name: string, env: Env): Promise<void> {
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  const records = ctx.records as unknown as OwnerRecords

  if (name === 'ingest-delta') {
    // First-run guard: if no backfill has happened yet, kick a one-time backfill
    // so the pool fills on first deploy instead of next Monday.
    const meta = await loadMeta(records)
    if (!meta || meta.data.backfilled !== true) {
      await enqueueIngest(env, { mode: 'backfill', windowDays: 60 })
      return
    }
    await enqueueIngest(env, { mode: 'delta', windowDays: 1 })
    return
  }

  if (name === 'ingest-backfill') {
    await enqueueIngest(env, { mode: 'backfill', windowDays: 60 })
    return
  }

  if (name === 'match-refresh') {
    // Only fan out when there is a pool to match against.
    const pool = (await records.query('job', { limit: 1 })) as Envelope<unknown>[]
    if (pool.length === 0) return
    const profiles = (await records.query('profile', { limit: 5000 })) as Envelope<ProfileData>[]
    const seen = new Set<string>()
    for (const p of profiles) {
      const userId = p.data?.user_id
      if (!userId || seen.has(userId)) continue
      seen.add(userId)
      await enqueueJob(env.JOB_ROOMS, `app:${env.APP_NAME}`, 'match-user', { userId, mode: 'incremental' }, {
        maxAttempts: 1,
        enqueuedBy: 'cron',
      })
    }
    return
  }
}
