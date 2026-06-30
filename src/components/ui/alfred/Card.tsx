/**
 * Card surfaces (DESIGN-SPEC §4).
 *  - Card        : the white #fff / 1px #E2E8F8 / radius-18 workhorse surface
 *  - RoleCard    : the brief-list role card (avatar + title + reason + meta + fit)
 *  - TrackerCard : the kanban card (avatar + title + Open/advance)
 */
import { type CSSProperties, type ReactNode, useState } from 'react'
import { FitBadge, type FitVariant } from './FitBadge'

/* ── Generic card surface ─────────────────────────────────── */
export interface CardProps {
  children: ReactNode
  radius?: number
  padding?: number | string
  border?: string
  className?: string
  style?: CSSProperties
}
export function Card({ children, radius = 18, padding = '20px 22px', border = 'var(--alf-border)', className, style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--alf-surface)',
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ── Role / job card (brief list) ─────────────────────────── */
export interface RoleCardProps {
  initial: string
  avBg: string
  avFg: string
  title: string
  company: string
  reason: string
  metaLine: string
  fitLabel: string
  fitScore: number | string
  fitVariant: FitVariant
  /** strong fits get the #DCE3F7 border; others #E6EAF6. */
  strong?: boolean
  onClick?: () => void
  /** cardIn stagger delay, e.g. "0.14s". */
  delay?: string
}
export function RoleCard({ initial, avBg, avFg, title, company, reason, metaLine, fitLabel, fitScore, fitVariant, strong = false, onClick, delay = '0s' }: RoleCardProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        // width:100% + box-sizing keeps every card uniform: a <button> defaults
        // to fit-content, so a long title (which is nowrap+ellipsis) would
        // otherwise stretch its card wider than the rest.
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
        border: `1.5px solid ${hover ? 'var(--alf-halo)' : strong ? 'var(--alf-strong-border)' : 'var(--alf-border-soft)'}`,
        background: 'var(--alf-surface)',
        borderRadius: 18,
        padding: '17px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        transition: 'all .18s',
        animation: `cardIn .5s ease both`,
        animationDelay: delay,
        transform: hover ? 'translateY(-2px)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: avBg, color: avFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--alf-muted)' }}>{company}</div>
          </div>
        </div>
        <span style={{ flexShrink: 0 }}>
          <FitBadge label={fitLabel} score={fitScore} variant={fitVariant} size="card" />
        </span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--alf-body-4)' }}>{reason}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--alf-meta)' }}>{metaLine}</span>
      </div>
    </button>
  )
}

/* ── Tracker card ─────────────────────────────────────────── */
export interface TrackerCardProps {
  initial: string
  avBg: string
  avFg: string
  title: string
  company: string
  onOpen?: () => void
  onAdvance?: () => void
  canAdvance?: boolean
}
export function TrackerCard({ initial, avBg, avFg, title, company, onOpen, onAdvance, canAdvance = true }: TrackerCardProps) {
  return (
    <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border-soft)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: avBg, color: avFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--alf-helper)' }}>{company}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onOpen} style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--alf-muted-2)', background: 'var(--alf-chip-soft)', border: 'none', padding: 7, borderRadius: 8, cursor: 'pointer' }}>Open</button>
        {canAdvance && (
          <button onClick={onAdvance} title="Move forward" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint)', border: 'none', padding: '7px 11px', borderRadius: 8, cursor: 'pointer' }}>→</button>
        )}
      </div>
    </div>
  )
}
