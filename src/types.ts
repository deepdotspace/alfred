/**
 * Alfred shared types -- the one source of truth for every entity row shape
 * (the `.data` payloads) and the enums they use.
 *
 * Pure TypeScript: NO runtime SDK imports, so this module is safe to import
 * from both the worker (schemas, jobs, cron, actions) and the frontend
 * (pages, components, hooks). Schemas in src/schemas/* import the enum value
 * arrays below for their `select` column options, guaranteeing the columns and
 * these types never drift.
 *
 * Field names are snake_case to match docs/specs/DATA-MODEL.md exactly.
 */

/* ------------------------------------------------------------------ enums */

/** Where a pool job was surfaced from. */
export const JOB_SOURCE_VALUES = [
  'simplify',
  'speedyapply',
  'ats-ashby',
  'ats-greenhouse',
  'ats-lever',
  'firecrawl',
  'exa',
  'fantastic-jobs',
] as const
export type JobSource = (typeof JOB_SOURCE_VALUES)[number]

/** Applicant-tracking system behind the canonical apply link. */
export const ATS_VALUES = [
  'greenhouse',
  'lever',
  'ashby',
  'workday',
  'linkedin',
  'other',
  'unknown',
] as const
export type Ats = (typeof ATS_VALUES)[number]

export const WORKPLACE_VALUES = ['onsite', 'hybrid', 'remote', 'unknown'] as const
export type Workplace = (typeof WORKPLACE_VALUES)[number]

export const ROLE_TYPE_VALUES = ['internship', 'co-op', 'new-grad-ft', 'unknown'] as const
export type RoleType = (typeof ROLE_TYPE_VALUES)[number]

export const SENIORITY_VALUES = ['intern', 'entry', 'unknown'] as const
export type Seniority = (typeof SENIORITY_VALUES)[number]

/** Visa sponsorship signal on a job. Often `unknown` (most sources omit it). */
export const SPONSORSHIP_VALUES = ['offers', 'none', 'citizenship-required', 'unknown'] as const
export type Sponsorship = (typeof SPONSORSHIP_VALUES)[number]

/**
 * How a job's `role_family` tags were assigned by ingest. `keyword` = cheap
 * title-keyword rules; `haiku` = the Haiku fallback for ambiguous titles.
 * Stored once per job and never recomputed (ingest only tags on first ingest).
 */
export const TAGGED_BY_VALUES = ['keyword', 'haiku'] as const
export type TaggedBy = (typeof TAGGED_BY_VALUES)[number]

export const PAY_PERIOD_VALUES = ['hourly', 'monthly', 'yearly'] as const
export type PayPeriod = (typeof PAY_PERIOD_VALUES)[number]

/** Alfred's honest verdict for a (user, job) pair. We drop `no` from the feed. */
export const QUALIFY_VALUES = ['yes', 'stretch', 'no'] as const
export type Qualify = (typeof QUALIFY_VALUES)[number]

export const TIMING_VALUES = ['good', 'late', 'unknown'] as const
export type Timing = (typeof TIMING_VALUES)[number]

/** Kanban tracker stages. */
export const APPLICATION_STAGE_VALUES = [
  'saved',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
  'dismissed',
] as const
export type ApplicationStage = (typeof APPLICATION_STAGE_VALUES)[number]

export const DOC_TYPE_VALUES = ['resume', 'cover_letter'] as const
export type DocType = (typeof DOC_TYPE_VALUES)[number]

/** The user's work-authorization status -> drives the sponsorship hard-filter. */
export const WORK_AUTHORIZATION_VALUES = [
  'citizen-or-pr',
  'need-sponsorship-now',
  'need-sponsorship-future',
  'unsure',
] as const
export type WorkAuthorization = (typeof WORK_AUTHORIZATION_VALUES)[number]

export const DIGEST_CADENCE_VALUES = ['daily', 'weekly'] as const
export type DigestCadence = (typeof DIGEST_CADENCE_VALUES)[number]

/* ----------------------------------------------------------- nested shapes */

/** A pay band on a job. Every numeric field nullable -- pay is OFTEN absent. */
export interface PayInfo {
  min: number | null
  max: number | null
  currency: string
  period: PayPeriod
  /** Which source supplied the pay band (e.g. "speedyapply", "fantastic-jobs"). */
  source: string
}

