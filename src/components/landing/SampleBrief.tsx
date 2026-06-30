/**
 * The live sample brief -- the payoff. Real, sanitized pool roles paired with an
 * honest read for the demo persona "Maya". Reuses the app's real role card, fit
 * badge, Alfred's-note, meta pills, and the "what you bring / gaps" blocks, so
 * the page reads as one product with the app: a visitor who signs up lands in a
 * brief that looks exactly like this. Two-pane on desktop, accordion on mobile.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlfredNote,
  BangIcon,
  CheckIcon,
  FitBadge,
  MetaPill,
  RoleCard,
} from '../ui/alfred'
import {
  avatarColors,
  companyInitial,
  fitDisplay,
  relativePosted,
  roleTypeLabel,
  workplaceLabel,
} from '../brief/helpers'
import { CountUp, MonoEyebrow, Reveal, Section } from './primitives'
import { useIsNarrow, useReducedMotion } from './motion'
import { SAMPLE_BRIEF_FIXTURE, type SampleEntry, type SampleJob } from './sample-data'

function metaLine(j: SampleJob): string {
  const parts: string[] = []
  const wp = workplaceLabel(j.workplace)
  if (wp) parts.push(wp)
  const rt = roleTypeLabel(j.roleType)
  if (rt) parts.push(rt)
  if (j.term) parts.push(j.term)
  const posted = relativePosted(j.postedDate)
  if (posted) parts.push(posted)
  if (j.pay) parts.push(j.pay)
  return parts.join(' · ')
}

function detailPills(j: SampleJob): string[] {
  const pills: string[] = []
  const wp = workplaceLabel(j.workplace)
  if (wp) pills.push(wp)
  const rt = roleTypeLabel(j.roleType)
  const termPart = [rt, j.term].filter(Boolean).join(' · ')
  if (termPart) pills.push(termPart)
  pills.push(j.pay ?? 'Pay not stated')
  const posted = relativePosted(j.postedDate)
  if (posted) pills.push(`Posted ${posted}`)
  return pills
}

function IconCircle({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ width: 22, height: 22, borderRadius: '50%', background: bg, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </span>
  )
}

function BulletList({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: 0, padding: 0 }}>
      {items.map((m, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, listStyle: 'none' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 8 }} />
          <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--alf-body-2)' }}>{m}</span>
        </li>
      ))}
    </ul>
  )
}

function SampleDetail({ entry }: { entry: SampleEntry }) {
  const { job, read } = entry
  const { bg, fg } = avatarColors(job.company)
  const fit = fitDisplay(read.qualify)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, flexShrink: 0, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 21 }}>
          {companyInitial(job.company)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-.01em', color: 'var(--alf-ink)', textWrap: 'balance' }}>{job.title}</h3>
          <div style={{ fontSize: 13.5, color: 'var(--alf-muted-2)', marginTop: 4 }}>{job.company} · {job.location}</div>
        </div>
        <FitBadge label={fit.label} score={read.score} variant={fit.variant} size="detail" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {detailPills(job).map((p, i) => (
          <MetaPill key={i}>{p}</MetaPill>
        ))}
      </div>

      <div style={{ marginBottom: 22 }}>
        <AlfredNote>{read.reason}</AlfredNote>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <IconCircle bg="var(--alf-strong-bg)" color="var(--alf-strong-fg)"><CheckIcon size={13} /></IconCircle>
            <h4 style={{ fontSize: 15.5, fontWeight: 600, margin: 0, color: 'var(--alf-ink)' }}>What you bring</h4>
          </div>
          <BulletList items={read.matched} dot="var(--alf-green)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <IconCircle bg="var(--alf-gaps-circle)" color="var(--alf-amber-icon)"><BangIcon size={12} /></IconCircle>
            <h4 style={{ fontSize: 15.5, fontWeight: 600, margin: 0, color: 'var(--alf-ink)' }}>Gaps to address</h4>
          </div>
          <p style={{ fontSize: 13, color: 'var(--alf-helper)', margin: '0 0 12px' }}>
            I will never hide these or fake them. They are yours to speak to.
          </p>
          <BulletList items={read.missing} dot="var(--alf-gap-dot)" />
        </div>
      </div>
    </div>
  )
}

function StatBlock({ stats }: { stats: { read: number; worth: number; strong: number } }) {
  const items = [
    { value: stats.read, label: 'postings read' },
    { value: stats.worth, label: 'worth your time' },
    { value: stats.strong, label: 'strong fits' },
  ]
  return (
    <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 48px)', flexWrap: 'wrap' }}>
      {items.map((s) => (
        <div key={s.label}>
          <CountUp value={s.value} className="mono" style={{ fontSize: 'clamp(26px, 3.5vw, 34px)', fontWeight: 500, color: 'var(--alf-indigo)', lineHeight: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--alf-muted)', marginTop: 7 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

export function SampleBrief() {
  const data = SAMPLE_BRIEF_FIXTURE
  const reduced = useReducedMotion()
  const narrow = useIsNarrow()
  const [selected, setSelected] = useState(0)
  const interacted = useRef(false)

  // Gentle auto-cycle through the roles until the visitor picks one.
  useEffect(() => {
    if (reduced || narrow) return
    const t = setInterval(() => {
      if (interacted.current) return
      setSelected((s) => (s + 1) % data.entries.length)
    }, 4500)
    return () => clearInterval(t)
  }, [reduced, narrow, data.entries.length])

  const pick = (i: number) => {
    interacted.current = true
    setSelected(i)
  }

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.entries.map((e, i) => {
        const fit = fitDisplay(e.read.qualify)
        const { bg, fg } = avatarColors(e.job.company)
        return (
          <div key={e.job.id}>
            <div
              style={{
                // minmax(0,1fr) forces the fit-content RoleCard button to the
                // available width so long titles ellipsize instead of overflowing.
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                borderRadius: 18,
                outline: !narrow && i === selected ? '2px solid var(--alf-halo)' : '2px solid transparent',
                outlineOffset: 1,
                transition: 'outline-color .18s',
              }}
            >
              <RoleCard
                initial={companyInitial(e.job.company)}
                avBg={bg}
                avFg={fg}
                title={e.job.title}
                company={e.job.company}
                reason={e.read.reason}
                metaLine={metaLine(e.job)}
                fitLabel={fit.label}
                fitScore={e.read.score}
                fitVariant={fit.variant}
                strong={e.read.qualify === 'yes'}
                onClick={() => pick(i)}
                delay={`${i * 0.06}s`}
              />
            </div>
            {/* Mobile: the picked role expands inline. */}
            {narrow && i === selected && (
              <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 18, padding: '20px 18px', marginTop: 10 }}>
                <SampleDetail entry={e} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <section style={{ background: 'var(--alf-bg)', padding: 'clamp(64px, 9vw, 110px) 0' }}>
      <Section>
        <Reveal>
          <MonoEyebrow>A sample brief</MonoEyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 600, letterSpacing: '-.025em', color: 'var(--alf-ink)', margin: '14px 0 0', maxWidth: 720, textWrap: 'balance' }}>
            This is what Maya woke up to.
          </h2>
          <div style={{ marginTop: 26 }}>
            <StatBlock stats={data.stats} />
          </div>
          <p className="mono" style={{ fontSize: 12, color: 'var(--alf-helper)', marginTop: 18, letterSpacing: '.02em' }}>
            {data.note}
          </p>
        </Reveal>

        <Reveal delay={0.05} style={{ marginTop: 40 }}>
          {narrow ? (
            list
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
              <div>{list}</div>
              <div style={{ position: 'sticky', top: 24, background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 20, padding: '26px 28px', minHeight: 520 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={data.entries[selected].job.id}
                    initial={reduced ? { opacity: 1 } : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SampleDetail entry={data.entries[selected]} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </Reveal>
      </Section>
    </section>
  )
}
