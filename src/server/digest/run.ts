/**
 * Digest orchestration: select -> live-verify -> compose -> send, idempotently.
 *
 * runDigestForUser  : one user's digest. Cadence-gated (unless force), sends via
 *                     emailSend, and advances the per-user digest_state cursor
 *                     ONLY on a delivered send -- so a failed or empty run never
 *                     loses items and a re-run inside the window never double-sends.
 * runDigestCron     : the cron entry point. Scans users in owner context, bounded
 *                     per run (Alfred v1 is single-tenant; the multi-tenant fork
 *                     should fan out a per-user Job instead -- see constants).
 */
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../../../worker'
import type { DigestStateData, ProfileData } from '../../types'
import { cronInvoker, emailSend, type EmailSendResult } from '../integrations'
import { DIGEST_FROM, DIGEST_USERS_PER_RUN, DIGEST_VERIFY_CAP } from './constants'
import { composeDigestEmail } from './email'
import { isDigestDue, loadAllProfiles, loadDigestState, selectDigestItems } from './select'
import { verifyTopLinks } from './verify-links'
import type { DigestCronResult, DigestCtx, DigestRunOpts, DigestRunResult, Envelope, OwnerRecords } from './types'

/* -------------------------------------------------------- digest_state I/O */

async function advanceCursor(
  records: OwnerRecords,
  userId: string,
  existing: Envelope<DigestStateData> | null,
  count: number,
  jobIds: string[],
): Promise<void> {
  const now = new Date().toISOString()
  if (existing) {
    await records.update('digest_state', existing.recordId, {
      last_digest_at: now,
      last_count: count,
      last_job_ids: jobIds,
      updated_at: now,
    })
    return
  }
  const data: DigestStateData = {
    user_id: userId,
    last_digest_at: now,
    last_count: count,
    last_job_ids: jobIds,
    updated_at: now,
  }
  await records.create('digest_state', data as unknown as Record<string, unknown>)
}

/* ------------------------------------------------------------ per-user run */

function emptyResult(userId: string, cadence: string, outcome: DigestRunResult['outcome']): DigestRunResult {
  return {
    userId,
    outcome,
    recipient: null,
    cadence,
    selected: 0,
    delivered: 0,
    droppedLinks: 0,
    subject: null,
    htmlLength: 0,
    sendResult: null,
    items: [],
  }
}

export async function runDigestForUser(
  ctx: DigestCtx,
  userId: string,
  profile: ProfileData,
  opts: DigestRunOpts = {},
): Promise<DigestRunResult> {
  const { records, invoke } = ctx
  const cadence = profile.settings?.digest_cadence ?? 'daily'

  if (profile.settings?.email_enabled === false) {
    return emptyResult(userId, cadence, 'skipped-email-disabled')
  }

  const stateRow = await loadDigestState(records, userId)
  const lastAt = stateRow?.data?.last_digest_at ?? null

  if (!opts.force && !isDigestDue(cadence, lastAt)) {
    return emptyResult(userId, cadence, 'skipped-not-due')
  }

  // 1) Select new qualified matches since the last delivered digest.
  const selected = await selectDigestItems(records, userId, lastAt)
  if (selected.length === 0) {
    return { ...emptyResult(userId, cadence, 'skipped-empty') }
  }

  // 2) Live-verify the top picks (drop dead links). Skippable for tests/offline.
  let items = selected
  let dropped = 0
  if (!opts.skipVerify) {
    const v = await verifyTopLinks(selected, DIGEST_VERIFY_CAP)
    items = v.kept
    dropped = v.dropped
  }
  if (items.length === 0) {
    return { ...emptyResult(userId, cadence, 'skipped-empty'), selected: selected.length, droppedLinks: dropped }
  }

  // 3) Compose the on-brand HTML email.
  const composed = composeDigestEmail(profile, items)
  const recipient = (opts.toOverride ?? profile.basics?.email ?? '').trim()
  const itemEcho = items.map((i) => ({
    company: i.job.company,
    title: i.job.title,
    qualify: i.match.qualify,
    score: i.match.score,
    reason: i.match.reason,
  }))

  const base: DigestRunResult = {
    userId,
    outcome: 'dry-run',
    recipient: recipient || null,
    cadence,
    selected: selected.length,
    delivered: items.length,
    droppedLinks: dropped,
    subject: composed.subject,
    htmlLength: composed.html.length,
    sendResult: null,
    items: itemEcho,
    ...(opts.includeHtml ? { html: composed.html } : {}),
  }

  if (opts.dryRun) return base

  if (!recipient) return { ...base, outcome: 'skipped-no-email-address' }
  if (!invoke) return { ...base, outcome: 'send-failed', error: 'no integration invoker' }

  // 4) Send. Resend test-mode hides a real 403 in `message`; surface the truth.
  let send: EmailSendResult
  try {
    send = await emailSend(invoke, {
      from: DIGEST_FROM,
      to: recipient,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
  } catch (e) {
    return { ...base, outcome: 'send-failed', error: e instanceof Error ? e.message : String(e) }
  }

  const delivered = typeof send.id === 'string' && send.id.length > 0
  // 5) Advance the cursor ONLY on a delivered send (idempotent: a re-run inside
  //    the window is now not-due; an undelivered run stays open for retry).
  if (delivered) {
    await advanceCursor(records, userId, stateRow, items.length, items.map((i) => i.jobId))
  }

  return {
    ...base,
    outcome: delivered ? 'sent' : 'send-failed',
    sendResult: send as unknown as Record<string, unknown>,
    ...(delivered ? {} : { error: typeof send.message === 'string' ? send.message : 'no message id returned' }),
  }
}

/* --------------------------------------------------------------- cron pass */

/** Build the owner-context digest ctx (records + owner-billed integrations). */
export function buildDigestCtx(env: Env): DigestCtx {
  const octx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  return {
    records: octx.records as unknown as OwnerRecords,
    invoke: cronInvoker(octx),
  }
}

/**
 * Scan users and send any due digests, bounded per run. Returns a summary for
 * logging. Idempotent + safe to re-run: each user is cadence-gated and the
 * cursor only advances on delivery.
 */
export async function runDigestCron(env: Env, opts: { limit?: number } = {}): Promise<DigestCronResult> {
  const ctx = buildDigestCtx(env)
  const profiles = await loadAllProfiles(ctx.records)

  const seen = new Set<string>()
  const result: DigestCronResult = { scanned: 0, processed: 0, sent: 0, results: [] }
  const limit = opts.limit ?? DIGEST_USERS_PER_RUN

  for (const p of profiles) {
    const userId = p.data?.user_id
    if (!userId || seen.has(userId)) continue
    seen.add(userId)
    result.scanned++
    if (result.processed >= limit) continue

    // Cheap pre-gate so we only spend the budget on actually-due users.
    const cadence = p.data.settings?.digest_cadence ?? 'daily'
    if (p.data.settings?.email_enabled === false) continue
    const stateRow = await loadDigestState(ctx.records, userId)
    if (!isDigestDue(cadence, stateRow?.data?.last_digest_at ?? null)) continue

    const r = await runDigestForUser(ctx, userId, p.data)
    result.processed++
    result.results.push(r)
    if (r.outcome === 'sent') result.sent++
  }

  return result
}
