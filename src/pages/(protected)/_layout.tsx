/**
 * Gated routes. Any file under src/pages/(protected)/ requires sign-in and
 * renders inside Alfred's AppShell (the left icon rail + content area).
 *
 * The `(protected)` folder is a Generouted route group — parentheses mean it
 * doesn't appear in the URL. Add public pages outside this folder.
 *
 * Onboarding gate: a signed-in user with NO master `profile` row hasn't finished
 * onboarding, so we redirect them to the full-screen /onboarding flow (which
 * lives OUTSIDE this layout). Profile-row existence == onboarding complete.
 *
 * Children may call data hooks like `useUser()` safely because _app.tsx mounts
 * <RecordProvider> above this layout.
 */

import { Outlet, Navigate } from 'react-router-dom'
import { AuthGate, useAuthProfileReady, useQuery } from 'deepspace'
import type { ProfileData } from '../../types'
import { AppShell } from '../../components/shell/AppShell'

export default function ProtectedLayout() {
  return (
    <AuthGate>
      <ShelledRoutes />
    </AuthGate>
  )
}

function ShelledRoutes() {
  const { user } = useAuthProfileReady({ requireUser: true })
  const profile = useQuery<ProfileData>('profile')

  // Wait for the profile query before deciding (avoids a redirect flash).
  if (profile.status === 'loading') {
    return <div style={{ height: '100vh', background: 'var(--alf-bg)' }} />
  }
  if (profile.status === 'ready' && profile.records.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  const initial = (user?.name ?? 'A').trim().charAt(0).toUpperCase() || 'A'
  return (
    <AppShell userInitial={initial} userName={user?.name ?? undefined}>
      <Outlet />
    </AppShell>
  )
}
