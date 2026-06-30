/**
 * Role detail pane (DESIGN-SPEC §3.1): back link, header (avatar + title +
 * company·location + fit badge), an action bar (Save / Dismiss / apply handoff),
 * meta pills, Alfred's note, and the three tabs (Alfred's read / The role /
 * Tailor & apply).
 *
 * Divergences applied (decisions-log): real apply handoff (open job.apply_url in
 * a new tab, then prompt "mark as applied?"), Save + Dismiss actions, and the
 * subtle "via {ATS}" source attribution in The role tab.
 */
import { useState } from 'react'
import type { ApplicationStage, JobData } from '../../types'
import {
  Button,
  FitBadge,
  MetaPill,
  Tabs,
  AlfredNote,
  CheckIcon,
  BangIcon,
} from '../ui/alfred'
import { TailorApplyTab } from './TailorApplyTab'
import type { BriefRow } from './data'
import {
  avatarColors,
  companyInitial,
  detailMetaPills,
  fitDisplay,
  jdBlocks,
  primaryLocation,
  sourceAttribution,
  sponsorChipText,
} from './helpers'

export interface RoleDetailProps {
  row: BriefRow
  needsSponsor: boolean
  appStage: ApplicationStage | null
  onBack: () => void
  onSave: (jobId: string) => void
  onDismiss: (jobId: string) => void
  onApplied: (jobId: string) => void
  /** Open the Document Workspace overlay (hosted by brief.tsx). */
  onOpenWorkspace: (jobId: string) => void
}

type Tab = 'fit' | 'jd' | 'tailor'

const STAGE_LABEL: Record<ApplicationStage, string> = {
  saved: 'Saved',
  tailored: 'Tailored',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
}

const APPLIED_STAGES = new Set<ApplicationStage>(['applied', 'interview', 'offer'])

function Dot({ color }: { color: string }) {
  return <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 8 }} />
}

function BulletRow({ color, children }: { color: string; children: string }) {
  return (
    <li style={{ display: 'flex', gap: 10, listStyle: 'none' }}>
      <Dot color={color} />
      <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--alf-body-2)' }}>{children}</span>
    </li>
  )
}

function IconCircle({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      {icon}
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--alf-ink)' }}>{children}</h3>
    </div>
  )
}

/* ----------------------------------------------------------- tab bodies */

function AlfredsReadTab({ matched, missing }: { matched: string[]; missing: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <SectionHeading icon={<IconCircle bg="var(--alf-strong-bg)" color="var(--alf-strong-fg)"><CheckIcon size={13} /></IconCircle>}>
          What you bring
        </SectionHeading>
        {matched.length > 0 ? (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: 0, padding: 0 }}>
            {matched.map((m, i) => (
              <BulletRow key={i} color="var(--alf-green)">{m}</BulletRow>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 15, color: 'var(--alf-muted-2)', margin: 0 }}>
            You line up well with what this role asks for.
          </p>
        )}
      </div>
      <div>
        <SectionHeading icon={<IconCircle bg="var(--alf-gaps-circle)" color="var(--alf-amber-icon)"><BangIcon size={12} /></IconCircle>}>
          Gaps to address
        </SectionHeading>
        <p style={{ fontSize: 13.5, color: 'var(--alf-helper)', margin: '0 0 12px' }}>
          I'll never hide these or fake them. They're yours to speak to.
        </p>
        {missing.length > 0 ? (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: 0, padding: 0 }}>
            {missing.map((m, i) => (
              <BulletRow key={i} color="var(--alf-gap-dot)">{m}</BulletRow>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 15, color: 'var(--alf-muted-2)', margin: 0 }}>
            Nothing major stands out. You meet what this role asks for.
          </p>
        )}
      </div>
    </div>
  )
}

