/**
 * Background-job handlers (AppJobRoom -> runJob). Dispatch on `job.type`; return
 * the result or throw to fail. Long jobs checkpoint with `ctx.continue(state)`
 * and resume on the next alarm with `job.resumeFrom = state`.
 *
 * `ingest-pool` is the shared job-pool ingest (INGEST-PLAN.md). It chunks the
 * full sweep across alarm ticks so it never trips the Worker subrequest ceiling.
 * The JobContext only gives progress/continue/signal, so a SEPARATE owner
 * context is built inside the job for records + owner-billed integrations.
 */

import type { Job, JobContext } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { cronInvoker } from './server/integrations'
import { initialIngestState, ingestProgress, runIngestTick, type IngestCtx } from './server/ingest/run'
import type { IngestPayload, IngestState, OwnerRecords } from './server/ingest/types'
import { initMatchState, runMatchTick } from './server/match/run'
import { encodeMatchProgress } from './server/match/types'
import type { MatchCtx, MatchPayload, MatchState } from './server/match/types'
import { runTailorJob, clearTailorMarker } from './server/tailor/run'
import type { OwnerRecords as TailorRecords, TailorCtx, TailorPayload } from './server/tailor/types'

export async function runJob(job: Job, jobCtx: JobContext, env: Env): Promise<unknown | void> {
  if (job.type === 'tailor-doc') {
    // The honest tailoring pipeline (generate -> verify -> regen -> re-verify ->
    // render one-page PDF -> .docx -> R2 + generated_doc rows). Owner context so
    // it writes generated_doc with an EXPLICIT user_id (server-written, not
    // userBound). Single logical unit (not chunked); ctx.progress drives the
    // "working" status the tailor tab + workspace mirror.
    const payload = job.payload as TailorPayload
    const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
    const ctx: TailorCtx = {
      records: octx.records as unknown as TailorRecords,
      invoke: cronInvoker(octx),
      signal: jobCtx.signal,
      onProgress: (f, m) => jobCtx.progress(f, m),
    }
    try {
      return await runTailorJob(ctx, payload, env)
    } finally {
      // Clear the in-flight tailor marker (set by tailor-start) on completion or
      // failure, so the idempotency guard never blocks a legitimate retry.
      await clearTailorMarker(ctx.records, payload.userId, payload.jobId)
    }
  }

  if (job.type === 'match-user') {
    // Per-user fan-out matcher. Owner context so it can write match rows with an
    // EXPLICIT user_id (match is server-written, not userBound). Chunked across
    // alarm ticks like ingest so it never trips the subrequest ceiling.
    const payload = job.payload as MatchPayload
    const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
    const ctx: MatchCtx = {
      records: octx.records as unknown as OwnerRecords,
      invoke: cronInvoker(octx),
      signal: jobCtx.signal,
    }

    let state = job.resumeFrom as MatchState | undefined
    if (!state) state = await initMatchState(ctx, payload)
    if (jobCtx.signal.aborted) return state.stats

    const { state: next, done } = await runMatchTick(ctx, state)
    // The brief renders its "reading the market" state from these counters, so
    // they are the run's real cursor -- not a cosmetic estimate.
    jobCtx.progress(
      next.jobIds.length ? Math.min(1, next.cursor / next.jobIds.length) : 1,
      encodeMatchProgress({ total: next.jobIds.length, read: next.cursor, kept: next.stats.kept }),
    )
    if (!done) {
      jobCtx.continue(next, { afterMs: 0 })
      return
    }
    return next.stats
  }

  if (job.type === 'ingest-pool') {
    const payload = job.payload as IngestPayload
    const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
    const ctx: IngestCtx = {
      records: octx.records as unknown as OwnerRecords,
      invoke: cronInvoker(octx),
      signal: jobCtx.signal,
    }

    let state = job.resumeFrom as IngestState | undefined
    if (!state) state = initialIngestState(payload)
    if (jobCtx.signal.aborted) return state.stats

    const { state: next, done } = await runIngestTick(ctx, state)
    jobCtx.progress(
      ingestProgress(next),
      `ingest ${next.phase}: created ${next.stats.created}, merged ${next.stats.merged}, raw ${next.stats.raw}`,
    )
    if (!done) {
      jobCtx.continue(next, { afterMs: 0 })
      return
    }
    return next.stats
  }

  throw new Error(`Unknown job type: ${job.type}`)
}
