/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { jobSchema } from './schemas/job-schema'
import { profileSchema } from './schemas/profile-schema'
import { matchSchema } from './schemas/match-schema'
import { applicationSchema } from './schemas/application-schema'
import { generatedDocSchema } from './schemas/generated-doc-schema'
import { atsSlugSchema } from './schemas/ats-slug-schema'
import { metaSchema } from './schemas/meta-schema'
import { digestStateSchema } from './schemas/digest-state-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  // Alfred entities (see docs/specs/DATA-MODEL.md)
  jobSchema, // SHARED pool: all signed-in users read, server-only writes
  profileSchema, // PERSONAL, owner-scoped
  matchSchema, // PERSONAL, owner-scoped, server-written
  applicationSchema, // PERSONAL, owner-scoped
  generatedDocSchema, // PERSONAL, owner-scoped, server-written
  // Ingest-internal (server-written only, no client read/write; see INGEST-PLAN)
  atsSlugSchema, // the enumerated ATS company universe for the sweep
  metaSchema, // ingest run state + cursors (singleton by `kind`)
  digestStateSchema, // per-user digest idempotency cursor (P5; server-written only)
]
