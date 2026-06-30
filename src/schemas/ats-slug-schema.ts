/**
 * ats_slug -- the enumerated ATS company universe for the ingest sweep.
 *
 * INGEST-INTERNAL, non-personal, SERVER-WRITTEN ONLY. No client role can read
 * or write it: every permission is false, so the only writer/reader is the
 * ingest Job's owner context (buildCronContext), which bypasses user RBAC. It
 * holds no personal data -- just board slugs derived from public apply-URL
 * hosts -- so locking clients out entirely is the conservative, correct choice
 * (there is no UI that needs it).
 *
 * One row per (ats, slug). The DO mints recordId; dedupe by querying on the
 * (slug, ats) pair then update, never an explicit recordId (sdk-footguns).
 */
import type { CollectionSchema } from 'deepspace/worker'
import { ATS_VALUES } from '../types'

export const atsSlugSchema: CollectionSchema = {
  name: 'ats_slug',
  columns: [
    { name: 'slug', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ats', storage: 'text', interpretation: { kind: 'select', options: [...ATS_VALUES] }, required: true },
    { name: 'last_swept_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'job_count', storage: 'number', interpretation: 'plain' },
    { name: 'first_seen_at', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
