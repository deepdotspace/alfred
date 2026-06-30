/**
 * The tailored cover letter, rendered as the §3.2 document page: mono date,
 * salutation, body paragraphs, closing + bold signature.
 */
import type { CoverDocContent } from '../../types'

export function CoverDoc({ content }: { content: CoverDocContent }) {
  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--alf-body-5)' }}>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--alf-disabled)', marginBottom: 26 }}>{content.date}</div>
      <p style={{ margin: '0 0 18px' }}>{content.salutation}</p>
      {content.paragraphs.map((p, i) => (
        <p key={i} style={{ margin: '0 0 18px' }}>{p}</p>
      ))}
      <p style={{ margin: '26px 0 4px' }}>{content.closing}</p>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--alf-ink)' }}>{content.signature}</p>
    </div>
  )
}
