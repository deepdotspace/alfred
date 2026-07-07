/**
 * Document Workspace overlay (DESIGN-SPEC §3.2) -- full-screen, above the shell.
 *
 * 66px top bar (Back to role / "Tailored for {title} · {company}" / spacer), a
 * doc-switch segmented (Resume / Cover letter), the 720px document page (the
 * verified resume / cover render + a floating download button, plus a .docx
 * offer), the refining overlay, and the 392px Refine panel (textarea + 4 quick
 * chips with §7 rewrites + Regenerate + the trust note + writing-refs hint + the
 * LAST CHANGE card + apply footer). Drives the honest engine via useTailor.
 */
import { useEffect, useRef, useState } from 'react'
import type { ApplicationStage, JobData } from '../../types'
import Alfred from '../Alfred'
import { Button, RefineChip, TrustNote, CheckIcon, DownloadIcon, RefreshIcon, PencilIcon, PillToggle } from '../ui/alfred'
import { avatarColors, companyInitial } from '../brief/helpers'
import { useTailor } from './useTailor'
import { ResumeDoc } from './ResumeDoc'
import { CoverDoc } from './CoverDoc'

export interface DocumentWorkspaceProps {
  jobId: string
  job: JobData
  appStage: ApplicationStage | null
  onApplied: (jobId: string) => void
  onClose: () => void
}

type DocTab = 'resume' | 'cover'

const APPLIED_STAGES = new Set<ApplicationStage>(['applied', 'interview', 'offer'])

const REFINE_CHIPS: { label: string; prompt: string }[] = [
  { label: 'Make it more concise', prompt: 'Make it more concise. Tighten to one page and cut filler.' },
  { label: 'Lead with impact & metrics', prompt: 'Lead with impact and metrics; put my strongest, most quantified result first.' },
  { label: 'Emphasize leadership', prompt: 'Emphasize ownership and leadership across my experience.' },
  { label: 'Match their tone', prompt: "Match the company's tone: warmer and a little less formal." },
]

