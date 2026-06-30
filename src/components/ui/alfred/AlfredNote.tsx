/**
 * AlfredNote (DESIGN-SPEC §3.1 / §4): the "Alfred says" bubble. Indigo->teal
 * gradient card with the xs mascot on the left and the butler's line on the right.
 */
import type { ReactNode } from 'react'
import Alfred from '../../Alfred'

export function AlfredNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 13,
        background: 'linear-gradient(135deg, var(--alf-indigo-note-a), var(--alf-indigo-note-b))',
        border: '1px solid var(--alf-strong-border)',
        borderRadius: 18,
        padding: '18px 20px',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Alfred size="xs" />
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--alf-body)' }}>{children}</div>
    </div>
  )
}