/** One location on a job; a job may list several. Each part nullable. */
export interface JobLocation {
  city: string | null
  state: string | null
  country: string | null
}

/* ----------------------------------------------------------- job (SHARED) */

/**
 * Shared pool job. Non-personal, app-readable, server-written only.
 * EVERY enrichment field is nullable -- sparse data is normal; the UI must
 * degrade gracefully and never fabricate a missing value.
 *
 * `canonical_id` is the stable dedup hash (of the canonical apply_url) and is
 * the lookup key for ingest (query-by-canonical_id then update, because the
 * DO-minted recordId is not the hash -- see references/sdk-footguns.md).
 */
export interface JobData {
  canonical_id: string
  sources: JobSource[]
  apply_url: string
  ats: Ats
  title: string
  company: string
  company_logo_url: string | null
  company_url: string | null
  locations: JobLocation[]
  workplace: Workplace
  /** Taxonomy node ids (see ROLE_TAXONOMY in constants.ts). A job can have >1. */
  role_family: string[]
  role_type: RoleType
  /** e.g. "Summer 2026" / "Fall 2026". */
  term: string | null
  pay: PayInfo | null
  sponsorship: Sponsorship
  degrees: string[] | null
  min_yoe: number | null
  seniority: Seniority
  key_skills: string[] | null
  /** Full JD text. Stored if cheap; else fetched on demand for tailoring. */
  description_text: string | null
  /** ISO date string; null when the source did not give a posting date. */
  posted_date: string | null
  first_ingested_at: string
  last_seen_at: string
  active: boolean | null
  /** norm(company)+norm(title) -- used alongside canonical_id for dedupe. */
  dedup_key: string
  /** How role_family was assigned (keyword rules vs Haiku); null until tagged. */
  tagged_by: TaggedBy | null
}

/* -------------------------------------------------- profile (PERSONAL) */

export interface ProfileLinks {
  github: string | null
  linkedin: string | null
  portfolio: string | null
  other: string[]
}

/** Section 1: Basics. */
export interface ProfileBasics {
  name: string
  email: string
  phone: string
  location: string
  links: ProfileLinks
}

export interface EducationEntry {
  school: string
  degree: string
  field: string
  start: string
  end: string
  gpa: string | null
  details: string[]
}

export interface WorkEntry {
  title: string
  company: string
  location: string
  start: string
  end: string
  bullets: string[]
}

export interface ProjectEntry {
  name: string
  description: string
  link: string | null
  bullets: string[]
}

/** A categorized skill group, e.g. { category: "Languages", items: [...] }. */
export interface SkillGroup {
  category: string
  items: string[]
}

/** Optional pay floor the user will accept. */
export interface PayFloor {
  amount: number
  period: PayPeriod
}

export interface CompanyPrefs {
  size: string | null
  industries_include: string[]
  industries_avoid: string[]
}

/** Section 3: Targeting -- drives matching. */
export interface TargetingPrefs {
  /** Taxonomy node ids the user wants (joins job.role_family). */
  role_families: string[]
  /** internship / co-op / new-grad-ft intent (may be several). */
  intent: RoleType[]
  locations: string[]
  work_modes: Workplace[]
  open_to_relocate: boolean
  work_authorization: WorkAuthorization
  pay_floor: PayFloor | null
  company_prefs: CompanyPrefs | null
  /** Free-text "in your own words" requirements the matcher reads. */
  requirements_freetext: string
  /** Free-text dealbreakers the matcher reads. */
  dealbreakers_freetext: string
}

/**
 * A named writing reference (cover letter / sample) Alfred studies for VOICE.
 * Lives inside the `voice` JSON column (no separate DB column / RBAC change).
 * The cover-letter generator (P3) reads `writing_references` + `writing_sample`
 * to decide whether a voice sample exists (DATA-MODEL decision 9 gating).
 */
export interface WritingReference {
  /** Stable client-minted id (for list keys + edit/remove). */
  id: string
  title: string
  desc: string
  content: string
  /** R2 key when this reference was added from an uploaded doc/PDF, else null. */
  source_key: string | null
}

