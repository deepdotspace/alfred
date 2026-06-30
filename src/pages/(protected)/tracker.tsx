/**
 * Tracker -- the kanban board (DESIGN-SPEC §3.3).
 *
 * Header + the horizontal board of the user's applications, grouped by stage.
 * Reads owner-scoped `application` rows joined to the shared `job` pool via
 * useTrackerData; cards advance through the pipeline and can be dismissed to
 * Rejected. Everything pursued, in one calm place.
 */
import { TrackerBoard } from '../../components/tracker/TrackerBoard'

export default function TrackerPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '30px 38px 18px' }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.02em', color: 'var(--alf-ink)' }}>Tracker</h1>
        <p style={{ fontSize: 14, color: 'var(--alf-muted)', margin: 0 }}>Everything you're pursuing, in one calm place.</p>
      </div>
      <TrackerBoard />
    </div>
  )
}
