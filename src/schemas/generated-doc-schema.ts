/**
 * generated_doc -- a generated resume or cover letter per (user, job)
 * (PERSONAL). The PDF/DOCX live in R2 at r2_key.
 *
 * Written by the SERVER ONLY: the tailoring Job (generate -> verify -> regen)
 * runs in OWNER context and sets `user_id` EXPLICITLY to the real user, so
 * `user_id` must NOT be userBound (same reason as match -- userBound would
 * clobber it to OWNER_USER_ID on create). It is `immutable` + `required`.
 *
 * No client role can create/update/delete (server writes via ctx.records.*
 * bypass RBAC). read scoped to 'own' for every role -- never read:true, never
 * admin:{read:true}.
 *
 * Expected benign [schema-lint] warning about ownerField without userBound:
 * intentional -- no client create path, server sets user_id, column immutable.
 *
 * P4 NOTE (flagged schema addition): added the `content` JSON column. The
 * workspace renders the structured resume/cover content as HTML (DESIGN-SPEC
 * §3.2) and the download action re-renders the PDF/DOCX deterministically from
 * it; there was no field to persist that content (r2_key holds binaries only,
 * and R2 round-trips 401 in dev pre-deploy, so the render path must not depend
 * on R2). The column is additive, server-written only, and does not change
 * RBAC. See docs/founder/decisions-log.md (P4).
 */
import type { CollectionSchema } from 'deepspace/worker'
import { DOC_TYPE_VALUES } from '../types'

export const generatedDocSchema: CollectionSchema = {
  name: 'generated_doc',
  ownerField: 'user_id',
  columns: [
    { name: 'user_id', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'job_id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'type', storage: 'text', interpretation: { kind: 'select', options: [...DOC_TYPE_VALUES] } },
    { name: 'template', storage: 'text', interpretation: 'plain' },
    { name: 'r2_key', storage: 'text', interpretation: 'plain' },
    { name: 'pdf_url', storage: 'text', interpretation: 'plain' },
    { name: 'docx_url', storage: 'text', interpretation: 'plain' },
    { name: 'verified', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'gaps', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'content', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'created_at', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}