/** Section 4: Voice and source material (for cover-letter voice + grounding). */
export interface VoiceSourceMaterial {
  /** R2 keys of uploaded resumes (scope='self'). */
  resume_keys: string[]
  /** R2 keys of uploaded past cover letters. */
  cover_letter_keys: string[]
  /** Legacy single paste; kept for back-compat. New samples go in writing_references. */
  writing_sample: string
  /**
   * Named voice references (cover letters / samples), shown on the Profile page.
   * Optional so existing callers that build a `voice` object stay valid; readers
   * treat `undefined` as an empty list.
   */
  writing_references?: WritingReference[]
  stories_freetext: string
}

/** Section 5: Settings. */
export interface ProfileSettings {
  digest_cadence: DigestCadence
  email_enabled: boolean
  notifications_enabled: boolean
}

/**
 * The master profile (one per user). Populated by resume upload+parse,
 * onboarding chat, and direct edits -- all writing these same fields.
 */
export interface ProfileData {
  user_id: string
  basics: ProfileBasics
  education: EducationEntry[]
  work: WorkEntry[]
  projects: ProjectEntry[]
  skills: SkillGroup[]
  achievements: string[]
  targeting: TargetingPrefs
  voice: VoiceSourceMaterial
  settings: ProfileSettings
  created_at: string
  updated_at: string
  /**
   * Set by the matcher when a recompute COMPLETES (even with zero surviving
   * candidates). The brief reads it to show an honest empty state and to stop
   * re-kicking a recompute on every mount once a run has finished. Absent means
   * a match run has never completed for this user yet.
   */
  last_match_at?: string
}

/* --------------------------------------------------- match (PERSONAL) */

/**
 * Alfred's per-(user, job) verdict. Server-written only (the match Job runs
 * in owner context). Keep the latest per pair (query-then-update).
 */
export interface MatchData {
  user_id: string
  job_id: string
  qualify: Qualify
  /** 0-100 internal ranking score; shown only backed by a label + reason. */
  score: number
  /** One honest sentence: why Alfred picked this. */
  reason: string
  /** Requirements the user meets. */
  matched: string[]
  /** Gaps worth addressing. */
  missing: string[]
  timing: Timing
  created_at: string
  /** false -> show the NEW badge. */
  seen: boolean
}

/* ----------------------------------------------- application (PERSONAL) */

/**
 * The durable kanban record per (user, job). Created/updated by the user
 * (client caller). The board reads applications.
 */
export interface ApplicationData {
  user_id: string
  job_id: string
  stage: ApplicationStage
  resume_doc_id: string | null
  cover_letter_doc_id: string | null
  applied_at: string | null
  notes: string
  created_at: string
  updated_at: string
  /**
   * In-flight tailor-run marker. `tailor-start` stamps the running job's taskId +
   * start time before enqueuing; the tailor job clears both when it finishes
   * (success or failure). Used to make tailoring idempotent so a double-click or
   * refresh-then-click cannot enqueue a second owner-billed pipeline.
   */
  tailor_task_id?: string | null
  tailor_started_at?: string | null
}

/* -------------------------------------------- generated_doc (PERSONAL) */

/** One experience entry on a tailored resume. */
export interface ResumeExperienceEntry {
  title: string
  org: string
  location: string | null
  dates: string
  bullets: string[]
}

/** One project entry on a tailored resume. */
export interface ResumeProjectEntry {
  name: string
  link: string | null
  description: string | null
  bullets: string[]
}

/** One rendered education line on a tailored resume. */
export interface ResumeEducationEntry {
  line: string
}

/**
 * The structured, honesty-verified resume content -- the single source the
 * workspace HTML preview, the LaTeX/PDF render, and the .docx all derive from.
 * `name` / `role` / `contact` / `education` are grounded deterministically from
 * the master profile (never model-fabricated); bullets/summary/skills are the
 * tailored, verified output. `contactParts` carries the link targets for LaTeX.
 */
export interface ResumeDocContent {
  name: string
  /** Concise target-role line shown under the name (e.g. "Full-Stack Engineer"). */
  role: string
  /** The mono contact line shown in the doc header. */
  contact: string
  /** Contact entries (label + optional url) for the LaTeX/docx render. */
  contactParts: { label: string; url: string | null }[]
  summary: string
  experience: ResumeExperienceEntry[]
  projects: ResumeProjectEntry[]
  skills: SkillGroup[]
  education: ResumeEducationEntry[]
}

/** The structured, voice-matched cover-letter content. */
export interface CoverDocContent {
  date: string
  salutation: string
  paragraphs: string[]
  closing: string
  signature: string
}

