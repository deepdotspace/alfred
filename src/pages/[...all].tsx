/**
 * 404 -- the catch-all route. Rendered self-contained inside app-root (not the
 * AppShell rail), so it carries its own periwinkle background and fills the
 * viewport. Alfred's calm butler voice, --alf-* tokens, the mascot. No em dashes.
 */
import { Link } from 'react-router-dom'
import Alfred from '../components/Alfred'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 24px',
        background: 'var(--alf-bg)',
        color: 'var(--alf-ink)',
      }}
    >
      <Alfred size="md" halo />

      <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', color: 'var(--alf-helper)', marginTop: 26 }}>
        404
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', margin: '10px 0 8px', color: 'var(--alf-ink)' }}>
        I could not find that page.
      </h1>

      <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--alf-muted-2)', maxWidth: 400, margin: '0 0 26px' }}>
        The link may be broken, or the page may have moved. Let me take you back to where the work is.
      </p>

      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          color: '#ffffff',
          background: 'var(--alf-indigo)',
          padding: '12px 22px',
          borderRadius: 999,
          textDecoration: 'none',
          boxShadow: '0 6px 16px rgba(61, 90, 241, 0.28)',
        }}
      >
        Back to Alfred
      </Link>
    </div>
  )
}
