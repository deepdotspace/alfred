/**
 * Worker-side integration wrappers for Alfred.
 *
 * Thin, typed, defensive helpers over the DeepSpace integration proxy. Every
 * backend phase (ingest Job, match Job, tailoring Job, digest cron) calls these
 * instead of hand-rolling integration.post bodies. All known live gotchas are
 * baked in (see per-function doc comments).
 *
 * CALLING CONTEXTS -- two server surfaces invoke integrations, with different
 * shapes; pass the matching adapter as the first `invoke` arg:
 *   - cron / Jobs: build a cron context (buildCronContext) and pass
 *       cronInvoker(ctx)  -> uses ctx.integrations.call(ep, body)
 *   - server actions: pass actionInvoker(ctx.tools)
 *       -> uses tools.integration(ep, body) and unwraps the ActionResult
 * Both yield the integration's `data` payload directly. These wrappers are
 * decoupled from the SDK surface so they stay unit-testable.
 *
 * Billing: anthropic / apify / exa / firecrawl / latex-compiler / email default
 * to 'developer' (owner-billed) in src/integrations.ts. Auth-gate any client UI
 * that triggers them.
 *
 * No em dashes appear in any string a user could see.
 */

/* --------------------------------------------------------- model ids */

/** Haiku 4.5 -- cheap, supports assistant prefill (the {-prefill JSON trick). */
export const HAIKU_MODEL = 'claude-haiku-4-5'
/** Sonnet 4.6 -- stronger generation; does NOT support prefill (400 if sent). */
export const SONNET_MODEL = 'claude-sonnet-4-6'

/* ----------------------------------------------------- invoke adapters */

/** Returns the integration's `data` payload; throws on failure. */
export type IntegrationInvoke = (endpoint: string, body: Record<string, unknown>) => Promise<unknown>

/** Minimal shape of a cron/job context's integrations surface. */
interface CronIntegrations {
  integrations: { call: (endpoint: string, params: Record<string, unknown>) => Promise<unknown> }
}
/** Minimal shape of a server action's tools surface. */
interface ActionTools {
  integration: (endpoint: string, data?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>
}

/** Adapter for cron / Job context (buildCronContext). ctx.integrations.call already unwraps + throws. */
export function cronInvoker(ctx: CronIntegrations): IntegrationInvoke {
  return (endpoint, body) => ctx.integrations.call(endpoint, body)
}

/** Adapter for a server action's tools. Unwraps the ActionResult and throws on failure. */
export function actionInvoker(tools: ActionTools): IntegrationInvoke {
  return async (endpoint, body) => {
    const res = await tools.integration(endpoint, body)
    if (!res.success) throw new Error(`integration ${endpoint} failed: ${res.error ?? 'unknown error'}`)
    return res.data
  }
}

/* -------------------------------------------------------- json helpers */

/** Strip ``` / ```json fences and surrounding prose, then JSON.parse. Defensive for non-prefill models. */
export function parseJsonLoose<T = unknown>(text: string): T {
  let s = text.trim()
  // Drop a leading ```json or ``` fence and any trailing fence.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  // If there is still surrounding prose, slice to the outermost JSON braces/brackets.
  if (!(s.startsWith('{') || s.startsWith('['))) {
    const firstObj = s.indexOf('{')
    const firstArr = s.indexOf('[')
    const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr)
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
    if (start !== -1 && end > start) s = s.slice(start, end + 1)
  }
  return JSON.parse(s) as T
}

/* ----------------------------------------------------------- anthropic */

export interface AnthropicTextBlock {
  type: string
  text?: string
}
export interface AnthropicUsage {
  input_tokens?: number
  output_tokens?: number
  [k: string]: unknown
}
export interface AnthropicRaw {
  id: string
  model: string
  role: string
  type: string
  content: AnthropicTextBlock[]
  stop_reason: string | null
  stop_sequence: string | null
  usage: AnthropicUsage
  [k: string]: unknown
}
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Concatenate all text blocks of an Anthropic response. */
function extractText(raw: AnthropicRaw): string {
  return (raw.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

export interface AnthropicChatOpts {
  model: string
  messages: ChatMessage[]
  system?: string
  maxTokens?: number
  /** 0..1. The proxy schema only accepts model/max_tokens/messages/system/temperature. */
  temperature?: number
}

/**
 * Raw chat completion. Cost: per-token (Haiku ~$1/$5, Sonnet ~$3/$15 per MTok).
 * Gotcha: the DeepSpace anthropic proxy accepts ONLY model/max_tokens/messages/
 * system/temperature (no output_config, thinking, or betas), so structured JSON
 * must be forced via prefill (Haiku) or fence-stripping (Sonnet), not output_config.
 */
export async function anthropicChat(
  invoke: IntegrationInvoke,
  opts: AnthropicChatOpts,
): Promise<{ text: string; usage: AnthropicUsage; raw: AnthropicRaw }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
  }
  if (opts.system !== undefined) body.system = opts.system
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  const raw = (await invoke('anthropic/chat-completion', body)) as AnthropicRaw
  return { text: extractText(raw), usage: raw.usage ?? {}, raw }
}

