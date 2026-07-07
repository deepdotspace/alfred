/**
 * Alfred — the career-butler mascot.
 *
 * One character, one calm closed-mouth expression (DESIGN-SPEC §5). Rendered
 * at four scales from a single SVG; variation is purely motion + size.
 *   lg 112 (onboarding, brief empty hero) · md 76 (tailor idle/working,
 *   refining overlay) · sm 42 (nav rail, refine header) · xs 34 (Alfred's note).
 *
 * - mood="idle"    : wrapper floats (alfFloat), eyes blink (alfBlink), sparkle.
 * - mood="working" : wrapper bobs (alfBob) for "thinking".
 * - halo           : a separate 2px #9DB4FF ring that pulses (ringPulse),
 *                    drawn around the mascot (onboarding + brief-empty hero).
 *
 * Each instance gets a UNIQUE gradient id (via useId) so multiple copies on
 * one page never share a <defs> id.
 */

import { useId } from 'react'

export type AlfredSize = 'lg' | 'md' | 'sm' | 'xs'
export type AlfredMood = 'idle' | 'working'

const SIZE_PX: Record<AlfredSize, number> = { lg: 112, md: 76, sm: 42, xs: 34 }

export interface AlfredProps {
  size?: AlfredSize
  mood?: AlfredMood
  /** Draw the pulsing halo ring around the mascot. */
  halo?: boolean
  /** Halo inset in px (default -18, per onboarding; brief-empty uses -20). */
  haloInset?: number
  /** Halo pulse duration in seconds (default 2.8; brief-empty uses 3). */
  haloDuration?: number
  className?: string
}

export default function Alfred({
  size = 'lg',
  mood = 'idle',
  halo = false,
  haloInset = -18,
  haloDuration = 2.8,
  className,
}: AlfredProps) {
  const px = SIZE_PX[size]
  const gid = `alfgrad-${useId().replace(/:/g, '')}`

  const wrapperAnim =
    mood === 'working'
      ? 'alfBob 1.4s ease-in-out infinite'
      : 'alfFloat 4s ease-in-out infinite'

  const mascot = (
    <div
      className={halo ? 'alf-anim' : `alf-anim${className ? ` ${className}` : ''}`}
      style={{ width: px, height: px, animation: wrapperAnim }}
      aria-hidden
    >
      <svg width={px} height={px} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gid} x1="20" y1="14" x2="100" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--alf-grad-a)" />
            <stop offset="1" stopColor="var(--alf-grad-b)" />
          </linearGradient>
        </defs>
        {/* ground shadow */}
        <ellipse cx="60" cy="108" rx="30" ry="6" fill="#000" opacity="0.07" />
        {/* head */}
        <rect x="20" y="16" width="80" height="80" rx="34" fill={`url(#${gid})`} />
        <rect x="20" y="16" width="80" height="80" rx="34" fill="#fff" opacity="0.12" style={{ mixBlendMode: 'soft-light' }} />
        <ellipse cx="40" cy="32" rx="13" ry="9" fill="#fff" opacity="0.22" />
        {/* eyes (blink) */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: mood === 'idle' ? 'alfBlink 5s infinite' : undefined }}>
          <circle cx="46" cy="54" r="8" fill="#fff" />
          <circle cx="74" cy="54" r="8" fill="#fff" />
          <circle cx="47.5" cy="55.5" r="4" fill="var(--alf-pupil)" />
          <circle cx="75.5" cy="55.5" r="4" fill="var(--alf-pupil)" />
          <circle cx="49" cy="54" r="1.4" fill="#fff" />
          <circle cx="77" cy="54" r="1.4" fill="#fff" />
        </g>
        {/* smile */}
        <path d="M50 70 Q60 78 70 70" stroke="var(--alf-pupil)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {/* bowtie */}
        <path d="M48 90 L60 84 L72 90 L66 96 L54 96 Z" fill="var(--alf-green)" />
        <circle cx="60" cy="90" r="3.4" fill="var(--alf-green-knot)" />
        {/* sparkle */}
        <circle cx="92" cy="20" r="3" fill="var(--alf-sparkle)" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'sparkle 2.4s infinite ease-in-out' }} />
      </svg>
    </div>
  )

  if (!halo) return mascot

  return (
    <div className={`alf-anim${className ? ` ${className}` : ''}`} style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: haloInset,
          borderRadius: '50%',
          border: '2px solid var(--alf-halo)',
          animation: `ringPulse ${haloDuration}s infinite ease-out`,
        }}
      />
      {mascot}
    </div>
  )
}
