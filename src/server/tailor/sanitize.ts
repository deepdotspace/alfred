/**
 * Honesty/house-rule string backstops for generated content.
 *
 * The tailoring prompts instruct the model to avoid em dashes, but a strip
 * backstop is mandatory (founder hard rule: no em dashes in user-visible or
 * AI-generated text). `deepStrip` walks the whole structured content object and
 * scrubs every string, so a single helper guarantees nothing leaks to the PDF,
 * the .docx, or the workspace HTML.
 */

const EM_DASH = /\s*[—―]\s*/g

/** Replace em dashes with " -- " and collapse the doubled spaces. */
export function stripEmDashes(s: string): string {
  return (s ?? '').replace(EM_DASH, ' -- ').replace(/\s{2,}/g, ' ').trim()
}

/** Recursively strip em dashes from every string in a JSON-ish value. */
export function deepStrip<T>(value: T): T {
  if (typeof value === 'string') return stripEmDashes(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => deepStrip(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepStrip(v)
    return out as T
  }
  return value
}
