/**
 * match -- Alfred's per-(user, job) verdict (PERSONAL). Keep latest per pair.
 *
 * Written by the SERVER ONLY: the match Job runs in OWNER context
 * (buildCronContext) and fans out across all users, so it sets `user_id`
 * EXPLICITLY to the real user. Therefore `user_id` must NOT be userBound --
 * userBound stamps the column with the WRITE's caller id, and in owner context
 * that is OWNER_USER_ID, which would clobber every match to the owner and break
 * per-user reads (verified in deepspace/dist/server.js putRecord: on create
 * `if (col.userBound) mergedData[col.name] = userId`, and skipUserRbac does NOT
 * bypass it). It is `immutable` + `required` instead.
 *
 * No client role can create/update/delete (server writes via ctx.records.*
 * bypass RBAC). read is scoped to 'own' for every role -- never read:true,
 * never admin:{read:true} on personal data.
 *
 * Expected benign [schema-lint] warning: "ownerField is 'user_id' but that
 * column is not marked userBound". It is intentional -- there is NO client
 * create path to spoof, the server sets user_id, and the column is immutable.
 *
 * Logical key is (user_id, job_id); ingest/match does query-then-update to keep
 * the latest per pair (the DO-minted recordId is not deterministic --
 * references/sdk-footguns.md).
 */
import type { CollectionSchema } from 'deepspace/worker'
import { QUALIFY_VALUES, TIMING_VALUES } from '../types'

export const matchSchema: CollectionSchema = {
  name: 'match',
  ownerField: 'user_id',
  columns: [
    { name: 'user_id', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'job_id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'qualify', storage: 'text', interpretation: { kind: 'select', options: [...QUALIFY_VALUES] } },
    { name: 'score', storage: 'number', interpretation: 'plain' },
    { name: 'reason', storage: 'text', interpretation: 'plain' },
    { name: 'matched', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'missing', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'timing', storage: 'text', interpretation: { kind: 'select', options: [...TIMING_VALUES] } },
    { name: 'created_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'seen', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}