export interface JsonChatOpts {
  user: string
  system?: string
  maxTokens?: number
  temperature?: number
}

/**
 * Haiku JSON extraction via the assistant {-prefill trick. Cost: ~$1/$5 per MTok.
 * Gotcha: Haiku 4.5 supports prefill, so we seed the assistant turn with "{"
 * (NOT echoed back in the response), then prepend "{" before parsing -> clean
 * JSON with no code fences. Use for cheap structured tasks (job tagging, parse,
 * verify, qualify/rank). Defaults to temperature 0 for stable JSON.
 */
export async function haikuJson<T = unknown>(invoke: IntegrationInvoke, opts: JsonChatOpts): Promise<T> {
  const { text } = await anthropicChat(invoke, {
    model: HAIKU_MODEL,
    system: opts.system,
    maxTokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0,
    messages: [
      { role: 'user', content: opts.user },
      { role: 'assistant', content: '{' },
    ],
  })
  const candidate = text.trimStart().startsWith('{') ? text : `{${text}`
  return parseJsonLoose<T>(candidate)
}

/**
 * Sonnet JSON extraction. Cost: ~$3/$15 per MTok.
 * Gotcha: Sonnet 4.6 does NOT support assistant prefill (returns 400), so we
 * instruct raw-JSON-only in the system prompt and strip code fences defensively
 * on the way out (parseJsonLoose). Use for the higher-quality generate step
 * (tailored resume / cover letter). Defaults to temperature 0.
 */
export async function sonnetJson<T = unknown>(invoke: IntegrationInvoke, opts: JsonChatOpts): Promise<T> {
  const system = [
    opts.system?.trim(),
    'Respond with ONLY a single raw JSON value. No prose, no explanation, no markdown code fences.',
  ]
    .filter(Boolean)
    .join('\n\n')
  const { text } = await anthropicChat(invoke, {
    model: SONNET_MODEL,
    system,
    maxTokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0,
    messages: [{ role: 'user', content: opts.user }],
  })
  return parseJsonLoose<T>(text)
}

/* --------------------------------------------------------------- apify */

export interface ApifyRunActorOpts {
  actorId: string
  input: Record<string, unknown>
  /** Required by the proxy. Hard ceiling on actor charge for this run, in USD. */
  maxCostUsd: number
  /** Also cap PAY_PER_EVENT actors (e.g. fantastic-jobs) so a run cannot overspend. */
  maxTotalChargeUsd?: number
  maxItems?: number
  timeout?: number
  memory?: number
  build?: string
}
/** The run object returned by run-actor (field names vary by actor; resolved defensively). */
export interface ApifyRun {
  id?: string
  runId?: string
  jobId?: string
  defaultDatasetId?: string
  datasetId?: string
  status?: string
  [k: string]: unknown
}
/** get-run response: run status plus dataset items at the given offset. */
export interface ApifyRunStatus {
  status?: string
  items?: unknown[]
  [k: string]: unknown
}

/** Pull the run id out of whatever field this actor used. */
function resolveRunId(run: ApifyRun): string | undefined {
  return run.id ?? run.runId ?? run.jobId
}

/**
 * Start an Apify actor (async). Cost: $1 base + actor charge (per_actual_cost).
 * Gotcha: run-actor is ASYNC -- it returns a run object, NOT results. Always set
 * maxCostUsd (required) and, for PAY_PER_EVENT actors, maxTotalChargeUsd so a run
 * cannot overspend. Poll with apifyGetRun, or use apifyRunAndCollect.
 */
export async function apifyRunActor(invoke: IntegrationInvoke, opts: ApifyRunActorOpts): Promise<ApifyRun> {
  const body: Record<string, unknown> = {
    actorId: opts.actorId,
    input: opts.input,
    maxCostUsd: opts.maxCostUsd,
  }
  if (opts.maxTotalChargeUsd !== undefined) body.maxTotalChargeUsd = opts.maxTotalChargeUsd
  if (opts.maxItems !== undefined) body.maxItems = opts.maxItems
  if (opts.timeout !== undefined) body.timeout = opts.timeout
  if (opts.memory !== undefined) body.memory = opts.memory
  if (opts.build !== undefined) body.build = opts.build
  return (await invoke('apify/run-actor', body)) as ApifyRun
}