export function DocumentWorkspace({ jobId, job, appStage, onApplied, onClose }: DocumentWorkspaceProps) {
  const t = useTailor(jobId)
  const [docTab, setDocTab] = useState<DocTab>('resume')
  const [refinePrompt, setRefinePrompt] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [applyPrompt, setApplyPrompt] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dlHover = useRef(false)
  const [, force] = useState(0)

  const { bg, fg } = avatarColors(job.company)
  const isApplied = appStage != null && APPLIED_STAGES.has(appStage)
  const hasApplyUrl = !!job.apply_url

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // Surface a failed refine/regenerate -- otherwise the overlay just drops silently.
  const refineFailed = t.state === 'error' || !!t.error
  const failedRef = useRef(false)
  useEffect(() => {
    if (refineFailed && !failedRef.current) showToast('Something went wrong rewriting that. Try again.')
    failedRef.current = refineFailed
  }, [refineFailed])

  const docLabel = docTab === 'resume' ? 'Résumé' : 'Cover letter'

  async function handleDownload(format: 'pdf' | 'docx') {
    try {
      await t.download(docTab === 'resume' ? 'resume' : 'cover_letter', format)
      showToast(`${docLabel} downloaded as ${format.toUpperCase()}`)
    } catch {
      showToast(`Could not download the ${docLabel.toLowerCase()}`)
    }
  }

  function openApplication() {
    if (!hasApplyUrl) return
    window.open(job.apply_url, '_blank', 'noopener,noreferrer')
    setApplyPrompt(true)
  }

  const canDownload = docTab === 'resume' ? !!t.resume : !!t.cover

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--alf-bg)', display: 'flex', flexDirection: 'column', animation: 'fadeIn .28s ease both' }}>
      {/* top bar */}
      <div style={{ height: 66, flexShrink: 0, background: 'var(--alf-surface)', borderBottom: '1px solid var(--alf-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 16 }}>
        <button onClick={onClose} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--alf-muted-2)', background: 'var(--alf-chip-soft)', border: 'none', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          &larr; Back to role
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
            {companyInitial(job.company)}
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--alf-ws-subtext, #3F4670)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Tailored for <b style={{ color: 'var(--alf-ink)' }}>{job.title}</b> · {job.company}
          </div>
        </div>
        <div style={{ width: 120, flexShrink: 0 }} />
      </div>

      {/* body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* document viewer */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 26px 60px' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, marginBottom: 24 }}>
            <PillToggle<DocTab>
              variant="doc"
              value={docTab}
              onChange={setDocTab}
              options={[{ value: 'resume', label: 'Résumé' }, { value: 'cover', label: 'Cover letter' }]}
            />
          </div>

          <div style={{ width: 720, maxWidth: '100%', position: 'relative' }}>
            {t.refining && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(237,240,250,.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <Alfred size="md" mood="working" />
                <div className="mono" style={{ fontSize: 14, color: 'var(--alf-indigo)' }}>{t.refineStatus}</div>
              </div>
            )}

            <div style={{ background: 'var(--alf-surface)', borderRadius: 8, boxShadow: '0 4px 30px -10px rgba(30,40,80,.22)', padding: '56px 60px', minHeight: 840, position: 'relative' }}>
              {/* download cluster */}
              <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                {canDownload && (
                  <button
                    onClick={() => void handleDownload('docx')}
                    title="Download .docx"
                    className="mono"
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: 'var(--alf-muted)', background: 'var(--alf-inset)', border: '1px solid var(--alf-border)', borderRadius: 9, padding: '6px 9px', cursor: 'pointer', letterSpacing: '.04em' }}
                  >
                    DOCX
                  </button>
                )}
                <button
                  onClick={() => canDownload && void handleDownload('pdf')}
                  title="Download PDF"
                  disabled={!canDownload}
                  onMouseEnter={() => { dlHover.current = true; force((n) => n + 1) }}
                  onMouseLeave={() => { dlHover.current = false; force((n) => n + 1) }}
                  style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${dlHover.current ? 'var(--alf-hover-border)' : 'var(--alf-border)'}`, background: dlHover.current ? 'var(--alf-indigo-tint)' : 'var(--alf-inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canDownload ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(30,40,80,.08)', transition: 'all .15s', color: 'var(--alf-indigo)', opacity: canDownload ? 1 : 0.5 }}
                >
                  <DownloadIcon size={19} />
                </button>
              </div>

              {docTab === 'resume'
                ? t.resume
                  ? <ResumeDoc content={t.resume} />
                  : <DocLoading />
                : t.coverGated
                  ? <CoverGate onClose={onClose} />
                  : t.cover
                    ? <CoverDoc content={t.cover} />
                    : <DocLoading />}
            </div>
          </div>
        </div>

        {/* refine panel */}
        <div style={{ width: 392, flexShrink: 0, borderLeft: '1px solid var(--alf-border)', background: 'var(--alf-surface)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '26px 26px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ flexShrink: 0 }}><Alfred size="sm" /></div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--alf-ink)' }}>Refine with Alfred</div>
                <div style={{ fontSize: 13, color: 'var(--alf-helper)' }}>Tell me what to change and I'll rewrite it.</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '18px 26px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <textarea
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="e.g. Make the summary punchier and lead with the design-system work. Keep it to one page."
              style={{ width: '100%', minHeight: 104, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, color: 'var(--alf-ink)', border: '1.5px solid var(--alf-input-border)', borderRadius: 14, padding: 14, outline: 'none', background: 'var(--alf-inset)', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {REFINE_CHIPS.map((c) => (
                <RefineChip key={c.label} onClick={() => setRefinePrompt(c.prompt)}>{c.label}</RefineChip>
              ))}
            </div>

            <Button
              variant="primary-rect"
              block
              working={t.refining}
              disabled={t.refining}
              onClick={() => t.refine(refinePrompt)}
              leftIcon={<RefreshIcon size={17} style={{ color: '#fff' }} />}
            >
              {t.refining ? 'Rewriting...' : 'Regenerate'}
            </Button>

            {t.verified ? (
              <TrustNote tone="soft">
                I'll only rephrase and reorder what's true. I won't invent skills, numbers, or titles you don't have.
              </TrustNote>
            ) : (
              <TrustNote tone="amber">
                I could not fully verify every line in this draft. Please review it before you send.
              </TrustNote>
            )}

            {!t.coverGated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--alf-indigo)' }}>
                <PencilIcon size={13} />
                Drawing on your writing references for voice.
              </div>
            )}

            {t.lastRefine && (
              <TrustNote tone="success" label="LAST CHANGE">{t.lastRefine}</TrustNote>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* apply footer */}
          <div style={{ borderTop: '1px solid var(--alf-border)', padding: '18px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isApplied ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--alf-strong-fg)', padding: 13 }}>
                <CheckIcon size={18} /> Marked as applied
              </div>
            ) : applyPrompt ? (
              <Button variant="primary-rect" block onClick={() => onApplied(jobId)} style={{ background: 'var(--alf-ink)' }}>
                Mark as applied
              </Button>
            ) : (
              <>
                <Button variant="primary-rect" block disabled={!hasApplyUrl} onClick={openApplication} style={{ background: 'var(--alf-ink)' }}>
                  Open application ↗
                </Button>
                <div style={{ fontSize: 12.5, color: 'var(--alf-disabled)', textAlign: 'center' }}>You make the final call. I just prepare.</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 90, background: 'var(--alf-ink)', color: '#fff', padding: '13px 22px', borderRadius: 99, boxShadow: '0 10px 30px -8px rgba(20,30,60,.5)', display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, animation: 'fadeUp .25s ease both' }}>
          <CheckIcon size={16} style={{ color: 'var(--alf-toast-check)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}

function DocLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '120px 0' }}>
      <Alfred size="md" mood="working" />
      <div className="mono" style={{ fontSize: 13, color: 'var(--alf-indigo)' }}>Preparing your document...</div>
    </div>
  )
}

function CoverGate({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '110px 24px' }}>
      <Alfred size="md" />
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--alf-ink)' }}>I'd love a sample of your voice first</h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--alf-muted-2)', maxWidth: 420, margin: 0 }}>
        Add a cover letter or writing sample on your Profile and I'll draft this letter in your voice. I never copy it. I
        learn the tone. The r&eacute;sum&eacute; is ready now.
      </p>
      <button onClick={onClose} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--alf-indigo)', background: 'var(--alf-indigo-tint-2)', border: '1px solid var(--alf-chip-border)', borderRadius: 99, padding: '9px 18px', cursor: 'pointer' }}>
        Back to the r&eacute;sum&eacute;
      </button>
    </div>
  )
}
