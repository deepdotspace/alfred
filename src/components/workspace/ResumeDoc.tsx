/**
 * The tailored resume, rendered as the §3.2 document page (HTML preview of the
 * same structured content the PDF/DOCX derive from). SUMMARY / EXPERIENCE /
 * PROJECTS / SKILLS / EDUCATION. Projects is a justified extension of the
 * prototype (the demo had none; real early-career resumes lead on projects).
 */
import type { ResumeDocContent } from '../../types'

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.13em', color: 'var(--alf-disabled)', marginBottom: 9 }}>
      {children}
    </div>
  )
}

function Bullet({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', gap: 9, fontSize: 14, lineHeight: 1.5, color: 'var(--alf-body-3)' }}>
      <span style={{ color: 'var(--alf-indigo)', flexShrink: 0 }}>&rsaquo;</span>
      <span>{children}</span>
    </div>
  )
}

export function ResumeDoc({ content }: { content: ResumeDocContent }) {
  return (
    <div>
      <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: '-.02em', color: 'var(--alf-ink-doc)' }}>
        {content.name}
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, color: 'var(--alf-indigo)', fontWeight: 600 }}>{content.role}</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--alf-green)', border: '1px solid #BFEBDD', padding: '3px 8px', borderRadius: 6 }}>
          ATS-friendly
        </span>
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--alf-meta)', marginTop: 7 }}>{content.contact}</div>
      <div style={{ height: 1, background: 'var(--alf-hairline)', margin: '22px 0' }} />

      {content.summary && (
        <>
          <SectionLabel>SUMMARY</SectionLabel>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--alf-body-5)', margin: '0 0 26px' }}>{content.summary}</p>
        </>
      )}

      {content.experience.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.13em', color: 'var(--alf-disabled)', marginBottom: 14 }}>EXPERIENCE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 26 }}>
            {content.experience.map((x, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alf-ink)' }}>
                    {x.title} · <span style={{ fontWeight: 500, color: 'var(--alf-muted-2)' }}>{x.org}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--alf-disabled)', whiteSpace: 'nowrap' }}>{x.dates}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {x.bullets.map((b, j) => (
                    <Bullet key={j}>{b}</Bullet>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {content.projects.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.13em', color: 'var(--alf-disabled)', marginBottom: 14 }}>PROJECTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 26 }}>
            {content.projects.map((p, i) => (
              <div key={i}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alf-ink)' }}>
                  {p.name}
                  {p.description ? <span style={{ fontWeight: 500, color: 'var(--alf-muted-2)' }}> · {p.description}</span> : null}
                </div>
                {p.bullets.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {p.bullets.map((b, j) => (
                      <Bullet key={j}>{b}</Bullet>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {content.skills.length > 0 && (
        <>
          <SectionLabel>SKILLS</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 26 }}>
            {content.skills.flatMap((g) => g.items).map((s, i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 500, color: 'var(--alf-body-3)', background: 'var(--alf-chip-soft)', padding: '6px 12px', borderRadius: 8 }}>
                {s}
              </span>
            ))}
          </div>
        </>
      )}

      {content.education.length > 0 && (
        <>
          <SectionLabel>EDUCATION</SectionLabel>
          {content.education.map((e, i) => (
            <div key={i} style={{ fontSize: 14, color: 'var(--alf-body-5)', marginBottom: 4 }}>{e.line}</div>
          ))}
        </>
      )}
    </div>
  )
}
