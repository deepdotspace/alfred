/**
 * The honest-tailoring trust band -- the loudest, truest sentence, on a deep
 * indigo register for contrast. The promise no bot can copy, shown not told:
 * a generated line traced back to its source in your profile (provenance), and
 * the gaps left openly on the table rather than faked.
 */
import { CheckIcon, WarnCircleIcon } from '../ui/alfred'
import { MonoEyebrow, NightBand, Reveal, Section } from './primitives'

function ProvenanceCard() {
  return (
    <div style={{ background: 'var(--alf-night-card-bg)', border: '1px solid var(--alf-night-card-border)', borderRadius: 18, padding: '22px 24px', backdropFilter: 'blur(2px)' }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.13em', color: 'var(--alf-on-night-faint)', marginBottom: 8 }}>GENERATED LINE</div>
      <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--alf-on-night)', margin: 0 }}>
        Built and owned a React design system adopted across three product teams.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0', color: 'var(--alf-on-night-faint)' }}>
        <span style={{ fontSize: 16 }}>↑</span>
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: '.13em' }}>TRACES TO YOUR PROFILE</span>
        <span style={{ flex: 1, height: 1, background: 'var(--alf-night-border)' }} />
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--alf-on-night-dim)', margin: 0 }}>
        "Maintained the component library at my second internship; other teams picked it up."
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, color: 'var(--alf-strong-fg)', background: 'var(--alf-strong-bg)', borderRadius: 99, padding: '6px 12px' }}>
        <CheckIcon size={13} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Verified against your resume</span>
      </div>
    </div>
  )
}

function GapsCard() {
  return (
    <div style={{ background: 'var(--alf-amber-bg)', border: '1px solid var(--alf-amber-border)', borderRadius: 18, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, color: 'var(--alf-amber-icon)' }}>
        <WarnCircleIcon size={18} />
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: '.13em', color: 'var(--alf-amber-text)' }}>GAPS, SHOWN</span>
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--alf-amber-text)', margin: 0 }}>
        Before you send: this role asks for GraphQL and automated UI testing, which your resume does not show.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--alf-amber-text)', margin: '14px 0 0', opacity: 0.85 }}>
        I left these out rather than fake them. They are yours to speak to.
      </p>
    </div>
  )
}

export function TrustMoment() {
  return (
    <NightBand>
      <Section style={{ padding: 'clamp(72px, 10vw, 120px) 24px' }}>
        <Reveal style={{ maxWidth: 720 }}>
          <MonoEyebrow tone="night">The honest part</MonoEyebrow>
          <h2 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 600, letterSpacing: '-.03em', color: 'var(--alf-on-night)', margin: '16px 0 0', lineHeight: 1.02 }}>
            Nothing invented. Ever.
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 1.6vw, 1.2rem)', lineHeight: 1.6, color: 'var(--alf-on-night-dim)', margin: '20px 0 0' }}>
            The category's two loudest complaints are AI slop and billing abuse. Alfred is the opposite
            of both. Every tailored line traces to something real in your resume, checked before you see
            it. The gaps stay yours.
          </p>
        </Reveal>
        <Reveal delay={0.06} style={{ marginTop: 48 }}>
          <div className="lp-trust-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
            <ProvenanceCard />
            <GapsCard />
          </div>
        </Reveal>
      </Section>
    </NightBand>
  )
}
