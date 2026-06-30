/**
 * Night hero -- the day-cycle opens here. Deep-indigo sky, the mascot reading
 * the market while you sleep, faint listing cards drifting in the dark, a mono
 * counter climbing. The deliberate dark-contrast moment, on-brand because the
 * indigo is our own primary used as night.
 */
import { motion } from 'framer-motion'
import Alfred from '../Alfred'
import { Button } from '../ui/alfred'
import { LandingNav } from './LandingNav'
import { CountUp, MonoEyebrow, NightBand } from './primitives'
import { useIsNarrow, useReducedMotion } from './motion'
import { SAMPLE_ENTRIES } from './sample-data'

const EASE = [0.16, 1, 0.3, 1] as const

/** Faint listing cards drifting in the dark: the market churning while you sleep. */
function DriftField() {
  const reduced = useReducedMotion()
  const narrow = useIsNarrow()
  // Hidden on narrow (it would overlap the hero copy); on desktop the spots stay
  // in the top strip + right half, clear of the left-column text.
  const cards = narrow ? [] : SAMPLE_ENTRIES.slice(0, 7)
  const spots = [
    { top: '13%', left: '9%', w: 178, drift: 13 },
    { top: '11%', left: '47%', w: 158, drift: 20 },
    { top: '23%', left: '74%', w: 170, drift: 16 },
    { top: '44%', left: '84%', w: 150, drift: 12 },
    { top: '62%', left: '67%', w: 182, drift: 18 },
    { top: '81%', left: '79%', w: 156, drift: 14 },
    { top: '34%', left: '60%', w: 150, drift: 15 },
  ]
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {cards.map((e, i) => {
        const s = spots[i]
        return (
          <motion.div
            key={e.job.id}
            initial={{ opacity: 0 }}
            animate={
              reduced
                ? { opacity: 0.5 }
                : { opacity: 0.5, y: [0, -16, 0], x: [0, 7, 0] }
            }
            transition={{
              opacity: { duration: 1.2, delay: 0.2 + i * 0.12 },
              y: { duration: s.drift, repeat: Infinity, ease: 'easeInOut' },
              x: { duration: s.drift * 1.4, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              position: 'absolute',
              top: s.top,
              left: s.left,
              width: s.w,
              borderRadius: 12,
              background: 'var(--alf-night-card-bg)',
              border: '1px solid var(--alf-night-card-border)',
              padding: '10px 12px',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: 'var(--alf-night-glow-soft)',
                  color: 'var(--alf-on-night-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {e.job.company.charAt(0)}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--alf-on-night-faint)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {e.job.title}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function NightHero({ onGetStarted }: { onGetStarted: () => void }) {
  const reduced = useReducedMotion()
  const rise = (delay: number) => ({
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay: reduced ? 0 : delay },
  })

  return (
    <NightBand id="top" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <LandingNav onGetStarted={onGetStarted} />
      <DriftField />

      <div
        className="lp-hero-grid"
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          width: '100%',
          maxWidth: 1120,
          margin: '0 auto',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {/* Left: the words */}
        <div style={{ paddingTop: 96, paddingBottom: 64 }}>
          <motion.div {...rise(0.05)}>
            <MonoEyebrow tone="night">Your career butler</MonoEyebrow>
          </motion.div>
          <motion.h1
            {...rise(0.12)}
            style={{
              fontSize: 'clamp(2.7rem, 6vw, 4.6rem)',
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: '-.025em',
              margin: '18px 0 0',
              color: 'var(--alf-on-night)',
              textWrap: 'balance',
            }}
          >
            Wake up to a shorter list.
          </motion.h1>
          <motion.p
            {...rise(0.22)}
            style={{
              fontSize: 'clamp(1rem, 1.5vw, 1.18rem)',
              lineHeight: 1.55,
              color: 'var(--alf-on-night-dim)',
              maxWidth: 520,
              margin: '22px 0 0',
            }}
          >
            While you sleep, Alfred reads the early-career job market and brings back only the roles
            you actually qualify for. Honest fit read, tailored resume included.
          </motion.p>
          <motion.div
            {...rise(0.32)}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 34 }}
          >
            <Button variant="primary-lg" onClick={onGetStarted}>
              Let Alfred read tonight
            </Button>
            <a
              href="#how"
              className="mono lp-nav-link"
              style={{
                fontSize: 12,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--alf-on-night-dim)',
                textDecoration: 'none',
              }}
            >
              See how it works ↓
            </a>
          </motion.div>
          <motion.div
            {...rise(0.44)}
            className="mono"
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 40, fontSize: 12.5, color: 'var(--alf-on-night-faint)' }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--alf-indigo)', boxShadow: '0 0 10px var(--alf-night-glow)' }} />
            <CountUp value={1438} style={{ color: 'var(--alf-on-night-dim)' }} /> postings read tonight
          </motion.div>
        </div>

        {/* Right: the mascot, luminous, reading */}
        <motion.div
          className="lp-hero-mascot"
          initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: reduced ? 0 : 0.2 }}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            aria-hidden
            className="lp-hero-glow"
            style={{
              position: 'absolute',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--alf-night-glow), transparent 68%)',
            }}
          />
          <div className="lp-hero-mascot-inner" style={{ position: 'relative' }}>
            <Alfred size="lg" halo haloInset={-22} haloDuration={3} />
          </div>
        </motion.div>
      </div>
    </NightBand>
  )
}
