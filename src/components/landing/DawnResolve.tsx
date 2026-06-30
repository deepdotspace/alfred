/**
 * Dawn resolve -- the signature scroll-scrubbed transition. A sticky stage
 * pinned over a tall spacer: as you scroll, the sky cross-fades from night to
 * morning, the dense field of faint listing cards rises and fades away (the
 * market being read), and the statement turns from "thousands" to "a few".
 * The one scroll-scrubbed effect on the page; everything else enters once.
 *
 * Reduced motion / narrow: a calm static version of the same statement.
 */
import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useIsNarrow, useReducedMotion } from './motion'
import { SAMPLE_ENTRIES } from './sample-data'

const SEED = SAMPLE_ENTRIES.map((e) => ({ company: e.job.company, title: e.job.title }))
const RISERS = [...SEED, ...SEED].map((c, i) => ({ id: `rise-${i}`, ...c }))

const NIGHT_BG =
  'radial-gradient(120% 80% at 50% 0%, var(--alf-night-glow), transparent 60%), linear-gradient(180deg, var(--alf-night-2), var(--alf-night-1))'
const DAY_BG =
  'radial-gradient(120% 120% at 50% 0%, var(--alf-dawn-hi), var(--alf-bg) 45%, var(--alf-dawn-lo))'

export function DawnResolve() {
  const reduced = useReducedMotion()
  const narrow = useIsNarrow()
  if (reduced || narrow) return <StaticResolve />
  return <ScrubbedResolve />
}

function ScrubbedResolve() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const nightOpacity = useTransform(p, [0, 0.55], [1, 0])
  const dayOpacity = useTransform(p, [0.15, 0.72], [0, 1])
  const line1Opacity = useTransform(p, [0, 0.18, 0.42], [0, 1, 0])
  const line2Opacity = useTransform(p, [0.52, 0.78], [0, 1])
  const line2Y = useTransform(p, [0.52, 0.78], [16, 0])

  return (
    <div ref={ref} style={{ position: 'relative', height: '200vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* cross-fading sky */}
        <motion.div aria-hidden style={{ position: 'absolute', inset: 0, background: NIGHT_BG, opacity: nightOpacity }} />
        <motion.div aria-hidden style={{ position: 'absolute', inset: 0, background: DAY_BG, opacity: dayOpacity }} />

        {/* the noise rising + thinning */}
        <div style={{ position: 'absolute', inset: 0, left: '12%', right: '12%' }}>
          {RISERS.map((c, i) => (
            <Riser key={c.id} card={c} progress={p} index={i} total={RISERS.length} />
          ))}
        </div>

        {/* the statement */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 24px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'relative', height: 64, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.h2
              style={{
                position: 'absolute',
                opacity: line1Opacity,
                fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
                fontWeight: 600,
                letterSpacing: '-.02em',
                color: 'var(--alf-on-night)',
                margin: 0,
              }}
            >
              Overnight, he reads thousands.
            </motion.h2>
            <motion.h2
              style={{
                position: 'absolute',
                opacity: line2Opacity,
                y: line2Y,
                fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
                fontWeight: 600,
                letterSpacing: '-.02em',
                color: 'var(--alf-ink)',
                margin: 0,
              }}
            >
              By morning, a few.
            </motion.h2>
          </div>
        </div>
      </div>
    </div>
  )
}

function Riser({
  card,
  progress,
  index,
  total,
}: {
  card: { id: string; company: string; title: string }
  progress: MotionValue<number>
  index: number
  total: number
}) {
  const start = -0.1 + (index / total) * 0.72
  const end = start + 0.4
  const y = useTransform(progress, [start, end], [360, -360])
  const scale = useTransform(progress, [start, (start + end) / 2, end], [0.7, 1, 1.04])
  const blur = useTransform(progress, [start, (start + end) / 2, end], [4, 0, 3])
  const filter = useTransform(blur, (b) => `blur(${b}px)`)
  const opacity = useTransform(progress, [start, start + 0.05, end - 0.08, end], [0, 0.62, 0.62, 0])
  const lane = ['-32%', '-12%', '8%', '28%', '-22%', '18%', '0%', '-6%', '34%', '12%', '-30%', '24%'][index % 12]

  return (
    <motion.div
      style={{ y, scale, opacity, filter, x: lane, position: 'absolute', left: '50%', top: '50%', width: 'min(248px, 70%)', translateX: '-50%', translateY: '-50%' }}
    >
      <div style={{ borderRadius: 12, background: 'var(--alf-night-card-bg)', border: '1px solid var(--alf-night-card-border)', padding: '11px 13px', backdropFilter: 'blur(2px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'var(--alf-night-glow-soft)', color: 'var(--alf-on-night-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {card.company.charAt(0)}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--alf-on-night-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.title}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ---- Reduced motion / narrow: the same statement, no camera move ---- */

function StaticResolve() {
  return (
    <section style={{ background: DAY_BG, padding: '88px 24px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 600, letterSpacing: '-.02em', color: 'var(--alf-ink)', margin: '0 auto', maxWidth: 640 }}>
        Overnight, he reads thousands. By morning, a few.
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 32 }}>
        {SAMPLE_ENTRIES.slice(0, 4).map((e) => (
          <div key={e.job.id} style={{ borderRadius: 12, background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--alf-indigo-tint)', color: 'var(--alf-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {e.job.company.charAt(0)}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--alf-muted)', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.job.title}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
