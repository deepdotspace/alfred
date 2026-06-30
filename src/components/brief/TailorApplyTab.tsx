/**
 * Tailor & apply tab (DESIGN-SPEC §3.1) -- idle / working / ready.
 *
 * P4 fills P3's seam: the tab now drives the honest tailoring engine through the
 * `useTailor` hook (kicks the tailor-doc Job + seeds the tracker via the
 * tailor-start action, observes status, reads the verified generated_doc). The
 * "Review & refine ->" CTA opens the Document Workspace overlay (hosted by
 * brief.tsx) via `onOpenWorkspace`. Apply handoff opens the real apply_url then
 * prompts mark-applied. All em-dash copy uses the §7 rewrites.
 */
import type { ApplicationStage, JobData } from '../../types'
import Alfred from '../Alfred'
import { Button, TrustNote, CheckIcon, SkelBar } from '../ui/alfred'
import { useTailor } from '../workspace/useTailor'

export interface TailorApplyTabProps {
  jobId: string
  job: JobData
  appStage: ApplicationStage | null
  onApplied: (jobId: string) => void
  /** Open the Document Workspace overlay for this role (hosted by brief.tsx). */
  onOpenWorkspace: (jobId: string) => void
  /**
   * Apply handoff state + handler, OWNED by RoleDetail so the header action bar
   * and this ready-state apply row always agree (one click flips both).
   */
  applyPrompt: boolean
  onOpenApplication: () => void
}

const APPLIED_STAGES = new Set<ApplicationStage>(['applied', 'interview', 'offer'])

/** "a and b" / "a, b, and c" for the gaps reminder. */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function TailorApplyTab({ jobId, job, appStage, onApplied, onOpenWorkspace, applyPrompt, onOpenApplication }: TailorApplyTabProps) {
  const t = useTailor(jobId)
  const isApplied = appStage != null && APPLIED_STAGES.has(appStage)
  const hasApplyUrl = !!job.apply_url

  const applyNote = isApplied
    ? "Marked applied. I've moved it to your tracker."
    : applyPrompt
      ? 'Opened in a new tab. Did you apply?'
      : "I've prepared everything. You make the final call."

  /* ----- idle ----- */
  if (t.state === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '34px 24px 12px', animation: 'fadeUp .3s ease both' }}>
        <Alfred size="md" />
        <h3 style={{ fontSize: 19, fontWeight: 600, margin: '18px 0 8px', color: 'var(--alf-ink)' }}>
          Shall I tailor your application?
        </h3>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--alf-muted-2)', maxWidth: 440, margin: '0 0 22px' }}>
          I'll reshape your real experience to this role. ATS-friendly, in your voice. Nothing invented. The gaps stay
          yours to address.
        </p>
        <Button variant="primary-md" elevated onClick={t.start}>
          Tailor my resume &amp; cover letter
        </Button>
      </div>
    )
  }

  /* ----- error ----- */
  if (t.state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '34px 24px 12px' }}>
        <Alfred size="md" />
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: '18px 0 8px', color: 'var(--alf-ink)' }}>
          That didn't go through
        </h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--alf-muted-2)', maxWidth: 420, margin: '0 0 20px' }}>
          Something interrupted the tailoring. {t.error ? `(${t.error})` : ''} Let me try again.
        </p>
        <Button variant="primary-md" onClick={t.start}>Try again</Button>
      </div>
    )
  }

  /* ----- working ----- */
  if (t.state === 'working') {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0' }}>
        <div style={{ display: 'inline-block', marginBottom: 18 }}>
          <Alfred size="md" mood="working" />
        </div>
        <div className="mono" style={{ fontSize: 14, color: 'var(--alf-indigo)', marginBottom: 22 }}>{t.statusText}</div>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <SkelBar width="100%" />
          <SkelBar width="85%" />
          <SkelBar width="92%" />
          <SkelBar width="60%" />
        </div>
      </div>
    )
  }

  /* ----- ready ----- */
  const gapList = joinAnd(t.gaps)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .4s ease both' }}>
      {t.gaps.length > 0 && (
        <TrustNote tone="amber">
          <b>Before you send:</b> this role asks for {gapList}. I left these out rather than fake them. Worth a line in
          your application if you can speak to them.
        </TrustNote>
      )}

      {/* ready -> review */}
      <div style={{ background: 'var(--alf-surface)', border: '1px solid var(--alf-border)', borderRadius: 18, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'var(--alf-strong-bg)', color: 'var(--alf-strong-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--alf-ink)' }}>
            {t.coverGated ? <>Your r&eacute;sum&eacute; is ready</> : <>Your r&eacute;sum&eacute; &amp; cover letter are ready</>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--alf-muted)', marginTop: 2 }}>
            {t.coverGated
              ? 'Reshaped to this role, in your voice. Read it in full and tell me what to change.'
              : 'Reshaped to this role, in your voice. Read them in full and tell me what to change.'}
          </div>
        </div>
        <Button variant="primary-md" elevated onClick={() => onOpenWorkspace(jobId)} style={{ flexShrink: 0, padding: '13px 24px' }}>
          Review &amp; refine &rarr;
        </Button>
      </div>

      {/* apply */}
      <div style={{ borderTop: '1px solid var(--alf-border)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--alf-muted)' }}>{applyNote}</div>
        {isApplied ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--alf-strong-fg)' }}>
            <CheckIcon size={18} /> Applied
          </span>
        ) : applyPrompt ? (
          <Button variant="soft" onClick={() => onApplied(jobId)}>Mark as applied</Button>
        ) : (
          <Button variant="dark-cta" disabled={!hasApplyUrl} onClick={onOpenApplication}>
            {hasApplyUrl ? 'Open application ↗' : 'No link available'}
          </Button>
        )}
      </div>
    </div>
  )
}
