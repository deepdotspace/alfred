/**
 * Alfred icon set — inline SVGs extracted verbatim from the prototype.
 * All use `currentColor` so the caller controls color via `color`/`style`.
 * Sizes default to the prototype's, override with `size`.
 */
import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
}

export function SearchIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon({ size = 14, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DownloadIcon({ size = 19, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3.5v11M12 14.5l-4.2-4M12 14.5l4.2-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 19.5h13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function RefreshIcon({ size = 17, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M3 12a9 9 0 0114.5-7M21 12a9 9 0 01-14.5 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 3v5h-5M7 21v-5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StarIcon({ size = 15, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.5-.5z" fill="currentColor" />
    </svg>
  )
}

export function PencilIcon({ size = 13, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M4 20l4-1 9.5-9.5a2 2 0 000-3l-1-1a2 2 0 00-3 0L4 15l-1 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/** Gaps-reminder warning: exclamation inside a ring. */
export function WarnCircleIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v6M12 16.2v.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Small bare exclamation (sits inside the fit-tab amber circle). */
export function BangIcon({ size = 12, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Resume dropzone: up-arrow over a tray. */
export function UploadIcon({ size = 22, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 16V4M12 4L7 9M12 4l5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/* ── Nav rail glyphs (fill currentColor) ─────────────────────── */

/** Brief = morning "sun": center dot + 8 rays. */
export function SunIcon({ size = 22, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
      </g>
    </svg>
  )
}

/** Tracker = three kanban bars of varied height/opacity. */
export function KanbanIcon({ size = 22, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x="3" y="5" width="5" height="14" rx="2" fill="currentColor" />
      <rect x="9.5" y="5" width="5" height="9" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="16" y="5" width="5" height="11" rx="2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

/** Profile = person (head + shoulders). */
export function PersonIcon({ size = 22, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4.5 20c0-4.2 3.4-6.5 7.5-6.5s7.5 2.3 7.5 6.5" fill="currentColor" />
    </svg>
  )
}
