/**
 * job -- the SHARED job pool.
 *
 * Non-personal, app-readable, server-written ONLY. Any signed-in user can READ
 * the pool; NO client role can write it (create/update/delete = false for every
 * role). All writes happen from server-side context -- the ingest Job and cron
 * use ctx.records.* (buildCronContext) which bypasses user RBAC -- so the pool
 * is writable by the server and read-only to every client.
 *
 * read: true is safe here precisely because there is NO ownerField and NO
 * personal data on this table (see references/sdk-footguns.md: "A collection
 * with no ownerField that is genuinely client-unreadable... can stay read:true";
 * the inverse also holds -- a non-personal shared table is fine to expose).
 *
 * The DO mints the recordId, so the stable dedup key is the `canonical_id`
 * column (hash of the canonical apply_url). Ingest must query-by-canonical_id
 * then update, never rely on an explicit recordId (sdk-footguns).
 */
import type { CollectionSchema } from 'deepspace/worker'
import {
  ATS_VALUES,
  WORKPLACE_VALUES,
  ROLE_TYPE_VALUES,
  SENIORITY_VALUES,
  SPONSORSHIP_VALUES,
  TAGGED_BY_VALUES,
} from '../types'

export const jobSchema: CollectionSchema = {
  name: 'job',
  columns: [
    { name: 'canonical_id', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'sources', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'apply_url', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ats', storage: 'text', interpretation: { kind: 'select', options: [...ATS_VALUES] } },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'company', storage: 'text', interpretation: 'plain', required: true },
    { name: 'company_logo_url', storage: 'text', interpretation: 'plain' },
    { name: 'company_url', storage: 'text', interpretation: 'plain' },
    { name: 'locations', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'workplace', storage: 'text', interpretation: { kind: 'select', options: [...WORKPLACE_VALUES] } },
    { name: 'role_family', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'role_type', storage: 'text', interpretation: { kind: 'select', options: [...ROLE_TYPE_VALUES] } },
    { name: 'term', storage: 'text', interpretation: 'plain' },
    { name: 'pay', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'sponsorship', storage: 'text', interpretation: { kind: 'select', options: [...SPONSORSHIP_VALUES] } },
    { name: 'degrees', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'min_yoe', storage: 'number', interpretation: 'plain' },
    { name: 'seniority', storage: 'text', interpretation: { kind: 'select', options: [...SENIORITY_VALUES] } },
    { name: 'key_skills', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'description_text', storage: 'text', interpretation: 'plain' },
    { name: 'posted_date', storage: 'text', interpretation: { kind: 'date' } },
    { name: 'first_ingested_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'last_seen_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'active', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'dedup_key', storage: 'text', interpretation: 'plain' },
    { name: 'tagged_by', storage: 'text', interpretation: { kind: 'select', options: [...TAGGED_BY_VALUES] } },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
