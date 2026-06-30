/**
 * Digest tunables. Kept in one place so the quality bar + caps are easy to
 * recalibrate without hunting through the pipeline.
 */

/**
 * Quality-bar score floor (DATA-MODEL "Digest email item" + decision 1). Only
 * matches with qualify in {yes,stretch} AND score >= this floor are eligible.
 * Variable count, not a fixed N. Tunable live as the scoring prompt is fixed.
 * TODO: verify this floor against live digest output once multiple users exist.
 */
export const DIGEST_SCORE_FLOOR = 60

/** Hard cap on items per email (keeps the email scannable + the send cheap). */
export const DIGEST_MAX_ITEMS = 25

/**
 * How many of the top picks to live-verify (HEAD/GET each apply_url, drop dead
 * links) before sending, per DATA-MODEL decision 4. Bounded so the cron tick
 * stays well under the Worker subrequest ceiling.
 */
export const DIGEST_VERIFY_CAP = 10

/**
 * Max users processed per digest cron run. Alfred v1 is free/single-tenant, so
 * inline-in-cron is correct here; this cap keeps one run under the subrequest
 * ceiling. SCALING SEAM: the multi-tenant fork (Alfred 2) should fan out a
 * per-user `digest-user` Job (like match-user) instead of looping inline.
 */
export const DIGEST_USERS_PER_RUN = 8

/** Weekly cadence: resend only after this many days since the last delivery. */
export const DIGEST_WEEKLY_DAYS = 7

/**
 * The `from` address. In the platform's Resend TEST MODE only the owner's
 * verified address receives mail; `onboarding@resend.dev` is the always-allowed
 * test sender. A real multi-user send needs a verified domain + a `from` on it
 * (a STAKES step, flagged, not attempted here).
 */
export const DIGEST_FROM = 'Alfred <onboarding@resend.dev>'

/** Where the "Tailor & apply" CTA deep-links. The live single-tenant app. */
export const APP_BASE_URL = 'https://alfred.app.space'
