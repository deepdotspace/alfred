/**
 * Landing footer -- the page closes on night. Mark + one-liner, a disabled
 * source link (placeholder until the repo is public), and the tagline.
 */
import { Github } from 'lucide-react'
import Alfred from '../Alfred'

export function LandingFooter() {
  return (
    <footer style={{ background: 'var(--alf-night-1)', color: 'var(--alf-on-night-dim)', borderTop: '1px solid var(--alf-night-border)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Alfred size="sm" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alf-on-night)' }}>Alfred</div>
            <div style={{ fontSize: 12.5, color: 'var(--alf-on-night-faint)' }}>Your career butler. Honest, free, and quietly on your side.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#how" className="mono lp-nav-link" style={{ fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-on-night-dim)', textDecoration: 'none' }}>How it works</a>
          <a href="#faq" className="mono lp-nav-link" style={{ fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-on-night-dim)', textDecoration: 'none' }}>FAQ</a>
          <span title="Repository coming soon" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--alf-on-night-faint)', cursor: 'not-allowed' }}>
            <Github size={15} aria-hidden /> Source soon
          </span>
        </div>
      </div>
    </footer>
  )
}