/**
 * Fetch an Apify run's status and dataset items at an offset. Cost: $0 (free).
 * Gotcha: this is the polling endpoint; read `items` once status is SUCCEEDED.
 */
export async function apifyGetRun(
  invoke: IntegrationInvoke,
  params: { runId: string; offset?: number },
): Promise<ApifyRunStatus> {
  return (await invoke('apify/get-run', {
    runId: params.runId,
    offset: params.offset ?? 0,
  })) as ApifyRunStatus
}

const APIFY_TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'TIMED_OUT', 'ABORTED'])

export interface ApifyCollectOpts extends ApifyRunActorOpts {
  pollIntervalMs?: number
  maxPolls?: number
  /** Injectable for tests; defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>
}

/**
 * Run an actor and poll to completion, returning the dataset items.
 * Cost: $1 base + actor charge; polling is free. Gotcha: bound the wait
 * (maxPolls). In a long ingest run this lives inside a background Job; pass a
 * longer maxPolls or drive the poll across Job ticks for big runs.
 * Throws if the run ends non-SUCCEEDED or the poll budget is exhausted.
 */
export async function apifyRunAndCollect<T = unknown>(invoke: IntegrationInvoke, opts: ApifyCollectOpts): Promise<T[]> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const intervalMs = opts.pollIntervalMs ?? 3000
  const maxPolls = opts.maxPolls ?? 40

  const run = await apifyRunActor(invoke, opts)
  const runId = resolveRunId(run)
  if (!runId) throw new Error('apify run-actor returned no run id')

  for (let i = 0; i < maxPolls; i++) {
    const status = await apifyGetRun(invoke, { runId })
    const s = String(status.status ?? '').toUpperCase()
    if (s === 'SUCCEEDED') return (status.items ?? []) as T[]
    if (APIFY_TERMINAL.has(s)) throw new Error(`apify run ${runId} ended ${s}`)
    await sleep(intervalMs)
  }
  throw new Error(`apify run ${runId} did not finish within ${maxPolls} polls`)
}

/* ------------------------------------------------------------------ exa */

export interface ExaResult {
  title: string
  url: string
  publishedDate: string | null
  author: string | null
  id: string
  text?: string
  highlights?: string[]
  summary?: string
  [k: string]: unknown
}
export interface ExaSearchOpts {
  query: string
  numResults?: number
  category?: string
  /** ATS-only domains, per spec (linkedin.com returns celebration posts, not jobs). */
  includeDomains?: string[]
  excludeDomains?: string[]
  /** ISO 8601, e.g. "2026-06-01T00:00:00.000Z". */
  startPublishedDate?: string
  endPublishedDate?: string
  includeText?: string[]
  excludeText?: string[]
  contents?: Record<string, unknown>
}

/**
 * Exa neural web search. Cost: ~pennies/search (see costDollars in raw data).
 * Gotcha: restrict to ATS domains via includeDomains and use an ISO
 * startPublishedDate; a bare web query returns noise. Returns data.results.
 */
export async function exaSearch(invoke: IntegrationInvoke, opts: ExaSearchOpts): Promise<ExaResult[]> {
  const body: Record<string, unknown> = { query: opts.query }
  if (opts.numResults !== undefined) body.numResults = opts.numResults
  if (opts.category !== undefined) body.category = opts.category
  if (opts.includeDomains !== undefined) body.includeDomains = opts.includeDomains
  if (opts.excludeDomains !== undefined) body.excludeDomains = opts.excludeDomains
  if (opts.startPublishedDate !== undefined) body.startPublishedDate = opts.startPublishedDate
  if (opts.endPublishedDate !== undefined) body.endPublishedDate = opts.endPublishedDate
  if (opts.includeText !== undefined) body.includeText = opts.includeText
  if (opts.excludeText !== undefined) body.excludeText = opts.excludeText
  if (opts.contents !== undefined) body.contents = opts.contents
  const data = (await invoke('exa/search', body)) as { results?: ExaResult[] }
  return data.results ?? []
}

/* ------------------------------------------------------------- firecrawl */

export interface FirecrawlMetadata {
  title?: string
  description?: string
  language?: string
  sourceURL?: string
  statusCode?: number
  [k: string]: unknown
}
export interface FirecrawlDoc {
  url?: string
  markdown?: string
  html?: string
  links?: string[]
  metadata?: FirecrawlMetadata
  [k: string]: unknown
}
export interface FirecrawlSearchOpts {
  query: string
  limit?: number
  lang?: string
  country?: string
  scrapeOptions?: Record<string, unknown>
}

/**
 * Firecrawl search (search + scrape combined). Cost: 2 credits / 10 results + scrape.
 * Gotcha: build the query as a Google operator string (`site:` + `after:`) to
 * find LinkedIn-exclusive and off-slug roles. Returns data.data (array of docs).
 */
