/**
 * The `meta` singleton row (kind='ingest'): ingest run state + cursors. Helpers
 * use query-then-update (recordId is not honored for custom collections).
 */
import type { MetaData } from '../../types'
import type { Envelope, OwnerRecords } from './types'

export const META_KIND = 'ingest'

export async function loadMeta(records: OwnerRecords): Promise<Envelope<MetaData> | null> {
  const rows = (await records.query('meta', { limit: 50 })) as Envelope<MetaData>[]
  return rows.find((r) => r.data?.kind === META_KIND) ?? null
}

/** Patch the ingest meta row, creating it on first run. */
export async function upsertMeta(records: OwnerRecords, patch: Partial<MetaData>): Promise<void> {
  const existing = await loadMeta(records)
  if (existing) {
    await records.update('meta', existing.recordId, patch as Record<string, unknown>)
    return
  }
  const seed: MetaData = {
    kind: META_KIND,
    backfilled: false,
    last_run_at: null,
    last_backfill_at: null,
    last_integration_run_at: null,
    pool_cursor: null,
    last_ingest_stats: null,
    ...patch,
  }
  await records.create('meta', seed as unknown as Record<string, unknown>)
}
