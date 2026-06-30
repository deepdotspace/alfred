/**
 * Chip / pill family from DESIGN-SPEC §4.
 *  - Chip            : multiselect (selected indigo fill / unselected white)
 *  - AddChip         : dashed indigo "+ Add \"{q}\""
 *  - StageSegmented  : the stage 4-up (block chips, radius 14)
 *  - PillToggle      : segmented pill track (pay year/hour, doc switch)
 *  - MetaPill        : detail meta pill (white, radius 10)
 *  - ResumeChip      : resume-learned chip (#EEF1FC)
 *  - DocSkillChip    : skills on the generated résumé (#F1F4FC, radius 8)
 *  - RefineChip      : refine quick-action chip (#EEF1FF + border)
 */
import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

const CHIP_TRANSITION = 'all .15s'

/* ── Multiselect chip ─────────────────────────────────────── */
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  children: ReactNode
}
export function Chip({ selected = false, children, style, ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      style={{
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 500,
        padding: '9px 16px',
        borderRadius: 99,
        cursor: 'pointer',
        transition: CHIP_TRANSITION,
        border: `1.5px solid ${selected ? 'var(--alf-indigo)' : 'var(--alf-input-border)'}`,
        background: selected ? 'var(--alf-indigo)' : 'var(--alf-surface)',
        color: selected ? '#fff' : 'var(--alf-body-4)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/* ── Dashed add chip ──────────────────────────────────────── */
export interface AddChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  query: string
}
export function AddChip({ query, style, ...rest }: AddChipProps) {
  return (
    <button
      {...rest}
      style={{
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        padding: '9px 16px',
        borderRadius: 99,
        cursor: 'pointer',
        border: '1.5px dashed var(--alf-indigo)',
        background: 'var(--alf-indigo-tint-2)',
        color: 'var(--alf-indigo)',
        ...style,
      }}
    >
      + Add &ldquo;{query}&rdquo;
    </button>
  )
}

/* ── Stage segmented (4-up block chips) ───────────────────── */
export interface SegmentedOption<T extends string = string> {
  value: T
  label: string
}
export interface StageSegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** profile uses min-width:120 + wrap; onboarding uses flex:1 no wrap. */
  wrap?: boolean
}
export function StageSegmented<T extends string = string>({ options, value, onChange, wrap = false }: StageSegmentedProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: wrap ? 'wrap' : undefined }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              minWidth: wrap ? 120 : undefined,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              padding: 13,
              borderRadius: 14,
              cursor: 'pointer',
              transition: CHIP_TRANSITION,
              border: `1.5px solid ${active ? 'var(--alf-indigo)' : 'var(--alf-input-border)'}`,
              background: active ? 'var(--alf-indigo)' : 'var(--alf-surface)',
              color: active ? '#fff' : 'var(--alf-body-4)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Stage multi-select (block chips, toggle any combination) ─ */
export interface StageMultiSelectProps<T extends string = string> {
  options: SegmentedOption<T>[]
  values: T[]
  onToggle: (value: T) => void
  /** profile wraps with a min-width; onboarding lets the row share width. */
  wrap?: boolean
}
export function StageMultiSelect<T extends string = string>({ options, values, onToggle, wrap = false }: StageMultiSelectProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: wrap ? 'wrap' : undefined }}>
      {options.map((o) => {
        const active = values.includes(o.value)
        return (
          <button
            key={o.value}
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(o.value)}
            style={{
              flex: 1,
              minWidth: wrap ? 120 : 0,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              padding: 13,
              borderRadius: 14,
              cursor: 'pointer',
              transition: CHIP_TRANSITION,
              border: `1.5px solid ${active ? 'var(--alf-indigo)' : 'var(--alf-input-border)'}`,
              background: active ? 'var(--alf-indigo)' : 'var(--alf-surface)',
              color: active ? '#fff' : 'var(--alf-body-4)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Pill toggle (segmented pill track) ───────────────────── */
export interface PillToggleProps<T extends string = string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** pay = #EEF1FA track / indigo active text; doc = #DFE5F4 track / ink active text. */
  variant?: 'pay' | 'doc'
}
export function PillToggle<T extends string = string>({ options, value, onChange, variant = 'pay' }: PillToggleProps<T>) {
  const isPay = variant === 'pay'
  return (
    <div
      style={{
        display: 'flex',
        gap: isPay ? 0 : 6,
        background: isPay ? 'var(--alf-pay-track)' : 'var(--alf-doc-track)',
        borderRadius: 99,
        padding: isPay ? 3 : 4,
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              fontFamily: 'inherit',
              fontSize: isPay ? 12.5 : 14,
              fontWeight: 600,
              padding: isPay ? '6px 13px' : '9px 22px',
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              transition: CHIP_TRANSITION,
              background: active ? '#fff' : 'transparent',
              color: active ? (isPay ? 'var(--alf-indigo)' : 'var(--alf-ink)') : (isPay ? 'var(--alf-meta)' : 'var(--alf-muted)'),
              boxShadow: active ? (isPay ? '0 1px 3px rgba(30,36,64,.12)' : '0 1px 3px rgba(30,40,80,.14)') : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Meta pill (detail) ───────────────────────────────────── */
export function MetaPill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--alf-body-4)',
        background: 'var(--alf-surface)',
        border: '1px solid var(--alf-border)',
        padding: '7px 13px',
        borderRadius: 10,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/* ── Resume-learned chip ──────────────────────────────────── */
export function ResumeChip({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 500, padding: '7px 13px', borderRadius: 99, background: '#EEF1FC', color: '#3A4270' }}>
      {children}
    </span>
  )
}

/* ── Doc skill chip ───────────────────────────────────────── */
export function DocSkillChip({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--alf-body-3)', background: 'var(--alf-chip-soft)', padding: '6px 12px', borderRadius: 8 }}>
      {children}
    </span>
  )
}

/* ── Refine quick-action chip ─────────────────────────────── */
export function RefineChip({ children, style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      style={{
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--alf-indigo)',
        background: 'var(--alf-indigo-tint-2)',
        border: '1px solid var(--alf-chip-border)',
        padding: '7px 13px',
        borderRadius: 99,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
