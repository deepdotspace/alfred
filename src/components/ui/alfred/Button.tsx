/**
 * Alfred Button — the full button catalog from DESIGN-SPEC §4.
 *
 * Variants:
 *  - primary-lg   : pill, 16px, indigo, glow shadow + hover lift (onboarding CTAs)
 *  - primary-md   : pill, 15px, indigo (Continue, Tailor); `elevated` adds the glow
 *  - primary-rect : rounded-rect, full-width by default (Regenerate); pass
 *                   radius/block for the compact Save button
 *  - dark-cta     : ink pill, "Open application" (block + radius override for workspace)
 *  - soft         : indigo-tint pill (+Add / View&edit / advance); tone tint|tint2
 *  - secondary    : #F1F4FC chip ("Back to role/settings")
 *  - ghost        : transparent text button (Back / Remove)
 *  - icon         : 40x40 square (download)
 *
 * States: `disabled` (indigo -> muted, not-allowed) and `working` (indigo -> working
 * tint, default cursor). Resting appearance is exact; hover lift is applied to the
 * elevated primaries + icon button.
 */
import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode, useState } from 'react'

export type AlfButtonVariant =
  | 'primary-lg'
  | 'primary-md'
  | 'primary-rect'
  | 'dark-cta'
  | 'soft'
  | 'secondary'
  | 'ghost'
  | 'icon'

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: AlfButtonVariant
  working?: boolean
  /** Add the indigo glow shadow on primary-md (lg always has it). */
  elevated?: boolean
  /** Full-width. */
  block?: boolean
  /** soft tone: tint = #E9EEFF, tint2 = #EEF1FF. */
  tone?: 'tint' | 'tint2'
  /** Override corner radius (px). */
  radius?: number
  leftIcon?: ReactNode
  children?: ReactNode
}

const GLOW_LG = '0 10px 24px -8px rgba(61,90,241,.6)'
const GLOW_LG_HOVER = '0 14px 30px -8px rgba(61,90,241,.7)'
const GLOW_MD = '0 10px 22px -8px rgba(61,90,241,.55)'

export function Button({
  variant = 'primary-md',
  working = false,
  elevated = false,
  block = false,
  tone = 'tint',
  radius,
  leftIcon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false)

  const base: CSSProperties = {
    fontFamily: 'inherit',
    fontWeight: 600,
    border: 'none',
    cursor: disabled ? 'not-allowed' : working ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'transform .15s, box-shadow .15s, background .15s, border-color .18s, color .15s',
    width: block ? '100%' : undefined,
  }

  let v: CSSProperties = {}
  switch (variant) {
    case 'primary-lg':
      v = {
        background: disabled ? 'var(--alf-indigo-disabled)' : working ? 'var(--alf-indigo-working)' : 'var(--alf-indigo)',
        color: '#fff',
        fontSize: 16,
        padding: '15px 34px',
        borderRadius: 99,
        boxShadow: disabled ? 'none' : hover ? GLOW_LG_HOVER : GLOW_LG,
        transform: !disabled && !working && hover ? 'translateY(-2px)' : undefined,
      }
      break
    case 'primary-md':
      v = {
        background: disabled ? 'var(--alf-indigo-disabled)' : working ? 'var(--alf-indigo-working)' : 'var(--alf-indigo)',
        color: '#fff',
        fontSize: 15,
        padding: '14px 30px',
        borderRadius: 99,
        boxShadow: elevated && !disabled ? GLOW_MD : undefined,
        transform: elevated && !disabled && !working && hover ? 'translateY(-2px)' : undefined,
      }
      break
    case 'primary-rect':
      v = {
        background: disabled ? 'var(--alf-indigo-disabled)' : working ? 'var(--alf-indigo-working)' : 'var(--alf-indigo)',
        color: '#fff',
        fontSize: 15,
        padding: '14px',
        borderRadius: radius ?? 13,
        width: block ? '100%' : undefined,
      }
      break
    case 'dark-cta':
      v = {
        background: 'var(--alf-ink)',
        color: '#fff',
        fontSize: 15,
        padding: '13px 26px',
        borderRadius: radius ?? 99,
      }
      break
    case 'soft':
      v = {
        background: tone === 'tint2' ? 'var(--alf-indigo-tint-2)' : 'var(--alf-indigo-tint)',
        color: 'var(--alf-indigo)',
        fontSize: 13.5,
        padding: '9px 15px',
        borderRadius: radius ?? 10,
      }
      break
    case 'secondary':
      v = {
        background: 'var(--alf-chip-soft)',
        color: 'var(--alf-muted-2)',
        fontSize: 14,
        padding: '10px 16px',
        borderRadius: radius ?? 10,
      }
      break
    case 'ghost':
      v = {
        background: 'transparent',
        color: '#4A527E',
        fontSize: 15,
        padding: '14px 22px',
        borderRadius: radius ?? 0,
      }
      break
    case 'icon':
      v = {
        background: hover ? 'var(--alf-indigo-tint)' : 'var(--alf-inset)',
        color: 'var(--alf-indigo)',
        width: 40,
        height: 40,
        borderRadius: radius ?? 11,
        border: `1px solid ${hover ? 'var(--alf-hover-border)' : 'var(--alf-border)'}`,
        boxShadow: '0 1px 3px rgba(30,40,80,.08)',
        padding: 0,
      }
      break
  }

  return (
    <button
      {...rest}
      disabled={disabled || working}
      style={{ ...base, ...v, ...style }}
      onMouseEnter={(e) => { setHover(true); rest.onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setHover(false); rest.onMouseLeave?.(e) }}
    >
      {leftIcon}
      {children}
    </button>
  )
}
