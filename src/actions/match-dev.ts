/**
 * DEV-ONLY match verification actions (gated by ALLOW_DEBUG_ROUTES, which the
 * CLI writes only in `deepspace dev`/`test` and strips on deploy). These exist
 * to PROVE the matcher against the live pool; they are not product surface.
 *
 *   dev-seed-profile  : write the demo fixture as the caller's profile (so the
 *                       caller's brief can be matched). Runs as the caller, so
 *                       the userBound user_id is stamped to the test account.
 *   dev-match-preview : run hard-filter + Haiku scoring inline (NO writes) for
 *                       the caller and return verdicts + rejected examples.
 */
import type { ActionHandler } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { cronInvoker } from '../server/integrations'
import { previewMatch } from '../server/match/run'
import type { MatchCtx, OwnerRecords } from '../server/match/types'
import { buildDemoProfile } from '../server/match/demo-fixture'

interface QueryEnvelope<T> {
  recordId: string
  data: T
}

function devEnabled(env: Env): boolean {
  return env.ALLOW_DEBUG_ROUTES === 'true'
}

export const devSeedProfile: ActionHandler<Env> = async ({ userId, tools, env }) => {
  if (!devEnabled(env)) return { success: false, error: 'not found' }
  const profile = buildDemoProfile(userId)

  const q = await tools.query('profile', { where: { user_id: userId }, limit: 5 })
  const rows = q.success ? ((q.data as unknown as { records: QueryEnvelope<{ user_id?: string }>[] }).records ?? []) : []
  const mine = rows.find((r) => r.data?.user_id === userId)

  if (mine) {
    const res = await tools.update('profile', mine.recordId, profile as unknown as Record<string, unknown>)
    if (!res.success) return res
    return { success: true, data: { seeded: 'updated' } }
  }
  const res = await tools.create('profile', profile as unknown as Record<string, unknown>)
  if (!res.success) return res
  return { success: true, data: { seeded: 'created' } }
}

export const devMatchPreview: ActionHandler<Env> = async ({ userId, env }) => {
  if (!devEnabled(env)) return { success: false, error: 'not found' }
  const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  const ctx: MatchCtx = {
    records: octx.records as unknown as OwnerRecords,
    invoke: cronInvoker(octx),
  }
  const result = await previewMatch(ctx, userId)
  return { success: true, data: result }
}
