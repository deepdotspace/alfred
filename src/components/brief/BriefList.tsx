/**
 * Brief list column (DESIGN-SPEC §3.1): a mono date eyebrow, "Your matches" +
 * an honest count, a compact Recent/All + Latest/Best-fit control row, a
 * scrollable stack of staggered RoleCards, and a footer. Plus the designed
 * warming / empty states.
 *
 * The feed is one persistent, deduped inbox of every role Alfred has matched for
 * the user (assembleBriefRows). "Recent" and the sort control are VIEWS over that
 * one list -- nothing is ever dropped or hidden unreachably; older matches sit
 * one tap away under "All". Default view: freshest first, last RECENT_DAYS days.
 *
 * The NEW badge (match.seen === false) is a justified divergence (decisions-log):
 * a small pill wrapping the reused RoleCard, so the shared primitive is untouched.
 */
import { useMemo, useState } from 'react'
import { RoleCard, Button, PillToggle } from '../ui/alfred'
import Alfred from '../Alfred'
import type { BriefRow } from './data'
import {
  avatarColors,
  cardMetaLine,
  companyInitial,
  fitDisplay,
  filterRecent,
  sortBriefRows,
  todayLabel,
  RECENT_DAYS,
  type BriefFilter,
  type BriefSort,
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
    <div style={{ padding: '30px 28px 16px' }}>
      <div
        className="mono"
        style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--alf-meta)', marginBottom: 8 }}
      >
        {todayLabel()}
      </div>
      <h1 style={{ fontSize: 25, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.02em' }}>Your matches</h1>
      <p style={{ fontSize: 14, color: 'var(--alf-muted)', margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function Controls({
  filter,
  onFilter,
  sort,
  onSort,
  recentCount,
  total,
}: {
  filter: BriefFilter
  onFilter: (v: BriefFilter) => void
  sort: BriefSort
  onSort: (v: BriefSort) => void
  recentCount: number
  total: number
}) {
  return (
    <div
      style={{
        padding: '0 28px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <PillToggle<BriefFilter>
        options={[
          { value: 'recent', label: `Recent · ${recentCount}` },
          { value: 'all', label: `All · ${total}` },
        ]}
        value={filter}
        onChange={onFilter}
      />
      <PillToggle<BriefSort>
        options={[
          { value: 'latest', label: 'Latest' },
          { value: 'fit', label: 'Best fit' },
        ]}
        value={sort}
        onChange={onSort}
      />
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

/** Subtle centered text button used for the "show older / show all" footer. */
function FooterLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        margin: '4px auto 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--alf-indigo)',
      }}
    >
      {children}
    </button>
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
  const [sort, setSort] = useState<BriefSort>('latest')
  const [filter, setFilter] = useState<BriefFilter>('recent')

  const recentRows = useMemo(() => filterRecent(rows), [rows])
  const shown = useMemo(
    () => sortBriefRows(filter === 'recent' ? recentRows : rows, sort),
    [rows, recentRows, filter, sort],
  )
  const newCount = useMemo(() => rows.reduce((n, r) => n + (r.match.seen === false ? 1 : 0), 0), [rows])
  const olderCount = rows.length - recentRows.length

  const hasRows = status === 'ready' && hasProfile && rows.length > 0

  const subtitle = !hasRows
    ? 'Your curated roles will land here.'
    : `${rows.length} ${rows.length === 1 ? 'role' : 'roles'} matched${newCount > 0 ? ` · ${newCount} new` : ''}`

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
  } else if (shown.length === 0) {
    // Recent view is empty but older matches exist -- guide the user to All.
    body = (
      <CenteredState
        title={`Nothing new in the last ${RECENT_DAYS} days`}
        body="You're all caught up on fresh postings. Your earlier matches are still here."
        actionLabel={`Show all ${rows.length}`}
        onAction={() => setFilter('all')}
      />
    )
  } else {
    body = (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map((row, i) => {
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
          {filter === 'recent' && olderCount > 0 ? (
            <FooterLink onClick={() => setFilter('all')}>
              Show {olderCount} older {olderCount === 1 ? 'match' : 'matches'}
            </FooterLink>
          ) : (
            "That's every role I have for you."
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Header subtitle={subtitle} />
      {hasRows && (
        <Controls
          filter={filter}
          onFilter={setFilter}
          sort={sort}
          onSort={setSort}
          recentCount={recentRows.length}
          total={rows.length}
        />
      )}
      {body}
    </>
  )
}
