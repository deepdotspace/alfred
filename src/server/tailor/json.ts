/**
 * Robust JSON extraction for Sonnet generation.
 *
 * The shared `parseJsonLoose` only slices to the outermost braces when the text
 * does NOT already start with `{` -- so a response that begins with valid JSON
 * but trails prose ("...}\n\nLet me know if...") throws "Unexpected non-
 * whitespace after JSON". Sonnet does this for the cover letter. This extractor
 * always scans from the first `{`/`[` to its balanced close (string/escape
 * aware), so leading AND trailing prose are both tolerated. Kept local so the
 * shared DATA wrapper stays untouched.
 */
import { anthropicChat, SONNET_MODEL, type IntegrationInvoke, type JsonChatOpts } from '../integrations'

/** Find the first balanced JSON object/array in `text` and parse it. */
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const objAt = s.indexOf('{')
  const arrAt = s.indexOf('[')
  const start = arrAt === -1 ? objAt : objAt === -1 ? arrAt : Math.min(objAt, arrAt)
  if (start === -1) throw new Error('no JSON found in model output')

  const open = s[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let escaped = false
  let end = -1
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error('unbalanced JSON in model output')
  return JSON.parse(s.slice(start, end + 1)) as T
}

/**
 * Sonnet structured-JSON call with the robust extractor. Mirrors sonnetJson
 * (raw-JSON instruction + no prefill) but tolerates trailing prose.
 */
export async function sonnetJsonRobust<T = unknown>(invoke: IntegrationInvoke, opts: JsonChatOpts): Promise<T> {
  const system = [opts.system?.trim(), 'Respond with ONLY a single raw JSON value. No prose, no explanation, no markdown code fences.']
    .filter(Boolean)
    .join('\n\n')
  const { text } = await anthropicChat(invoke, {
    model: SONNET_MODEL,
    system,
    maxTokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0,
    messages: [{ role: 'user', content: opts.user }],
  })
  return extractJson<T>(text)
}
