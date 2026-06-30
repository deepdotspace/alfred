/**
 * digest_state -- per-user idempotency cursor for the morning-brief email
 * (DATA-MODEL "Digest email item" + decision 4).
 *
 * INGEST/DIGEST-INTERNAL, non-personal infra, SERVER-WRITTEN ONLY (every
 * permission false, same rationale as `meta` / `ats_slug`). The digest cron
 * runs in OWNER context (buildCronContext), so it reads/writes these rows
 * directly via ctx.records.* (which bypasses RBAC). No client ever needs them.
 *
 * Logical key is `user_id` (one row per user): query-then-update, never rely on
 * the DO-minted recordId (references/sdk-footguns.md).
 *
 * NOTE (P5 seam): this is a NEW server-only collection added for digest
 * idempotency. It does not touch the LOCKED entity schemas (job / profile /
 * match / application / generated_doc); it mirrors the existing meta/ats_slug
 * infra pattern.
 */
import type { CollectionSchema } from 'deepspace/worker'

export const digestStateSchema: CollectionSchema = {
  name: 'digest_state',
  columns: [
    { name: 'user_id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'last_digest_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'last_count', storage: 'number', interpretation: 'plain' },
    { name: 'last_job_ids', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'updated_at', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
