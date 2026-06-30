/**
 * P5 verification e2e -- PROVES the digest email pipeline + screenshots the
 * tracker, against the LIVE pool with the demo fixture.
 *
 * Flow: sign in -> ensure pool populated -> seed demo profile -> run the digest
 * INLINE (ensureMatches writes real verdicts, then select -> live-verify ->
 * compose -> send to the OWNER address in Resend test mode) -> dump + render the
 * email HTML and screenshot it -> seed applications across stages -> screenshot
 * the tracker board.
 *
 * Owner recipient for the test-mode proof. Override with DIGEST_TEST_TO.
 *
 * Run with: npx deepspace test e2e
 */
import { test, expect } from 'deepspace/testing'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const VERIFY = (name: string) => fileURLToPath(new URL(`../docs/design/verify/${name}`, import.meta.url))
const OWNER_TO = process.env.DIGEST_TEST_TO ?? 'demo@example.com'

interface DigestItem { company: string; title: string; qualify: string; score: number; reason: string }
interface DigestResult {
  outcome: string; recipient: string | null; cadence: string; selected: number; delivered: number
  droppedLinks: number; subject: string | null; htmlLength: number
  sendResult: Record<string, unknown> | null; items: DigestItem[]; html?: string; error?: string
}

test('digest composes + live-verifies + sends; tracker renders', async ({ users }) => {
  test.setTimeout(300_000)
  const [u] = await users(['Maya Chen'])
  const { page } = u

  // 1) Authenticate (email path; an authed profile-less user lands on onboarding).
  await page.goto('/brief')
  const shell = page.getByTestId('shell-user')
  const onboarding = page.getByText("I'm Alfred.")
  if (!(await shell.or(onboarding).isVisible().catch(() => false))) {
    const emailBtn = page.getByRole('button', { name: /sign in with email/i })
    if (await emailBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await emailBtn.click()
      await page.getByPlaceholder(/email/i).fill('maya-resume-demo@deepspace.test')
      await page.getByPlaceholder(/password/i).fill('TestPass123!')
      await page.getByRole('button', { name: /^sign in$/i }).click()
    }
  }
  await expect(shell.or(onboarding)).toBeVisible({ timeout: 30_000 })

  // JWT for action calls.
  let token: string | null = null
  for (let i = 0; i < 8 && !token; i++) {
    token = await page.evaluate(async () => {
      const r = await fetch('/api/auth/token', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      if (!r.ok) return null
      return ((await r.json()) as { token?: string }).token ?? null
    })
    if (!token) await page.waitForTimeout(1500)
  }
  expect(token, 'auth token').toBeTruthy()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 2) Ensure the shared pool has jobs (free-only backfill if empty).
  const statTotal = async (): Promise<number> => {
    const r = await page.request.get('/api/dev/ingest/stats')
    if (!r.ok()) return 0
    return ((await r.json()) as { total?: number }).total ?? 0
  }
  if ((await statTotal()) < 30) {
    await page.request.post('/api/dev/ingest/run', {
      headers: auth,
      data: { mode: 'backfill', windowDays: 60, maxPerFeed: 160, maxSlugs: 0, skipIntegrations: true },
    })
    await expect.poll(statTotal, { timeout: 150_000, intervals: [3000] }).toBeGreaterThan(30)
  }
  console.log(`[verify] pool total = ${await statTotal()}`)

  // 3) Seed the demo fixture as this account's profile.
  const seed = await page.request.post('/api/actions/dev-seed-profile', { headers: auth, data: {} })
  expect((await seed.json()).success, 'dev-seed-profile').toBeTruthy()

  // 4) Run the digest INLINE: ensure real verdicts, then select -> verify ->
  //    compose -> SEND to the owner address (Resend test mode delivers there).
  const digRes = await page.request.post('/api/actions/dev-run-digest', {
    headers: auth,
    data: { ensureMatches: true, force: true, to: OWNER_TO },
    timeout: 200_000,
  })
  const digJson = (await digRes.json()) as { success: boolean; data?: { ensured?: unknown; result?: DigestResult }; error?: string }
  expect(digJson.success, `dev-run-digest: ${digJson.error ?? ''}`).toBeTruthy()
  const result = digJson.data!.result!
  console.log('[verify] ensured matches:', JSON.stringify(digJson.data!.ensured))
  console.log(`[verify] DIGEST outcome=${result.outcome} recipient=${result.recipient} cadence=${result.cadence}`)
  console.log(`[verify] selected=${result.selected} delivered=${result.delivered} droppedLinks=${result.droppedLinks}`)
  console.log(`[verify] subject="${result.subject}" htmlLength=${result.htmlLength}`)
  console.log(`[verify] sendResult=${JSON.stringify(result.sendResult)} error=${result.error ?? '(none)'}`)
  console.log('[verify] ITEMS (taste-test):')
  for (const it of result.items) {
    console.log(`   [${it.qualify} ${it.score}] ${it.title} @ ${it.company}`)
    console.log(`       ${it.reason}`)
  }

  // Save the result + HTML for the report + screenshot.
  writeFileSync(VERIFY('p5-digest.json'), JSON.stringify(result, null, 2))
  expect(result.subject, 'composed subject').toBeTruthy()
  expect(result.htmlLength, 'composed html').toBeGreaterThan(500)
  expect(result.delivered, 'at least one delivered item').toBeGreaterThan(0)
  // Honesty: no em dashes leaked anywhere user-visible.
  expect(result.subject).not.toMatch(/—/)
  for (const it of result.items) expect(it.reason).not.toMatch(/—/)
  const html = result.html ?? ''
  expect(html).not.toMatch(/—/)
  writeFileSync(VERIFY('p5-digest.html'), html)

  // 5) Render the email HTML and screenshot it.
  await page.setViewportSize({ width: 720, height: 1100 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: VERIFY('p5-digest.png'), fullPage: true })

  // 6) Seed applications across stages for the tracker.
  const seedApps = await page.request.post('/api/actions/dev-seed-applications', { headers: auth, data: {} })
  const seedAppsJson = await seedApps.json()
  expect(seedAppsJson.success, `dev-seed-applications: ${seedAppsJson.error ?? ''}`).toBeTruthy()
  console.log('[verify] seeded applications:', JSON.stringify(seedAppsJson.data))

  // 7) Screenshot the tracker board. Wide enough that all 6 columns (incl.
  //    Offer + Rejected) are visible without horizontal scroll.
  await page.setViewportSize({ width: 1900, height: 900 })
  await page.goto('/tracker')
  await expect(page.getByRole('heading', { name: 'Tracker' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('tracker-card').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Rejected')).toBeVisible({ timeout: 10_000 })
  const cardCount = await page.getByTestId('tracker-card').count()
  console.log(`[verify] tracker cards rendered = ${cardCount}`)
  await page.waitForTimeout(700)
  await page.screenshot({ path: VERIFY('p5-tracker.png') })
  // Narrower view too (matches the prototype's column-scroll framing).
  await page.setViewportSize({ width: 1320, height: 860 })
  await page.goto('/tracker')
  await expect(page.getByTestId('tracker-card').first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: VERIFY('p5-tracker-narrow.png') })

  expect(cardCount).toBeGreaterThan(0)
})
