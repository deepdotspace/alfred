/**
 * tailor-start -- kick the honest tailoring Job for the signed-in caller and
 * seed the tracker to `tailored`.
 *
 * Only ever tailors for the CALLER (userId from the verified JWT, never params),
 * so a user cannot tailor on someone else's behalf. The heavy work runs in the
 * background `tailor-doc` Job (owner context, owner-billed Sonnet + Haiku +
 * latex). Seeding the application here keeps the kick atomic with the tracker
 * advance; never downgrades a later stage (applied/interview/offer).
 *
 * Idempotent: a tailor run for a (user, job) records its taskId + start time on
 * the application row before enqueuing, and the job clears that marker when it
 * finishes. A double-click or refresh-then-click while a run is in flight gets
 * the existing run back instead of enqueuing (and being billed for) a second
 * full pipeline.
 */
import type { ActionHandler } from 'deepspace/worker'
import { enqueueJob } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { ApplicationData, ApplicationStage } from '../types'
import type { TailorMode } from '../server/tailor/types'

interface AppEnvelope {
  recordId: string
  data: ApplicationData
}

/** Stages we must not downgrade away from when seeding `tailored`. */
const LATER = new Set<ApplicationStage>(['tailored', 'applied', 'interview', 'offer'])

/**
 * How long a tailor run is treated as "in flight" for dedup. The job clears its
 * own marker on completion (success or failure), so this ceiling only matters
 * for a run that crashed before clearing -- generous enough to never block a
 * real retry (a tailor run completes in well under a minute).
 */
const TAILOR_INFLIGHT_TTL_MS = 5 * 60 * 1000

async function findApp(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  userId: string,
  jobId: string,
): Promise<AppEnvelope | null> {
  const q = await tools.query('application', { where: { user_id: userId }, limit: 5000 })
  const rows = q.success ? ((q.data as unknown as { records: AppEnvelope[] }).records ?? []) : []
  return rows.find((r) => r.data?.user_id === userId && r.data?.job_id === jobId) ?? null
}

export const tailorStart: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const jobId = typeof params?.jobId === 'string' ? params.jobId : ''
  if (!jobId) return { success: false, error: 'jobId required' }
  const mode: TailorMode = params?.mode === 'refine' ? 'refine' : 'generate'
  const refineNote = typeof params?.refineNote === 'string' ? params.refineNote : undefined

  const existing = await findApp(tools, userId, jobId)

  // Idempotency guard: if a tailor run for this (user, job) is already in flight,
  // hand back that run rather than enqueue a second owner-billed pipeline.
  const startedMs = existing?.data.tailor_started_at ? Date.parse(existing.data.tailor_started_at) : NaN
  if (existing?.data.tailor_task_id && Number.isFinite(startedMs) && Date.now() - startedMs < TAILOR_INFLIGHT_TTL_MS) {
    return { success: true, data: { taskId: existing.data.tailor_task_id, mode, deduped: true } }
  }

  const taskId = await enqueueJob(
    env.JOB_ROOMS,
    `app:${env.APP_NAME}`,
    'tailor-doc',
    { userId, jobId, mode, refineNote },
    { maxAttempts: 1, enqueuedBy: userId },
  )

  // Stamp the in-flight marker + (best-effort) seed/advance the tracker. Never
  // downgrade a later stage; never block the kick on a tracker write failure.
  const now = new Date().toISOString()
  try {
    if (existing) {
      const advanceStage = mode === 'generate' && !LATER.has(existing.data.stage)
      await tools.update('application', existing.recordId, {
        tailor_task_id: taskId,
        tailor_started_at: now,
        updated_at: now,
        ...(advanceStage ? { stage: 'tailored' as ApplicationStage } : {}),
      })
    } else {
      await tools.create('application', {
        user_id: userId,
        job_id: jobId,
        stage: 'tailored',
        resume_doc_id: null,
        cover_letter_doc_id: null,
        applied_at: null,
        notes: '',
        tailor_task_id: taskId,
        tailor_started_at: now,
        created_at: now,
        updated_at: now,
      } as unknown as Record<string, unknown>)
    }
  } catch {
    // marker + tracker seeding are best-effort; the tailoring kick is what matters
  }

  return { success: true, data: { taskId, mode } }
}
