/**
 * Deterministic honesty backstop.
 *
 * The generate -> verify -> regen loop converges most of the time, but Haiku is
 * (rightly) strict and can keep flagging soft embellishments on thin source
 * items across rounds. After the loop we deterministically replace any
 * still-flagged claim with the verifier's suggested honest `fix` (or drop /
 * blank it when there is none), so the shipped resume/cover never contains a
 * flagged claim.
 *
 * Crucially, this is a FAIL-CLOSED backstop: it reports back (via `allResolved`)
 * whether EVERY flagged finding was actually located and resolved. A claim the
 * backstop cannot match (because the verifier's `claim` text is not near-verbatim
 * in the doc) is left UNRESOLVED, and the caller must then refuse to stamp the
 * document `verified`. The guarantee is enforced by withholding the stamp, never
 * by asserting it.
 */
import type { CoverDocContent, ResumeDocContent } from '../../types'
import { stripEmDashes } from './sanitize'
import type { VerifyFinding } from './types'

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** True when two strings are the same claim (exact, or one clearly contains the other). */
function sameClaim(a: string, b: string): boolean {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length > 20 && nb.length > 20 && (na.includes(nb) || nb.includes(na))) return true
  return false
}

/** Replace a matching bullet in a bullets[] with the fix, or drop it. Returns true if handled. */
function fixBullets(bullets: string[], claim: string, fix: string): boolean {
  for (let i = 0; i < bullets.length; i++) {
    if (sameClaim(bullets[i], claim)) {
      if (fix) bullets[i] = fix
      else bullets.splice(i, 1)
      return true
    }
  }
  return false
}

/**
 * Apply the verifier's honest fixes to any still-flagged resume claims.
 *
 * Returns the corrected content plus `allResolved`: true only when EVERY flagged
 * finding was matched AND resolved -- replaced with the honest fix, dropped (a
 * bullet with no fix), or blanked (a summary/role with no fix; both are optional
 * in the render, so dropping them is safe and never ships a flagged claim). When
 * a finding matches nothing the backstop can rewrite, `allResolved` is false and
 * the caller must NOT mark the doc verified.
 */
export function applyResumeFixes(
  content: ResumeDocContent,
  flagged: VerifyFinding[],
): { content: ResumeDocContent; allResolved: boolean } {
  const c: ResumeDocContent = {
    ...content,
    experience: content.experience.map((x) => ({ ...x, bullets: [...x.bullets] })),
    projects: content.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
  }

  let allResolved = true
  for (const f of flagged) {
    const fix = stripEmDashes(f.fix ?? '').trim()

    // summary (the claim is often a sentence within it). Use the honest fix, or
    // BLANK the summary when there is none -- it is optional in the render, so
    // dropping it never ships the flagged text.
    if (c.summary) {
      const nClaim = norm(f.claim)
      const matchesSummary = sameClaim(c.summary, f.claim) || (nClaim.length > 20 && norm(c.summary).includes(nClaim))
      if (matchesSummary) {
        c.summary = fix // '' -> blanked
        continue
      }
    }

    if (c.experience.some((x) => fixBullets(x.bullets, f.claim, fix))) continue
    if (c.projects.some((p) => fixBullets(p.bullets, f.claim, fix))) continue

    // role: use the honest fix, or blank it (also optional in the render).
    if (sameClaim(c.role, f.claim)) {
      c.role = fix
      continue
    }

    // Nothing matched: the backstop could not locate this flagged claim, so the
    // shipped doc may still contain it. Fail closed.
    allResolved = false
  }

  // Drop any experience/project left with zero bullets after dropping.
  c.experience = c.experience.filter((x) => x.bullets.length > 0)
  return { content: c, allResolved }
}

/**
 * Apply the verifier's honest fixes to any still-flagged cover paragraphs.
 *
 * Returns the corrected content plus `allResolved` (see applyResumeFixes): a
 * matched paragraph is replaced with the honest fix, or dropped when there is
 * none. A finding that matches no paragraph leaves `allResolved` false.
 */
export function applyCoverFixes(
  content: CoverDocContent,
  flagged: VerifyFinding[],
): { content: CoverDocContent; allResolved: boolean } {
  const paragraphs = [...content.paragraphs]
  let allResolved = true
  for (const f of flagged) {
    const fix = stripEmDashes(f.fix ?? '').trim()
    const nClaim = norm(f.claim)
    let handled = false
    for (let i = 0; i < paragraphs.length; i++) {
      if (sameClaim(paragraphs[i], f.claim) || (nClaim.length > 20 && norm(paragraphs[i]).includes(nClaim))) {
        paragraphs[i] = fix // '' -> dropped by the filter below; the flagged text never ships
        handled = true
        break
      }
    }
    if (!handled) allResolved = false
  }
  return { content: { ...content, paragraphs: paragraphs.filter((p) => p.trim().length > 0) }, allResolved }
}
