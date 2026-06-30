/**
 * application -- the durable kanban record per (user, job) (PERSONAL).
 *
 * CREATED by the OWNING USER (client caller) when they save / tailor / apply,
 * and updated by the user as they drag across the board -- so `user_id` is
 * userBound (stamped from the verified caller, spoof-proof) + immutable. The
 * tailoring Job may later set resume_doc_id / cover_letter_doc_id from owner
 * context; that is an UPDATE, where userBound preserves the existing user_id
 * (it never re-stamps on update), so the linkage write is safe.
 *
 * read/create/update/delete scoped to 'own' for every role -- never read:true
 * or admin:{read:true} on personal data. App code should also filter by
 * user_id (defense in depth).
 *
 * Logical key (user_id, job_id): query-then-update to keep one row per pair.
 */
import type { CollectionSchema } from 'deepspace/worker'
import { APPLICATION_STAGE_VALUES } from '../types'

export const applicationSchema: CollectionSchema = {
  name: 'application',
  ownerField: 'user_id',
  columns: [
    { name: 'user_id', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'job_id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'stage', storage: 'text', interpretation: { kind: 'select', options: [...APPLICATION_STAGE_VALUES] } },
    { name: 'resume_doc_id', storage: 'text', interpretation: 'plain' },
    { name: 'cover_letter_doc_id', storage: 'text', interpretation: 'plain' },
    { name: 'applied_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'created_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'updated_at', storage: 'text', interpretation: { kind: 'datetime' } },
    // In-flight tailor-run marker (idempotency): stamped by tailor-start before
    // enqueue, cleared by the tailor job on completion. Both nullable.
    { name: 'tailor_task_id', storage: 'text', interpretation: 'plain' },
    { name: 'tailor_started_at', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}
