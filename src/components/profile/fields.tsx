/**
 * Small editable-field primitives for the Profile page, in the Alfred design
 * language (inset #FBFCFF inputs, soft borders). Kept local to the profile
 * surface so the design-system primitives in ui/alfred stay presentational.
 */
import { type CSSProperties, type ReactNode } from 'react'

const inputBase: CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 14,
  color: 'var(--alf-ink)',
  background: 'var(--alf-inset)',
  border: '1px solid var(--alf-input-border)',
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
}

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  style?: CSSProperties
}) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={props.onBlur}
      style={{ ...inputBase, ...props.style }}
    />
  )
}

export function TextArea(props: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  minHeight?: number
  style?: CSSProperties
}) {
  return (
    <textarea
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={props.onBlur}
      style={{ ...inputBase, minHeight: props.minHeight ?? 64, resize: 'vertical', lineHeight: 1.5, ...props.style }}
    />
  )
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--alf-label)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

/** A white section card with a heading + optional subtitle. */
export function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 18, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: subtitle ? 4 : 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--alf-helper)', margin: '0 0 16px', lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </div>
  )
}

/** A nested entry card (a single work role / project / education / reference). */
export function SubCard({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', background: 'var(--alf-inset)', border: '1px solid var(--alf-border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove"
          style={{ position: 'absolute', top: 12, right: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          Remove
        </button>
      )}
      {children}
    </div>
  )
}

export function AddBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint)', border: 'none', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}

/** Two inputs side by side. */
export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>
}
