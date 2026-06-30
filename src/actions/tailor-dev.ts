/**
 * DEV-ONLY tailoring proof action (gated by ALLOW_DEBUG_ROUTES, stripped on
 * deploy). Runs the FULL honest pipeline INLINE for the caller against a real
 * pool job and returns the verify rounds (first-pass flags -> clean re-verify),
 * the structured content, the gaps, and the rendered PDF's page count + size --
 * so the verify loop and the one-page PDF can be proven like the spike, with NO
 * writes. Not product surface.
 *
 *   dev-tailor-preview { jobId, injectWritingSample? }
 */
import type { ActionHandler } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { cronInvoker } from '../server/integrations'
import { previewTailor, probeVerifier } from '../server/tailor/run'
import type { OwnerRecords, TailorCtx } from '../server/tailor/types'

export const devTailorPreview: ActionHandler<Env> = async ({ userId, params, env }) => {
  if (env.ALLOW_DEBUG_ROUTES !== 'true') return { success: false, error: 'not found' }

  const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  const ctx: TailorCtx = {
    records: octx.records as unknown as OwnerRecords,
    invoke: cronInvoker(octx),
  }

  // Deterministic skeptic proof: verify a deliberately-embellished draft.
  if (params?.embellishProbe === true) {
    const probe = await probeVerifier(ctx, userId)
    return { success: true, data: probe }
  }

  const jobId = typeof params?.jobId === 'string' ? params.jobId : ''
  if (!jobId) return { success: false, error: 'jobId required' }
  const injectWritingSample = typeof params?.injectWritingSample === 'string' ? params.injectWritingSample : undefined
  const coverOnly = params?.coverOnly === true

  const result = await previewTailor(ctx, userId, jobId, { injectWritingSample, coverOnly })
  return { success: true, data: result }
}
