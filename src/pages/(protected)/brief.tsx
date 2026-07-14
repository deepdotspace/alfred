/**
 * Brief -- the two-pane core (DESIGN-SPEC §3.1).
 *
 * Left: the scrollable list of honest role matches, strongest first. Right: the
 * greeting hero (no selection) or the full role detail (header, apply handoff,
 * Alfred's read / The role / Tailor & apply). Reads the live match + job +
 * application data via useBriefData; the matcher (P3 server pipeline) writes
 * verdicts that stream in over WebSocket.
 *
 * P4 wire (minimal seam): hosts the Document Workspace overlay (§3.2). The
 * Tailor & apply tab kicks the tailoring engine itself (useTailor); `onOpenWork-
 * space` lifts which role's workspace is shown so the overlay can render above
 * the shell.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TwoPane } from '../../components/shell/TwoPane'
import { BriefList } from '../../components/brief/BriefList'
import { BriefGreeting } from '../../components/brief/BriefGreeting'
import { RoleDetail } from '../../components/brief/RoleDetail'
import { useBriefData } from '../../components/brief/data'
import { DocumentWorkspace } from '../../components/workspace/DocumentWorkspace'

export default function BriefPage() {
  const data = useBriefData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [workspaceJobId, setWorkspaceJobId] = useState<string | null>(null)

  // Deep-link: the tracker "Open" action and the digest email CTA navigate to
  // /brief?job=<id>. Once the matching row has loaded, auto-select it and clear
  // the param so back-navigation and re-renders do not re-trigger the selection.
  useEffect(() => {
    const jobParam = searchParams.get('job')
    if (!jobParam) return
    const row = data.rows.find((r) => r.jobId === jobParam)
    if (!row) return
    setSelectedJobId(jobParam)
    if (row.match.seen === false) data.markSeen(jobParam)
    const next = new URLSearchParams(searchParams)
    next.delete('job')
    setSearchParams(next, { replace: true })
  }, [searchParams, data.rows, data, setSearchParams])

  const selected = data.rows.find((r) => r.jobId === selectedJobId) ?? null
  const workspaceRow = data.rows.find((r) => r.jobId === workspaceJobId) ?? null

  function handleSelect(jobId: string) {
    setSelectedJobId(jobId)
    const row = data.rows.find((r) => r.jobId === jobId)
    if (row && row.match.seen === false) data.markSeen(jobId)
  }

  function handleDismiss(jobId: string) {
    void data.dismissRole(jobId)
    if (selectedJobId === jobId) setSelectedJobId(null)
  }

  return (
    <>
      <TwoPane
        list={
          <BriefList
            rows={data.rows}
            status={data.status}
            hasProfile={data.hasProfile}
            needsSponsor={data.needsSponsor}
            search={data.search}
            matchRan={data.stats.matchRan}
            selectedJobId={selectedJobId}
            onSelect={handleSelect}
            onRecompute={() => void data.recompute('full')}
          />
        }
        detail={
          selected ? (
            <RoleDetail
              key={selected.jobId}
              row={selected}
              needsSponsor={data.needsSponsor}
              appStage={data.appStage(selected.jobId)}
              onBack={() => setSelectedJobId(null)}
              onSave={(jobId) => void data.saveRole(jobId)}
              onDismiss={handleDismiss}
              onApplied={(jobId) => void data.markApplied(jobId)}
              onOpenWorkspace={(jobId) => setWorkspaceJobId(jobId)}
            />
          ) : (
            <BriefGreeting
              firstName={data.user?.firstName ?? 'there'}
              status={data.status}
              hasProfile={data.hasProfile}
              search={data.search}
              stats={data.stats}
              onAdjustTargeting={() => navigate('/profile')}
              onRetrySearch={() => void data.recompute('full')}
            />
          )
        }
      />

      {workspaceRow && (
        <DocumentWorkspace
          jobId={workspaceRow.jobId}
          job={workspaceRow.job}
          appStage={data.appStage(workspaceRow.jobId)}
          onApplied={(jobId) => void data.markApplied(jobId)}
          onClose={() => setWorkspaceJobId(null)}
        />
      )}
    </>
  )
}
