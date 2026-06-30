/**
 * Deterministic honesty backstop.
 *
 * The generate -> verify -> regen loop converges most of the time, but Haiku is
 * (rightly) strict and can keep flagging soft embellishments on thin source
 * items across rounds. To GUARANTEE the shipped resume/cover contains only
 * verifier-approved text, after the loop we deterministically replace any
 * still-flagged claim with the verifier's suggested honest `fix` (or drop the
 * bullet when there is no fix). This makes verified=true a hard guarantee, not a
 * probabilistic one -- nothing embellished or fabricated can ship.
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

/** Apply the verifier's honest fixes to any still-flagged resume claims. */
export function applyResumeFixes(content: ResumeDocContent, flagged: VerifyFinding[]): ResumeDocContent {
  const c: ResumeDocContent = {
    ...content,
    experience: content.experience.map((x) => ({ ...x, bullets: [...x.bullets] })),
    projects: content.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
  }

  for (const f of flagged) {
    const fix = stripEmDashes(f.fix ?? '').trim()

    // summary (claim is often a sentence within it)
    if (c.summary) {
      if (sameClaim(c.summary, f.claim)) {
        if (fix) c.summary = fix
        continue
      }
      const nClaim = norm(f.claim)
      if (nClaim.length > 20 && norm(c.summary).includes(nClaim) && fix) {
        // replace the offending sentence-ish span by rebuilding from the fix
        c.summary = fix
        continue
      }
    }

    if (c.experience.some((x) => fixBullets(x.bullets, f.claim, fix))) continue
    if (c.projects.some((p) => fixBullets(p.bullets, f.claim, fix))) continue

    // role / skills as a last resort
    if (sameClaim(c.role, f.claim) && fix) {
      c.role = fix
      continue
    }
  }

  // Drop any experience/project left with zero bullets after dropping.
  c.experience = c.experience.filter((x) => x.bullets.length > 0)
  return c
}

/** Apply the verifier's honest fixes to any still-flagged cover paragraphs. */
export function applyCoverFixes(content: CoverDocContent, flagged: VerifyFinding[]): CoverDocContent {
  const paragraphs = [...content.paragraphs]
  for (const f of flagged) {
    const fix = stripEmDashes(f.fix ?? '').trim()
    for (let i = 0; i < paragraphs.length; i++) {
      if (sameClaim(paragraphs[i], f.claim) || (norm(f.claim).length > 20 && norm(paragraphs[i]).includes(norm(f.claim)))) {
        if (fix) paragraphs[i] = fix
        break
      }
    }
  }
  return { ...content, paragraphs: paragraphs.filter((p) => p.trim().length > 0) }
}
