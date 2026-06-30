/**
 * OnboardingShell (DESIGN-SPEC §3.0): the full-viewport radial-gradient page,
 * the 6-dot progress bar, and the halo'd Alfred centered above the step content.
 * The mascot + halo are part of the shell (present on every step in the
 * prototype). Short steps center vertically; tall steps scroll.
 */
import { type ReactNode } from 'react'
import Alfred from '../Alfred'
import { ProgressDots } from '../ui/alfred'

export function OnboardingShell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: 'radial-gradient(120% 120% at 50% 0%, #EFF1FC 0%, #E7ECF9 45%, #E6F0F4 100%)',
      }}
    >
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 560, animation: 'fadeIn .5s ease both' }}>
          <div style={{ marginBottom: 38 }}>
            <ProgressDots active={step} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: 26 }}>
              <Alfred size="lg" halo haloInset={-18} haloDuration={2.8} />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Shared section label for the targeting/logistics steps. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alf-label)', marginBottom: 10 }}>{children}</div>
  )
}

/** The Back + primary footer used on steps 1-4. */
export function StepFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 30, justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </div>
  )
}
