/**
 * Brief list column (430px, DESIGN-SPEC §3.1): mono date eyebrow, "Today's
 * brief", "{n} roles, strongest first", a scrollable stack of staggered
 * RoleCards, and the end note. Plus the designed warming / empty states.
 *
 * The NEW badge (match.seen === false) is a justified divergence (decisions-log):
 * rendered as a small pill wrapping the reused RoleCard, so the shared primitive
 * is not modified.
 */
import { RoleCard, Button } from '../ui/alfred'
import Alfred from '../Alfred'
import type { BriefRow } from './data'
import {
  avatarColors,
  cardMetaLine,
  companyInitial,
  fitDisplay,
  todayLabel,
} from './helpers'

export interface BriefListProps {
  rows: BriefRow[]
  status: 'loading' | 'ready'
  hasProfile: boolean
  needsSponsor: boolean
  recomputing: boolean
  selectedJobId: string | null
  onSelect: (jobId: string) => void
  onRecompute: () => void
}

function NewBadge() {
  return (
    <span
      className="mono"
      style={{
        position: 'absolute',
        top: -7,
        left: 14,
        zIndex: 1,
        background: 'var(--alf-indigo)',
        color: '#fff',
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: '.1em',
        padding: '2px 7px',
        borderRadius: 99,
        boxShadow: '0 2px 6px -2px rgba(61,90,241,.6)',
      }}
    >
      NEW
    </span>
  )
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div style={{ padding: '30px 28px 20px' }}>
      <div
        className="mono"
        style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-meta)', marginBottom: 8 }}
      >
        {todayLabel()}
      </div>
      <h1 style={{ fontSize: 25, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.02em' }}>Today's brief</h1>
      <p style={{ fontSize: 14, color: 'var(--alf-muted)', margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function CenteredState({
  title,
  body,
  working,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  working?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 32px',
        gap: 14,
      }}
    >
      <Alfred size="sm" mood={working ? 'working' : 'idle'} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alf-ink)' }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--alf-helper)', maxWidth: 280 }}>{body}</div>
      {actionLabel && onAction && (
        <Button variant="soft" tone="tint2" onClick={onAction} style={{ marginTop: 4 }}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function BriefList({
  rows,
  status,
  hasProfile,
  needsSponsor,
  recomputing,
  selectedJobId,
  onSelect,
  onRecompute,
}: BriefListProps) {
  const subtitle =
    rows.length === 0
      ? 'Your curated roles will land here.'
      : `${rows.length} ${rows.length === 1 ? 'role' : 'roles'}, strongest first`

  let body
  if (status === 'loading') {
    body = <CenteredState working title="Reading your brief" body="One moment while I gather what's worth your time." />
  } else if (!hasProfile) {
    body = (
      <CenteredState
        title="Let's finish your setup"
        body="Tell me what you're looking for and I'll start reading the market for you."
      />
    )
  } else if (rows.length === 0) {
    body = (
      <CenteredState
        working={recomputing}
        title={recomputing ? 'Reading the market for you' : 'Your brief is warming up'}
        body={
          recomputing
            ? "I'm reading through the postings now. Your roles will appear here shortly."
            : "I haven't found roles worth your time just yet. I'll keep reading."
        }
        actionLabel={recomputing ? undefined : 'Check again'}
        onAction={recomputing ? undefined : onRecompute}
      />
    )
  } else {
    body = (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => {
          const { job, match } = row
          const { bg, fg } = avatarColors(job.company)
          const fit = fitDisplay(match.qualify)
          const selected = selectedJobId === row.jobId
          return (
            <div key={row.jobId} data-testid="brief-card" style={{ position: 'relative' }}>
              {match.seen === false && <NewBadge />}
              <div
                style={
                  selected
                    ? { outline: '1.5px solid var(--alf-halo)', borderRadius: 18, outlineOffset: -1 }
                    : undefined
                }
              >
                <RoleCard
                  initial={companyInitial(job.company)}
                  avBg={bg}
                  avFg={fg}
                  title={job.title}
                  company={job.company}
                  reason={match.reason}
                  metaLine={cardMetaLine(job, { needsSponsor })}
                  fitLabel={fit.label}
                  fitScore={match.score}
                  fitVariant={fit.variant}
                  strong={match.qualify === 'yes'}
                  onClick={() => onSelect(row.jobId)}
                  delay={`${Math.min(i, 8) * 0.07}s`}
                />
              </div>
            </div>
          )
        })}
        <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--alf-disabled)', padding: '8px 0 0' }}>
          That's everyone worth your time today.
        </div>
      </div>
    )
  }

  return (
    <>
      <Header subtitle={subtitle} />
      {body}
    </>
  )
}
