/**
 * P4 UI screenshots -- the Tailor & apply tab states + the Document Workspace.
 *
 * Kept separate from the honesty proof (tailor.e2e) so it does NO inline
 * pipeline previews and fits the time budget: it kicks the REAL tailor-doc Job
 * once via the actual button, captures idle/working/ready, then opens the
 * workspace (resume + cover-gating). Compare to ws-resume.png / ws-dl.png + §3.2.
 *
 * Run with: npx deepspace test e2e
 */
import { test, expect } from 'deepspace/testing'
import { fileURLToPath } from 'node:url'

const VERIFY = (name: string) => fileURLToPath(new URL(`../docs/design/verify/${name}`, import.meta.url))

test('tailor tab states + document workspace (screenshots)', async ({ users }) => {
  test.setTimeout(420_000)
  const [u] = await users(['Maya Chen'])
  const { page } = u

  await page.goto('/brief')
  const shell = page.getByTestId('shell-user')
  const onboarding = page.getByText("I'm Alfred.")
  if (!(await shell.or(onboarding).isVisible().catch(() => false))) {
    const emailBtn = page.getByRole('button', { name: /sign in with email/i })
    if (await emailBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await emailBtn.click()
      await page.getByPlaceholder(/email/i).fill('maya-tailorui-demo@deepspace.test')
      await page.getByPlaceholder(/password/i).fill('TestPass123!')
      await page.getByRole('button', { name: /^sign in$/i }).click()
    }
  }
  await expect(shell.or(onboarding)).toBeVisible({ timeout: 30_000 })

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

  const statTotal = async (): Promise<number> => {
    const r = await page.request.get('/api/dev/ingest/stats')
    if (!r.ok()) return 0
    return ((await r.json()) as { total?: number }).total ?? 0
  }
  if ((await statTotal()) < 30) {
    await page.request.post('/api/dev/ingest/run', { headers: auth, data: { mode: 'backfill', windowDays: 60, maxPerFeed: 160, maxSlugs: 0, skipIntegrations: true } })
    await expect.poll(statTotal, { timeout: 150_000, intervals: [3000] }).toBeGreaterThan(30)
  }

  await page.request.post('/api/actions/dev-seed-profile', { headers: auth, data: {} })
  await page.request.post('/api/actions/match-recompute', { headers: auth, data: { mode: 'full' } })

  await page.setViewportSize({ width: 1320, height: 880 })
  await page.goto('/brief')
  await expect(page.getByTestId('brief-card').first()).toBeVisible({ timeout: 180_000 })
  await page.getByTestId('brief-card').first().click()
  await expect(page.getByTestId('role-detail')).toBeVisible({ timeout: 10_000 })

  // Tailor & apply -> idle.
  await page.getByRole('button', { name: 'Tailor & apply' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: VERIFY('p4-tab-idle.png') })

  // Kick the real Job -> working.
  await page.getByRole('button', { name: /Tailor my resume/i }).click()
  await page.waitForTimeout(1100)
  await page.screenshot({ path: VERIFY('p4-tab-working.png') })

  // Ready (Job completes + writes generated_doc, streams to the brief).
  await expect(page.getByText(/are ready/i)).toBeVisible({ timeout: 300_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: VERIFY('p4-tab-ready.png') })

  // Workspace -> resume.
  await page.getByRole('button', { name: /Review & refine/i }).click()
  await expect(page.getByText(/Refine with Alfred/i)).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: VERIFY('p4-workspace-resume.png') })

  // Cover tab -> gating prompt (this account has no writing sample).
  await page.getByRole('button', { name: 'Cover letter' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: VERIFY('p4-workspace-cover.png') })

  console.log('[verify] P4 UI screenshots written.')
})
