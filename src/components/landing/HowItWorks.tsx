/**
 * How it works -- three beats in the butler's voice. Alternating rows (not three
 * identical cards): each beat pairs a line with a small live fragment of the
 * product (resume turning into chips, the overnight scan, a doc being reshaped).
 */
import { motion } from 'framer-motion'
import { CheckIcon } from '../ui/alfred'
import { MonoEyebrow, Reveal, Section } from './primitives'
import { useReducedMotion } from './motion'

function ResumeToChips() {
  const chips = ['React', 'Figma', 'Design systems', 'SQL']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 132, flexShrink: 0, background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 12, padding: 14, boxShadow: 'var(--alf-shadow-card)' }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '.13em', color: 'var(--alf-disabled)', marginBottom: 8 }}>RESUME</div>
        {[88, 70, 80, 56].map((w, i) => (
          <div key={i} style={{ height: 6, width: `${w}%`, borderRadius: 4, background: 'var(--alf-skel-a)', marginBottom: 6 }} />
        ))}
      </div>
      <span style={{ color: 'var(--alf-indigo)', fontSize: 20 }}>→</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxWidth: 200 }}>
        {chips.map((c) => (
          <span key={c} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--alf-body-3)', background: 'var(--alf-chip-soft)', borderRadius: 99, padding: '7px 13px' }}>{c}</span>
        ))}
      </div>
    </div>
  )
}

function OvernightScan() {
  const reduced = useReducedMotion()
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, var(--alf-night-2), var(--alf-night-1))', border: '1px solid var(--alf-night-border)', borderRadius: 14, padding: 18, height: 132 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 - i * 0.12 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--alf-night-glow-soft)' }} />
            <div style={{ height: 6, width: `${70 - i * 12}%`, borderRadius: 4, background: 'var(--alf-night-card-border)' }} />
          </div>
        ))}
      </div>
      {!reduced && (
        <motion.div
          aria-hidden
          initial={{ x: '-120%' }}
          animate={{ x: '120%' }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, var(--alf-night-glow), transparent)' }}
        />
      )}
      <div className="mono" style={{ position: 'absolute', bottom: 12, left: 18, fontSize: 11, color: 'var(--alf-on-night-dim)' }}>
        reading the market...
      </div>
    </div>
  )
}

function DocReshape() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 116, background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 12, padding: 13, opacity: 0.7 }}>
        {[80, 62, 72].map((w, i) => (
          <div key={i} style={{ height: 6, width: `${w}%`, borderRadius: 4, background: 'var(--alf-skel-a)', marginBottom: 6 }} />
        ))}
      </div>
      <span style={{ color: 'var(--alf-indigo)', fontSize: 20 }}>→</span>
      <div style={{ width: 116, background: 'var(--alf-surface)', border: '1px solid var(--alf-strong-border)', borderRadius: 12, padding: 13, boxShadow: 'var(--alf-shadow-glow)' }}>
        {[90, 74, 84].map((w, i) => (
          <div key={i} style={{ height: 6, width: `${w}%`, borderRadius: 4, background: 'var(--alf-indigo-tint)', marginBottom: 6 }} />
        ))}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--alf-green)', fontSize: 10.5 }}>
          <CheckIcon size={11} /> <span className="mono">verified</span>
        </div>
      </div>
    </div>
  )
}

const BEATS = [
  { n: '01', title: 'Hand me your resume. I read it once.', line: 'Upload it and I learn your real experience, so you never paste it again. Everything after that comes from what is actually yours.', visual: <ResumeToChips /> },
  { n: '02', title: 'I read the market overnight and judge real fit.', line: 'While you sleep I scan thousands of internship and new-grad roles, then keep only the ones you genuinely qualify for, each with one honest reason.', visual: <OvernightScan /> },
  { n: '03', title: 'I tailor your resume and cover letter, honestly.', line: 'For any role you choose, I reshape your real experience to match it, then check every line against your profile before you ever see it.', visual: <DocReshape /> },
] as const

function Beat({ beat, flip }: { beat: (typeof BEATS)[number]; flip: boolean }) {
  const text = (
    <div>
      <div className="mono" style={{ fontSize: 13, color: 'var(--alf-indigo)', marginBottom: 12 }}>{beat.n}</div>
      <h3 style={{ fontSize: 'clamp(1.4rem, 2.6vw, 1.9rem)', fontWeight: 600, letterSpacing: '-.02em', color: 'var(--alf-ink)', margin: 0, textWrap: 'balance' }}>{beat.title}</h3>
      <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--alf-muted-2)', margin: '14px 0 0', maxWidth: 440 }}>{beat.line}</p>
    </div>
  )
  const visual = (
    <div className="lp-beat-visual" style={{ display: 'flex', justifyContent: 'center' }}>{beat.visual}</div>
  )
  return (
    <Reveal>
      <div className="lp-beat" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(24px, 5vw, 64px)', alignItems: 'center' }}>
        {flip ? <>{visual}{text}</> : <>{text}{visual}</>}
      </div>
    </Reveal>
  )
}

export function HowItWorks() {
  return (
    <section id="how" style={{ background: 'var(--alf-surface)', padding: 'clamp(64px, 9vw, 110px) 0' }}>
      <Section max={1000}>
        <Reveal>
          <MonoEyebrow>How it works</MonoEyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 600, letterSpacing: '-.025em', color: 'var(--alf-ink)', margin: '14px 0 0', maxWidth: 560, textWrap: 'balance' }}>
            Three steps, then a brief by morning.
          </h2>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(48px, 7vw, 88px)', marginTop: 'clamp(48px, 7vw, 72px)' }}>
          {BEATS.map((b, i) => (
            <Beat key={b.n} beat={b} flip={i % 2 === 1} />
          ))}
        </div>
      </Section>
    </section>
  )
}