export async function firecrawlSearch(invoke: IntegrationInvoke, opts: FirecrawlSearchOpts): Promise<FirecrawlDoc[]> {
  const body: Record<string, unknown> = { query: opts.query }
  if (opts.limit !== undefined) body.limit = opts.limit
  if (opts.lang !== undefined) body.lang = opts.lang
  if (opts.country !== undefined) body.country = opts.country
  if (opts.scrapeOptions !== undefined) body.scrapeOptions = opts.scrapeOptions
  const data = (await invoke('firecrawl/search', body)) as { data?: FirecrawlDoc[] }
  return data.data ?? []
}

export interface FirecrawlScrapeOpts {
  url: string
  formats?: string[]
  onlyMainContent?: boolean
  includeTags?: string[]
  excludeTags?: string[]
  waitFor?: number
  timeout?: number
}

/**
 * Firecrawl single-page scrape. Cost: ~$0.0008 / page (1 credit).
 * Gotcha: use for on-demand JD enrichment (markdown) for tailoring. Returns
 * data.data (a single doc); read `.markdown`.
 */
export async function firecrawlScrape(invoke: IntegrationInvoke, opts: FirecrawlScrapeOpts): Promise<FirecrawlDoc> {
  const body: Record<string, unknown> = { url: opts.url }
  if (opts.formats !== undefined) body.formats = opts.formats
  if (opts.onlyMainContent !== undefined) body.onlyMainContent = opts.onlyMainContent
  if (opts.includeTags !== undefined) body.includeTags = opts.includeTags
  if (opts.excludeTags !== undefined) body.excludeTags = opts.excludeTags
  if (opts.waitFor !== undefined) body.waitFor = opts.waitFor
  if (opts.timeout !== undefined) body.timeout = opts.timeout
  const data = (await invoke('firecrawl/scrape', body)) as { data?: FirecrawlDoc }
  return data.data ?? {}
}

/* ----------------------------------------------------------- latex-compiler */

export interface LatexParsedLog {
  errors: unknown[]
  warnings: unknown[]
  errors_count: number
  warnings_count: number
  has_errors: boolean
  has_warnings: boolean
  [k: string]: unknown
}
export interface LatexCompileResult {
  compiled: boolean
  pdfBase64?: string
  contentType?: string
  parsedLog?: LatexParsedLog
  duration?: number
  /** Set (inside data) when compiled is false. */
  error?: string
  [k: string]: unknown
}
export interface LatexCompileOpts {
  document: string
  compiler?: string
  resources?: Array<{ main?: boolean; path?: string; content?: string; file?: string; url?: string }>
}

/**
 * Compile LaTeX to a PDF. Cost: ~$0.005 / compile.
 * Gotcha: ALWAYS check `compiled === true && pdfBase64` before using the result,
 * and verify the rendered PDF (page count) before showing or downloading it
 * (per the resume pipeline rule). On failure `compiled` is false and `error`
 * carries the reason. pdfBase64 is base64; decode straight to a file.
 */
export async function latexCompile(invoke: IntegrationInvoke, opts: LatexCompileOpts): Promise<LatexCompileResult> {
  const body: Record<string, unknown> = { document: opts.document }
  if (opts.compiler !== undefined) body.compiler = opts.compiler
  if (opts.resources !== undefined) body.resources = opts.resources
  return (await invoke('latex-compiler/compile', body)) as LatexCompileResult
}

/* ----------------------------------------------------------------- email */

export interface EmailSendResult {
  id?: string
  /**
   * Resend test-mode and other provider errors surface here, OUTSIDE the typed
   * success path. Read it and show the truth; do not fake success.
   */
  message?: string
  [k: string]: unknown
}
export interface EmailSendOpts {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string
  cc?: string | string[]
  bcc?: string | string[]
}

/**
 * Send a transactional email via Resend. Cost: ~$0.01 / call.
 * Gotcha: the platform Resend account is in TEST MODE -- it only delivers to the
 * platform owner's verified address until a domain is verified at resend.com
 * (a later stakes step). A real 403 hides in the `message` field of the result;
 * surface it rather than reporting a false success. Just wire the call here.
 */
export async function emailSend(invoke: IntegrationInvoke, opts: EmailSendOpts): Promise<EmailSendResult> {
  const body: Record<string, unknown> = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
  }
  if (opts.html !== undefined) body.html = opts.html
  if (opts.text !== undefined) body.text = opts.text
  if (opts.reply_to !== undefined) body.reply_to = opts.reply_to
  if (opts.cc !== undefined) body.cc = opts.cc
  if (opts.bcc !== undefined) body.bcc = opts.bcc
  return (await invoke('email/send', body)) as EmailSendResult
}
