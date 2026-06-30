/**
 * Free and open-source. One honest line on price: our run-cost is about a dollar
 * or two per user per month, so the hosted app is free and the single-tenant
 * edition is open source. No pricing table (there is nothing to price). The
 * comparison chip cites the rough range comparable tools charge, struck through.
 */
import { Github } from 'lucide-react'
import { MonoEyebrow, Reveal, Section } from './primitives'

const REPO_URL = 'https://github.com/deepdotspace/alfred'

function PriceChip({ value, label, strike }: { value: string; label: string; strike?: boolean }) {
  return (
    <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 16, padding: '20px 24px', minWidth: 150 }}>
      <div className="mono" style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 500, color: strike ? 'var(--alf-disabled)' : 'var(--alf-indigo)', textDecoration: strike ? 'line-through' : 'none', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--alf-muted)', marginTop: 8 }}>{label}</div>
    </div>
  )
}

export function FreeOSS() {
  return (
    <section style={{ background: 'var(--alf-bg)', padding: 'clamp(64px, 9vw, 110px) 0' }}>
      <Section max={1000}>
        <div className="lp-free-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 'clamp(32px, 6vw, 72px)', alignItems: 'center' }}>
          <Reveal>
            <MonoEyebrow>Free, and open</MonoEyebrow>
            <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.9rem)', fontWeight: 600, letterSpacing: '-.025em', color: 'var(--alf-ink)', margin: '14px 0 0', textWrap: 'balance' }}>
              Finding a job should not cost you anything.
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--alf-muted-2)', margin: '18px 0 0', maxWidth: 460 }}>
              Alfred costs about a dollar or two of compute per person each month, so the hosted app is
              free. The single-tenant edition is open source: read every line, or run your own.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 26 }}>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-chip-soft)', border: '1px solid var(--alf-border)', borderRadius: 99, padding: '11px 20px', textDecoration: 'none' }}
              >
                <Github size={17} aria-hidden /> View source
              </a>
              <span style={{ fontSize: 13.5, color: 'var(--alf-helper)' }}>Read every line. Self-host it.</span>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <PriceChip value="$0" label="to use Alfred" />
              <PriceChip value="$10-40/mo" label="what other tools charge" strike />
            </div>
          </Reveal>
        </div>
      </Section>
    </section>
  )
}