function TheRoleTab({ job }: { job: JobData }) {
  const blocks = jdBlocks(job.description_text)
  const source = sourceAttribution(job)
  return (
    <div>
      <SectionHeading icon={<span />}>The role</SectionHeading>
      {blocks.length > 0 ? (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 11, margin: 0, padding: 0 }}>
          {blocks.map((b, i) => (
            <BulletRow key={i} color="var(--alf-disabled)">{b}</BulletRow>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--alf-muted-2)', margin: 0 }}>
          The full description isn't available here yet. Open the application to read it in full.
        </p>
      )}
      {source && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--alf-disabled)', marginTop: 22 }}>
          {source}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- detail */

export function RoleDetail({
  row,
  needsSponsor,
  appStage,
  onBack,
  onSave,
  onDismiss,
  onApplied,
  onOpenWorkspace,
}: RoleDetailProps) {
  const { job, match } = row
  const [tab, setTab] = useState<Tab>('fit')
  const [applyPrompt, setApplyPrompt] = useState(false)

  const { bg, fg } = avatarColors(job.company)
  const fit = fitDisplay(match.qualify)
  const pills = detailMetaPills(job)
  const isApplied = appStage != null && APPLIED_STAGES.has(appStage)
  const inTracker = appStage != null && appStage !== 'dismissed'
  const hasApplyUrl = !!job.apply_url

  const applyNote = isApplied
    ? "Marked applied. I've moved it to your tracker."
    : applyPrompt
      ? 'Opened in a new tab. Did you apply?'
      : 'I prepared the link. You make the final call.'

  function openApplication() {
    if (!hasApplyUrl) return
    window.open(job.apply_url, '_blank', 'noopener,noreferrer')
    setApplyPrompt(true)
  }

  return (
    <div data-testid="role-detail" style={{ maxWidth: 760, margin: '0 auto', padding: '28px 40px 64px', animation: 'panelIn .35s ease both' }}>
      <button
        onClick={onBack}
        style={{ fontFamily: 'inherit', fontSize: 14, color: 'var(--alf-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}
      >
        ← Back to brief
      </button>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, flexShrink: 0, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 23 }}>
          {companyInitial(job.company)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 25, fontWeight: 600, margin: 0, letterSpacing: '-.02em', textWrap: 'balance', color: 'var(--alf-ink)' }}>
            {job.title}
          </h1>
          <div style={{ fontSize: 14, color: 'var(--alf-muted-2)', marginTop: 4 }}>
            {job.company} · {primaryLocation(job)}
          </div>
        </div>
        <FitBadge label={fit.label} score={match.score} variant={fit.variant} size="detail" />
      </div>

      {/* action bar (Save / Dismiss / apply handoff) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {inTracker ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--alf-muted-2)', background: 'var(--alf-chip-soft)', padding: '8px 14px', borderRadius: 10 }}>
              {STAGE_LABEL[appStage!]} · in tracker
            </span>
          ) : (
            <Button variant="soft" tone="tint2" onClick={() => onSave(row.jobId)}>
              Save
            </Button>
          )}
          <Button variant="ghost" onClick={() => onDismiss(row.jobId)} style={{ padding: '8px 12px', fontSize: 14, color: 'var(--alf-muted)' }}>
            Dismiss
          </Button>
        </div>
        <div>
          {isApplied ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: 'var(--alf-strong-fg)' }}>
              <CheckIcon size={15} /> Applied
            </span>
          ) : applyPrompt ? (
            <Button variant="soft" onClick={() => onApplied(row.jobId)}>
              Mark as applied
            </Button>
          ) : (
            <Button variant="dark-cta" disabled={!hasApplyUrl} onClick={openApplication}>
              {hasApplyUrl ? 'Open application ↗' : 'No link available'}
            </Button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--alf-muted)', marginTop: -10, marginBottom: 22 }}>{applyNote}</div>

      {/* meta pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {pills.map((p, i) => (
          <MetaPill key={i}>{p}</MetaPill>
        ))}
        {needsSponsor && <MetaPill>{sponsorChipText(job.sponsorship)}</MetaPill>}
      </div>

      {/* Alfred's note */}
      <div style={{ marginBottom: 24 }}>
        <AlfredNote>{match.reason}</AlfredNote>
      </div>

      {/* tabs */}
      <div style={{ marginBottom: 22 }}>
        <Tabs<Tab>
          tabs={[
            { value: 'fit', label: "Alfred's read" },
            { value: 'jd', label: 'The role' },
            { value: 'tailor', label: 'Tailor & apply' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'fit' && <AlfredsReadTab matched={match.matched} missing={match.missing} />}
      {tab === 'jd' && <TheRoleTab job={job} />}
      {tab === 'tailor' && (
        <TailorApplyTab
          jobId={row.jobId}
          job={job}
          appStage={appStage}
          onApplied={onApplied}
          onOpenWorkspace={onOpenWorkspace}
          applyPrompt={applyPrompt}
          onOpenApplication={openApplication}
        />
      )}
    </div>
  )
}
