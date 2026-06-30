/**
 * FAQ -- objection handling in the butler's voice, naming the alternatives.
 * A quiet accordion, one open at a time, chevron rotates on open.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { MonoEyebrow, Reveal, Section } from './primitives'
import { useReducedMotion } from './motion'

const QA = [
  { q: 'Will Alfred apply for me?', a: 'No, never. He prepares everything up to the submit button and you make the final call. No auto-apply, no managed accounts, nothing that gets your profiles flagged.' },
  { q: 'Is the tailoring made up?', a: 'No. Alfred generates, then verifies every line against your real resume, then regenerates anything that does not check out. He will not invent skills, numbers, or titles you do not have.' },
  { q: 'Is it really free?', a: 'Yes. Alfred costs about a dollar or two of compute per person each month, so the hosted app is free. The single-tenant edition is open source, so you can read every line or run your own.' },
  { q: 'Who is it for?', a: 'Students and new grads hunting internships and first roles, the segment that paid tools tend to skip.' },
  { q: 'How is this different from a job board?', a: 'A board makes you hunt and sift. Alfred brings the work to you: a short, honest brief by morning, judged for real fit, with the tailoring already done.' },
] as const

function Row({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion()
  return (
    <div style={{ borderBottom: '1px solid var(--alf-border)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ fontFamily: 'inherit', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '22px 4px' }}
      >
        <span style={{ fontSize: 'clamp(1rem, 1.8vw, 1.18rem)', fontWeight: 600, color: 'var(--alf-ink)' }}>{q}</span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ flexShrink: 0, color: 'var(--alf-indigo)', display: 'inline-flex' }}
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { height: 'auto', opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--alf-muted-2)', margin: 0, padding: '0 4px 24px', maxWidth: 640 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" style={{ background: 'var(--alf-surface)', padding: 'clamp(64px, 9vw, 110px) 0' }}>
      <Section max={780}>
        <Reveal>
          <MonoEyebrow>Questions</MonoEyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 600, letterSpacing: '-.025em', color: 'var(--alf-ink)', margin: '14px 0 36px' }}>
            The honest answers.
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <div style={{ borderTop: '1px solid var(--alf-border)' }}>
            {QA.map((item, i) => (
              <Row key={item.q} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            ))}
          </div>
        </Reveal>
      </Section>
    </section>
  )
}
