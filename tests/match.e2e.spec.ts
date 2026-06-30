/**
 * P3 verification e2e -- proves the matcher against the LIVE pool with the demo
 * fixture, then screenshots the brief surfaces.
 *
 * Flow: sign in a test account -> ensure the pool is populated -> seed the demo
 * profile (dev action) -> run an inline preview (real hard-filter + real Haiku,
 * no writes) and dump it for the taste-test -> kick a real recompute -> wait for
 * the brief to fill -> screenshot list / greeting / detail / the three tabs.
 *
 * Run with: npx deepspace test e2e   (only *e2e* specs match)
 */
import { test, expect } from 'deepspace/testing'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const VERIFY = (name: string) => fileURLToPath(new URL(`../docs/design/verify/${name}`, import.meta.url))

interface PreviewResult {
  poolSize: number
  survived: number
  scored: number
  rejectedSamples: { title: string; company: string; reason: string }[]
  verdicts: { job_id: string; qualify: string; score: number; reason: string; matched: string[]; missing: string[]; timing: string }[]
  jobs: Record<string, { title: string; company: string }>
}

test('matcher produces honest verdicts on the demo fixture + brief renders', async ({ users }) => {
  test.setTimeout(300_000)
  const [u] = await users(['Maya Chen'])
  const { page } = u

  // 1) Authenticate. A stale cached session shows the AuthOverlay -> sign in via
  //    the email path (pool accounts work; avoid /continue/i = GitHub). An authed
  //    user with NO profile lands on P2's onboarding ("I'm Alfred."), NOT the
  //    brief shell -- so treat EITHER as "authenticated".
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

  // JWT for action calls (session is now valid -> getAuthToken's endpoint works).
  let token: string | null = null
  for (let i = 0; i < 8 && !token; i++) {
    token = await page.evaluate(async () => {
      const r = await fetch('/api/auth/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
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
    await expect
      .poll(statTotal, { timeout: 150_000, intervals: [3000] })
      .toBeGreaterThan(30)
  }
  const poolTotal = await statTotal()
  console.log(`[verify] pool total = ${poolTotal}`)

  // 3) Seed the demo fixture as this account's profile.
  const seed = await page.request.post('/api/actions/dev-seed-profile', { headers: auth, data: {} })
  expect((await seed.json()).success, 'dev-seed-profile').toBeTruthy()

  // 4) Inline preview = real hard-filter + real Haiku, no writes. The taste-test.
  const prevRes = await page.request.post('/api/actions/dev-match-preview', { headers: auth, data: {}, timeout: 150_000 })
  const preview = (await prevRes.json()).data as PreviewResult
  writeFileSync(VERIFY('p3-preview.json'), JSON.stringify(preview, null, 2))
  console.log(
    `[verify] poolSize=${preview.poolSize} survived=${preview.survived} scored=${preview.scored} ` +
      `verdicts=${preview.verdicts.length}`,
  )
  console.log('[verify] REJECTED (hard filters):')
  for (const r of preview.rejectedSamples) console.log(`   - ${r.title} @ ${r.company} -> ${r.reason}`)
  console.log('[verify] TOP VERDICTS:')
  for (const v of preview.verdicts.slice(0, 6)) {
    const j = preview.jobs[v.job_id]
    console.log(`   [${v.qualify} ${v.score}] ${j?.title} @ ${j?.company}`)
    console.log(`       reason: ${v.reason}`)
    console.log(`       matched: ${v.matched.join(' | ')}`)
    console.log(`       missing: ${v.missing.join(' | ')}`)
  }
  expect(preview.survived, 'some jobs survive the hard filter').toBeGreaterThan(0)
  expect(preview.verdicts.length, 'Haiku returned verdicts').toBeGreaterThan(0)
  // Honesty smoke: no em dashes leaked into any user-visible string.
  for (const v of preview.verdicts) {
    expect(v.reason).not.toMatch(/—/)
    for (const s of [...v.matched, ...v.missing]) expect(s).not.toMatch(/—/)
  }

  // 5) Real recompute -> writes match rows the brief reads live.
  await page.request.post('/api/actions/match-recompute', { headers: auth, data: { mode: 'full' } })

  // 6) Brief fills in (the match-user Job streams verdicts over WebSocket).
  await page.setViewportSize({ width: 1320, height: 860 })
  await page.goto('/brief')
  await expect(page.getByTestId('brief-card').first()).toBeVisible({ timeout: 180_000 })
  const cardCount = await page.getByTestId('brief-card').count()
  console.log(`[verify] brief cards rendered = ${cardCount}`)

  // Default view = list + greeting hero.
  await page.waitForTimeout(800)
  await page.screenshot({ path: VERIFY('p3-brief-default.png') })

  // Open the first role -> detail (Alfred's read tab).
  await page.getByTestId('brief-card').first().click()
  await expect(page.getByTestId('role-detail')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: VERIFY('p3-detail-fit.png') })

  // The role tab.
  await page.getByRole('button', { name: 'The role' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: VERIFY('p3-detail-jd.png') })

  // Tailor & apply tab (idle / P4 seam).
  await page.getByRole('button', { name: 'Tailor & apply' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: VERIFY('p3-detail-tailor.png') })

  expect(cardCount).toBeGreaterThan(0)
})
