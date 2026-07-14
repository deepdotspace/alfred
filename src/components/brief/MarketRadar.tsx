/**
 * MarketRadar -- the canvas at the heart of "Alfred is reading the market".
 *
 * Adapted from Scout's FieldRadar (the newsletter app's generation screen), but
 * re-skinned for Alfred's light periwinkle surface and, more importantly, wired
 * to REAL numbers. Scout's radar runs off a scripted timeline with a hardcoded
 * "214 sources" because its record carries no live progress. Alfred's match Job
 * reports its true cursor every tick, so this radar shows the actual funnel:
 *
 *   - Each dot is a posting the hard filter chose to read (`total`).
 *   - Dots dim ahead of the cursor are not read yet; the sweep is still coming.
 *   - As `read` advances, dots are resolved: most fade out (not for you), and the
 *     `kept` share lights up indigo and draws a line home to Alfred.
 *
 * The dot COUNT is proportional, not one-per-posting (64 dots stand in for up to
 * 80 postings), which is why the exact figures are always printed as numerals
 * beside it. The proportions themselves are true.
 *
 * Alfred sits at the center where Scout spins its brand glyph: the postings come
 * home to him. He is rendered in the DOM over the canvas, not drawn into it, so
 * the existing mascot (with its blink + float) is reused untouched.
 */
import { useEffect, useRef } from 'react'
import Alfred from '../Alfred'
import type { SearchPhase } from './search'

const PARTICLE_COUNT = 64

interface Particle {
  a: number // angle
  r: number // radius fraction
  tw: number // per-particle twinkle phase
}

/**
 * Deterministic scatter (no Math.random): the dot field must be stable across
 * re-renders, or the postings would visibly teleport as the counters tick.
 * Golden-angle placement also spaces them far more evenly than random does.
 */
function makeParticles(): Particle[] {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5))
  const arr: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    arr.push({
      a: i * GOLDEN,
      r: Math.sqrt((i + 0.5) / PARTICLE_COUNT) * 0.86 + 0.14,
      tw: (i * 0.618) % 1,
    })
  }
  return arr
}

/**
 * The order postings resolve in, as a fixed shuffle of the dots.
 *
 * This matters: golden-angle placement puts low indices nearest the center, so
 * resolving in index order would spiral outward from Alfred and bury the kept
 * dots underneath him. Shuffling means the read front lands all over the field
 * and the keepers show up where you can see them. Deterministic (a seeded LCG,
 * not Math.random) so the field is stable across frames and re-renders.
 */
const RESOLVE_RANK: number[] = (() => {
  const order = Array.from({ length: PARTICLE_COUNT }, (_, i) => i)
  let seed = 0x9e3779b9
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const j = seed % (i + 1)
    const t = order[i]
    order[i] = order[j]
    order[j] = t
  }
  const rank = new Array<number>(PARTICLE_COUNT)
  order.forEach((particle, position) => {
    rank[particle] = position
  })
  return rank
})()

/**
 * Dots to light up for a real count. 64 dots stand in for up to 80 postings, so
 * this is proportional. It rounds any non-zero count up to at least one dot: if
 * Alfred says he kept one role, one dot must be lit.
 */
function dotsFor(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0
  return Math.max(1, (PARTICLE_COUNT * count) / total)
}

/** Read a CSS custom property as "r,g,b" so the canvas tracks the live theme. */
function readRgb(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const clean = raw.replace('#', '')
  if (!clean) return fallback
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return fallback
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export interface MarketRadarProps {
  phase: SearchPhase
  /** Postings this run will read. 0 until the first tick reports. */
  total: number
  /** Postings read so far. */
  read: number
  /** Postings kept so far. */
  kept: number
  reduced?: boolean
  size?: number
}

export function MarketRadar({ phase, total, read, kept, reduced = false, size = 260 }: MarketRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>(makeParticles())
  // Latest values, read inside the rAF loop without re-subscribing it.
  const stateRef = useRef({ phase, total, read, kept })
  stateRef.current = { phase, total, read, kept }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = size
    const H = size
    const maxR = (size / 300) * 132
    const start = performance.now()
    let raf = 0

    const draw = (nowAbs: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const cy = H / 2
      const accent = readRgb('--alf-indigo', '61,90,241')
      const ink = readRgb('--alf-pupil', '35,48,107')
      const { phase, total, read, kept } = stateRef.current
      // Frozen under reduced motion, so the radar becomes a calm still frame.
      const t = reduced ? 0 : (nowAbs - start) / 1000

      // Rings + axes: the quiet graph paper under everything.
      ctx.strokeStyle = `rgba(${accent},0.16)`
      ctx.lineWidth = 1
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (maxR * k) / 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.strokeStyle = `rgba(${accent},0.10)`
      ctx.beginPath()
      ctx.moveTo(cx - maxR, cy)
      ctx.lineTo(cx + maxR, cy)
      ctx.moveTo(cx, cy - maxR)
      ctx.lineTo(cx, cy + maxR)
      ctx.stroke()

      // The sweep: a cone of fading spokes while Alfred is still reading. It
      // stops once every posting is read, so it never implies work that is done.
      if (phase !== 'writing' && !reduced) {
        const sweepA = t * 1.9
        for (let i = 0; i < 30; i++) {
          const a = sweepA - i * 0.042
          ctx.strokeStyle = `rgba(${accent},${0.3 * (1 - i / 30)})`
          ctx.lineWidth = 2.4
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR)
          ctx.stroke()
        }
      }

      // The postings. Rank thresholds keep kept ⊂ read, so a dot can never be
      // "kept" before it has been read.
      const readCut = dotsFor(read, total)
      const keptCut = Math.min(readCut, dotsFor(kept, total))
      const particles = particlesRef.current

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const rank = RESOLVE_RANK[i]
        const x = cx + Math.cos(p.a) * p.r * maxR
        const y = cy + Math.sin(p.a) * p.r * maxR
        const isRead = rank < readCut
        const isKept = rank < keptCut

        if (isKept) {
          // Kept: pulse in the accent and run a line home to Alfred.
          const pulse = reduced ? 0 : 1.6 * Math.abs(Math.sin(t * 3 + p.tw * 6))
          ctx.strokeStyle = `rgba(${accent},${reduced ? 0.3 : 0.22 + 0.2 * Math.abs(Math.sin(t * 2 + p.tw * 4))})`
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(x, y)
          ctx.stroke()

          const pr = 3.6 + pulse
          ctx.fillStyle = `rgba(${accent},0.20)`
          ctx.beginPath()
          ctx.arc(x, y, pr + 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgb(${accent})`
          ctx.beginPath()
          ctx.arc(x, y, pr, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        // Read but not kept: spent, faded back. Not read yet: waiting, with a
        // soft twinkle so the field reads as alive rather than stalled.
        const alpha = isRead ? 0.14 : reduced ? 0.5 : 0.36 + 0.2 * Math.abs(Math.sin(t * 2.2 + p.tw * 7))
        ctx.fillStyle = `rgba(${ink},${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, isRead ? 1.8 : 2.3, 0, Math.PI * 2)
        ctx.fill()
      }

      // A soft halo under the mascot, so he sits in the field rather than on it.
      const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, 46)
      halo.addColorStop(0, `rgba(${accent},0.20)`)
      halo.addColorStop(1, `rgba(${accent},0)`)
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, 46, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [reduced, size])

  return (
    <span style={{ position: 'relative', display: 'block', width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
        aria-hidden
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <Alfred size="md" mood="working" />
      </span>
    </span>
  )
}
