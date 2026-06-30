/**
 * TrackerBoard (DESIGN-SPEC §3.3) -- the horizontal kanban board.
 *
 * Columns: Saved · Tailored · Applied · Interview · Offer · Rejected. Each is a
 * 260px column with a colored stage dot + label + mono count header over an
 * #EDF0FA well. Cards advance saved -> tailored -> applied -> interview -> offer;
 * a dismiss marks Rejected. Empty columns read "Nothing here yet".
 */
import { TRACKER_COLUMNS } from './columns'
import { TrackerCard } from './TrackerCard'
import { useTrackerData } from './useTrackerData'

export function TrackerBoard() {
  const data = useTrackerData()

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '10px 38px 38px' }}>
      <div style={{ display: 'flex', gap: 16, height: '100%', minWidth: 'min-content' }}>
        {TRACKER_COLUMNS.map((col) => {
          const rows = data.byStage.get(col.stage) ?? []
          const isTerminal = col.stage === 'offer' || col.stage === 'rejected'
          const isRejected = col.stage === 'rejected'
          return (
            <div key={col.stage} style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--alf-ink)' }}>{col.label}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--alf-meta)', marginLeft: 'auto' }}>{rows.length}</span>
              </div>
              <div
                data-testid={`tracker-col-${col.stage}`}
                style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--alf-list)', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {rows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 8px', fontSize: 12.5, color: 'var(--alf-faint-2)' }}>Nothing here yet</div>
                ) : (
                  rows.map((row) => (
                    <TrackerCard
                      key={row.appId}
                      company={row.job.company}
                      title={row.job.title}
                      onOpen={() => data.open(row.jobId)}
                      onAdvance={() => void data.advance(row.appId, row.stage)}
                      onDismiss={() => void data.dismiss(row.appId)}
                      canAdvance={!isTerminal}
                      canDismiss={!isRejected}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
