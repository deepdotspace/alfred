/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * Pre-create the test accounts once (counted against your 10-cap):
 *   npx deepspace test-accounts create --email collab-a@deepspace.test --password TestPass123! --name "Collab A"
 *   npx deepspace test-accounts create --email collab-b@deepspace.test --password TestPass123! --name "Collab B"
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect } from 'deepspace/testing'

test('two users each load their own shell', async ({ users }) => {
  const [a, b] = await users(2)

  await Promise.all([a.page.goto('/'), b.page.goto('/')])

  // Both reach the authed AppShell (left rail avatar), each labelled with their own name.
  await expect(a.page.getByTestId('shell-user')).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByTestId('shell-user')).toBeVisible({ timeout: 15_000 })

  await expect(a.page.getByTestId('shell-user')).toHaveAttribute('title', a.name)
  await expect(b.page.getByTestId('shell-user')).toHaveAttribute('title', b.name)
})
