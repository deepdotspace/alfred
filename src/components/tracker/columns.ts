/**
 * Tracker board column definitions (DESIGN-SPEC §3.3 + DATA-MAP §8).
 *
 * The prototype shows 5 columns; our data model adds a Rejected column (and a
 * dismiss action), so the board is 6 columns. Stage dot colors come from §1.1
 * for the original five; Rejected uses a calm muted rose that sits alongside the
 * pastel palette (no `--alf-stage-rejected` token exists yet -- kept literal
 * here so the shared token layer in styles.css is untouched).
 */
import type { ApplicationStage } from '../../types'

export interface ColumnDef {
  /** The application.stage this column shows. */
  stage: ApplicationStage
  label: string
  /** Dot color (CSS var for the five prototype stages, literal for rejected). */
  dot: string
}

export const TRACKER_COLUMNS: ColumnDef[] = [
  { stage: 'saved', label: 'Saved', dot: 'var(--alf-stage-saved)' },
  { stage: 'tailored', label: 'Tailored', dot: 'var(--alf-stage-tailored)' },
  { stage: 'applied', label: 'Applied', dot: 'var(--alf-stage-applied)' },
  { stage: 'interview', label: 'Interview', dot: 'var(--alf-stage-interview)' },
  { stage: 'offer', label: 'Offer', dot: 'var(--alf-stage-offer)' },
  { stage: 'rejected', label: 'Rejected', dot: '#C2566B' },
]

/** Forward pipeline: saved -> tailored -> applied -> interview -> offer. */
const ADVANCE_ORDER: ApplicationStage[] = ['saved', 'tailored', 'applied', 'interview', 'offer']

/** The next stage when advancing, or null at the end / off the pipeline. */
export function nextStage(stage: ApplicationStage): ApplicationStage | null {
  const i = ADVANCE_ORDER.indexOf(stage)
  if (i === -1 || i >= ADVANCE_ORDER.length - 1) return null
  return ADVANCE_ORDER[i + 1]
}
