/**
 * profile -- the per-user master profile (PERSONAL). One row per user.
 *
 * Written by the OWNING USER (client caller): resume upload+parse, onboarding
 * chat, and direct edits all run as the signed-in user, so `user_id` is
 * userBound (the DO stamps the verified caller id on create and refuses client
 * spoofing) + immutable.
 *
 * Privacy: read is scoped to 'own' for EVERY role including admin -- never
 * read:true and never admin:{read:true} on personal data (references/
 * sdk-footguns.md: admin read:true is a cross-user firehose). App code should
 * ALSO filter reads by user_id (defense in depth); this RBAC is the
 * server-side boundary. ownerField + userBound together make 'own' safe.
 */
import type { CollectionSchema } from 'deepspace/worker'

export const profileSchema: CollectionSchema = {
  name: 'profile',
  ownerField: 'user_id',
  columns: [
    { name: 'user_id', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'basics', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'education', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'work', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'projects', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'skills', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'achievements', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'targeting', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'voice', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'settings', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'created_at', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'updated_at', storage: 'text', interpretation: { kind: 'datetime' } },
    // Server-written marker: when the matcher last COMPLETED a run for this user
    // (set even on a zero-survivor run). Drives the brief's honest empty state.
    { name: 'last_match_at', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}
