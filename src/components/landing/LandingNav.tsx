/**
 * Landing nav -- a quiet bar over the night hero. Mascot + wordmark left;
 * section anchors + a Get started CTA right. Light text on the dark sky; it
 * lives atop the hero and scrolls away (the closing CTA carries conversion).
 */
import Alfred from '../Alfred'

export function LandingNav({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <nav
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 1120,
        margin: '0 auto',
        padding: '22px 24px',
      }}
    >
      <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <Alfred size="sm" />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--alf-on-night)' }}>
          Alfred
        </span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        <a
          href="#how"
          className="mono lp-nav-link lp-nav-anchor"
          style={{ fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-on-night-dim)', textDecoration: 'none' }}
        >
          How it works
        </a>
        <a
          href="#faq"
          className="mono lp-nav-link lp-nav-anchor"
          style={{ fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-on-night-dim)', textDecoration: 'none' }}
        >
          FAQ
        </a>
        <button
          onClick={onGetStarted}
          style={{
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--alf-on-indigo)',
            background: 'var(--alf-indigo)',
            border: 'none',
            borderRadius: 99,
            padding: '9px 18px',
            cursor: 'pointer',
            boxShadow: '0 8px 20px -8px var(--alf-night-glow)',
          }}
        >
          Get started
        </button>
      </div>
    </nav>
  )
}
