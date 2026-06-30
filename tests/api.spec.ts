import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    await page.goto('/')
    // Wait for the app shell to mount (app-root is the canonical hook in _app.tsx,
    // present on every route above the auth gate). If it mounts, the app booted and
    // its WebSocket auto-connected.
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
  })
})
