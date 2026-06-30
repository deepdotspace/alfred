/**
 * TrustNote (DESIGN-SPEC §4): the honesty / status card. One component, three
 * tones that cover every honesty/status surface in the app:
 *  - soft    : the refine trust note + ref-editor footer (#F6F8FE, star icon)
 *  - amber   : the "Before you send" gaps reminder (#FFF6EC / #F6E2C8)
 *  - success : the "LAST CHANGE" note (#EAF4F1 / #CDE9E0, with a label)
 */
import type { CSSProperties, ReactNode } from 'react'
import { StarIcon, WarnCircleIcon } from './icons'

export type TrustTone = 'soft' | 'amber' | 'success'

export interface TrustNoteProps {
  tone?: TrustTone
  /** success tone label, e.g. "LAST CHANGE". */
  label?: string
  /** override the leading icon (soft defaults to a star, amber to a warning). */
  icon?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

export function TrustNote({ tone = 'soft', label, icon, children, style }: TrustNoteProps) {
  if (tone === 'success') {
    return (
      <div style={{ background: 'var(--alf-lastchange-bg)', border: '1px solid var(--alf-lastchange-border)', borderRadius: 12, padding: '13px 15px', animation: 'fadeUp .3s ease both', ...style }}>
        {label && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--alf-strong-fg)', marginBottom: 4 }}>{label}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--alf-lastchange-text)' }}>{children}</div>
      </div>
    )
  }

  if (tone === 'amber') {
    return (
      <div style={{ display: 'flex', gap: 12, background: 'var(--alf-amber-bg)', border: '1px solid var(--alf-amber-border)', borderRadius: 16, padding: '15px 18px', ...style }}>
        <div style={{ flexShrink: 0, marginTop: 1, color: 'var(--alf-amber-icon)' }}>{icon ?? <WarnCircleIcon size={18} />}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--alf-amber-text)' }}>{children}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, background: 'var(--alf-trust)', borderRadius: 12, padding: '13px 15px', ...style }}>
      <div style={{ flexShrink: 0, marginTop: 1, color: 'var(--alf-sparkle-icon)' }}>{icon ?? <StarIcon size={15} />}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--alf-helper)' }}>{children}</div>
    </div>
  )
}
