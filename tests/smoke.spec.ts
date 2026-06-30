import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. `app-root` is the canonical shell hook
 * wired in src/pages/_app.tsx and is present on every route (it wraps the
 * router outlet, above the auth gate).
 *
 * NOTE (design-foundation phase): Alfred replaced the scaffold's top
 * <Navigation> bar with the left icon rail (AppShell, gated routes) + a future
 * public landing. The earlier scaffold smoke assertions (app-navigation /
 * nav-sign-in-button / nav-user-name) no longer apply. This smoke verifies the
 * app mounts cleanly and the design system renders; the auth/landing phase
 * will extend it (and update collab.spec.ts's identity assertions).
 */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dev-ui')
    await waitForApp(page)
    await expect(page.getByText('Alfred design system')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('design system renders the mascot + primitives', async ({ page }) => {
    await page.goto('/dev-ui')
    await waitForApp(page)
    await expect(page.getByText("Alfred's read")).toBeVisible()
    await expect(page.getByText('Fire a toast')).toBeVisible()
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