/** The `content` payload on a generated_doc row -- narrow by the row's `type`. */
export type GeneratedDocContent = ResumeDocContent | CoverDocContent

/**
 * A generated resume or cover letter per (user, job). Server-written only
 * (the tailoring Job). The downloadable PDF/DOCX live in R2 at r2_key
 * (best-effort); `content` carries the structured, verified text the workspace
 * renders and the download action deterministically re-renders from.
 */
export interface GeneratedDocData {
  user_id: string
  job_id: string
  type: DocType
  template: string
  r2_key: string
  pdf_url: string | null
  docx_url: string | null
  /** Passed the fact-check / verify loop. */
  verified: boolean
  gaps: string[]
  /** Structured resume/cover content the UI renders. Narrow by `type`. */
  content: GeneratedDocContent | null
  created_at: string
}

/* ------------------------------------------------ taxonomy node shape */

/**
 * One role-family node in ROLE_TAXONOMY (constants.ts). The bounded scan-cluster
 * spine: ingest tags jobs to node ids, onboarding pre-selects node ids, and
 * matching joins user role_families to job.role_family on these ids.
 */
export interface RoleFamilyNode {
  /** Stable slug, stored in job.role_family and profile.targeting.role_families. */
  id: string
  label: string
  /**
   * Best-effort SimplifyJobs `category` value to map this node from.
   * TODO: verify against the live SimplifyJobs listings.json during ingest (P1).
   */
  simplify_category: string
  /**
   * Hand-tuned keywords used two ways: (a) firecrawl/exa source queries for
   * this family, (b) cheap title-keyword tagging rules for ingested jobs.
   */
  keywords: string[]
}

/* ------------------------------------- envelope helper (worker + client) */

/**
 * The DO record envelope returned by the server tools, cron records helpers,
 * and the client useRecords hook. The entity payload lives at `.data`;
 * `recordId` is the DO-minted id.
 */
export interface RecordEnvelope<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------ ingest-internal (SERVER-WRITTEN ONLY) */

/**
 * ats_slug -- the enumerated ATS company universe the ingest sweep iterates.
 * Derived from the SimplifyJobs / SpeedyApply apply-URL hosts (greenhouse /
 * lever / ashby), one row per (ats, slug). Non-personal, never client-readable
 * or client-writable: filled only by the ingest Job's owner context.
 */
export interface AtsSlugData {
  /** The board slug, e.g. "spacex" for boards.greenhouse.io/spacex. */
  slug: string
  /** Which ATS the slug belongs to (greenhouse | lever | ashby ...). */
  ats: Ats
  /** ISO datetime this slug's board was last fetched, or null if never. */
  last_swept_at: string | null
  /** Matching EC roles found on the last sweep (rough breadth signal). */
  job_count: number | null
  first_seen_at: string
}

/**
 * digest_state -- per-user idempotency cursor for the morning-brief email.
 *
 * SERVER-WRITTEN ONLY (the digest cron runs in owner context). One row per
 * user. `last_digest_at` is both the idempotency guard (so a re-run inside the
 * cadence window never double-sends) and the "new since" cursor (the next
 * digest only includes matches created after it). Advanced ONLY on a delivered
 * send, so a failed/empty run leaves the window open for the next run.
 */
export interface DigestStateData {
  user_id: string
  /** ISO datetime of the last DELIVERED digest, or null if never sent. */
  last_digest_at: string | null
  /** How many items the last delivered digest contained. */
  last_count: number
  /** job_ids of the last delivered digest (audit / debugging). */
  last_job_ids: string[]
  updated_at: string
}

/**
 * meta -- a tiny key-addressed singleton table for ingest run state and
 * cursors. One row per `kind` (currently just 'ingest'). Non-personal,
 * server-written only.
 */
export interface MetaData {
  /** Singleton key for the row, e.g. 'ingest'. */
  kind: string
  /** First backfill has completed -> delta no longer auto-enqueues one. */
  backfilled: boolean
  last_run_at: string | null
  last_backfill_at: string | null
  /** Guards the once/day firecrawl+exa spend on the 30-min delta cadence. */
  last_integration_run_at: string | null
  /** Advances when a run adds jobs; P3's match recompute reads from here. */
  pool_cursor: string | null
  /** JSON snapshot of the last run's IngestStats (for the dev stats route). */
  last_ingest_stats: Record<string, unknown> | null
}
