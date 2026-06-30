/**
 * meta -- ingest run state + cursors (a tiny key-addressed singleton table).
 *
 * INGEST-INTERNAL, non-personal, SERVER-WRITTEN ONLY (every permission false,
 * same rationale as ats_slug). One row per `kind` -- currently just 'ingest'.
 * The ingest Job and cron read/write it via the owner context. Dedupe by
 * querying on `kind` then update; never rely on an explicit recordId.
 */
import type { CollectionSchema } from 'deepspace/worker'

export const metaSchema: CollectionSchema = {
  name: 'meta',
  columns: [
    { name: 'kind', storage: 'text', interpretation: 'plain', required: true },
    { name: 'backfilled', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'last_run_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'last_backfill_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'last_integration_run_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'pool_cursor', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'last_ingest_stats', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
