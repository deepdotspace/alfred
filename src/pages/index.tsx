import { Navigate } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { Landing } from '../components/landing/Landing'

/**
 * Public home. Signed-out visitors get the landing (the night-to-morning
 * day-cycle); signed-in visitors go straight to their morning brief. Auth has
 * already resolved by here (AuthBoot in _app.tsx gates on isLoaded), so the
 * landing never flashes the auth overlay.
 */
export default function Index() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <Navigate to="/brief" replace />
  return <Landing />
}
