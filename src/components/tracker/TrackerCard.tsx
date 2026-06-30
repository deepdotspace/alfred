/**
 * Tracker card (DESIGN-SPEC §3.3 / §4).
 *
 * Pixel-faithful to the prototype's tracker card (white, 1px #E6EAF6, radius 14,
 * pad 14; 30x30 company avatar; title ellipsis + company), with the actions our
 * data model adds on top of the prototype: Open -> opens the role in the brief,
 * advance -> next stage, and a dismiss -> Rejected.
 *
 * Built in the tracker lane (not the shared ui/alfred primitive) so the dismiss
 * affordance can be added without modifying the design primitive.
 */
import { useState } from 'react'
import { avatarColors, companyInitial } from '../brief/helpers'

export interface TrackerCardProps {
  company: string
  title: string
  onOpen: () => void
  onAdvance?: () => void
  onDismiss?: () => void
  /** Hidden in Offer / Rejected (terminal stages). */
  canAdvance?: boolean
  /** Hidden in Rejected. */
  canDismiss?: boolean
}

export function TrackerCard({ company, title, onOpen, onAdvance, onDismiss, canAdvance = true, canDismiss = true }: TrackerCardProps) {
  const { bg, fg } = avatarColors(company)
  const [hover, setHover] = useState(false)
  return (
    <div
      data-testid="tracker-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--alf-surface)',
        border: `1px solid ${hover ? 'var(--alf-halo)' : 'var(--alf-border-soft)'}`,
        borderRadius: 14,
        padding: 14,
        transition: 'border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            flexShrink: 0,
            background: bg,
            color: fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {companyInitial(company)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2, color: 'var(--alf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--alf-helper)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onOpen}
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--alf-muted-2)', background: 'var(--alf-chip-soft)', border: 'none', padding: 7, borderRadius: 8, cursor: 'pointer' }}
        >
          Open
        </button>
        {canDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            title="Not pursuing"
            aria-label="Dismiss"
            style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, lineHeight: 1, color: 'var(--alf-disabled)', background: 'transparent', border: 'none', padding: '7px 9px', borderRadius: 8, cursor: 'pointer' }}
          >
            ×
          </button>
        )}
        {canAdvance && onAdvance && (
          <button
            onClick={onAdvance}
            title="Move forward"
            aria-label="Move forward"
            style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint)', border: 'none', padding: '7px 11px', borderRadius: 8, cursor: 'pointer' }}
          >
            →
          </button>
        )}
      </div>
    </div>
  )
}
