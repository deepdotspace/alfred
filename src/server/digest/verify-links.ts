/**
 * Live-verify the top digest picks before sending (DATA-MODEL decision 4):
 * cheap HEAD (falling back to GET) on each apply_url, drop the genuinely dead
 * ones. This protects Alfred's honesty promise -- never send someone to a 404.
 *
 * Deliberately LENIENT: a link is dropped only on a clear-dead signal
 * (connection error, or 404 / 410 / 451). Anti-bot AND transient-server
 * responses (401 / 403 / 405 / 429 / 5xx) and redirects are KEPT -- the posting
 * still exists, the ATS is just gating automated probes or briefly erroring. A
 * permanent drop on a transient 5xx would advance the digest cursor past a
 * still-alive job forever. Over-aggressive dropping is the worse failure.
 */
import { DIGEST_VERIFY_CAP } from './constants'
import type { DigestItem } from './types'

/** Per-request timeout for a verify probe. */
const PROBE_TIMEOUT_MS = 6000

/**
 * Statuses that mean the posting is genuinely gone. 5xx are deliberately NOT
 * here: an ATS 500/502/503 is almost always transient, and dropping on it would
 * permanently exclude an alive job (the cursor advances past it). Keep 5xx like
 * the 401/403/429 anti-bot codes; only 404 / 410 / 451 (and connection errors,
 * handled by the caller) drop.
 */
export function isDeadStatus(status: number): boolean {
  return status === 404 || status === 410 || status === 451
}

async function probe(url: string): Promise<boolean> {
  const tryOnce = async (method: 'HEAD' | 'GET'): Promise<number | null> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal })
      return res.status
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  let status = await tryOnce('HEAD')
  // Many ATS reject HEAD with 405/501 -> retry as GET before judging.
  if (status === null || status === 405 || status === 501) {
    status = await tryOnce('GET')
  }
  if (status === null) return false // connection/DNS error -> treat as dead
  return !isDeadStatus(status)
}

/**
 * Verify the top `cap` items concurrently; keep the rest unverified. Returns the
 * kept items (verified-alive top picks + the unverified tail) and the number of
 * links dropped.
 */
export async function verifyTopLinks(
  items: DigestItem[],
  cap: number = DIGEST_VERIFY_CAP,
): Promise<{ kept: DigestItem[]; dropped: number }> {
  if (items.length === 0) return { kept: [], dropped: 0 }
  const head = items.slice(0, cap)
  const tail = items.slice(cap)

  const verdicts = await Promise.all(
    head.map(async (it) => {
      const url = it.job.apply_url
      if (!url || !/^https?:\/\//i.test(url)) return false
      return probe(url)
    }),
  )

  const keptHead = head.filter((_, i) => verdicts[i])
  const dropped = head.length - keptHead.length
  return { kept: [...keptHead, ...tail], dropped }
}
