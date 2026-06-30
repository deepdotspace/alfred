/**
 * Closing CTA -- the day-cycle returns to night. The loop closes: you sign up,
 * and tonight Alfred starts reading for you.
 */
import Alfred from '../Alfred'
import { Button } from '../ui/alfred'
import { NightBand, Reveal, Section } from './primitives'

export function ClosingCTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <NightBand>
      <Section max={760} style={{ padding: 'clamp(80px, 11vw, 130px) 24px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <Alfred size="lg" halo haloInset={-20} haloDuration={3} />
          </div>
          <p className="mono" style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-on-night-faint)', margin: '0 0 16px' }}>
            Built free because the early-career hunt is brutal enough
          </p>
          <h2 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)', fontWeight: 600, letterSpacing: '-.03em', color: 'var(--alf-on-night)', margin: 0, lineHeight: 1.05 }}>
            Let Alfred read tonight.
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', lineHeight: 1.6, color: 'var(--alf-on-night-dim)', maxWidth: 480, margin: '18px auto 0' }}>
            Hand him your resume before bed. Wake up to a short, honest brief of roles worth your time.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 34 }}>
            <Button variant="primary-lg" onClick={onGetStarted}>
              Wake me when it is ready
            </Button>
          </div>
        </Reveal>
      </Section>
    </NightBand>
  )
}
