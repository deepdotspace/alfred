/**
 * TwoPane (DESIGN-SPEC §2.2): the master-list + detail layout the Brief uses.
 * A fixed list rail (default 430px, #EDF0FA) beside a fluid detail pane.
 */
import type { ReactNode } from 'react'

export interface TwoPaneProps {
  list: ReactNode
  detail: ReactNode
  listWidth?: number
  listBg?: string
}

export function TwoPane({ list, detail, listWidth = 430, listBg = 'var(--alf-list)' }: TwoPaneProps) {
  // minHeight:0 on every flex child keeps the height chain bounded so the list
  // and detail each scroll INSIDE their column instead of growing the page (a
  // height:100% / flex:1 child of a stretched flex item otherwise resolves to
  // its content height in Chromium and overflows).
  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          width: listWidth,
          flexShrink: 0,
          minHeight: 0,
          borderRight: '1px solid var(--alf-border)',
          background: listBg,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {list}
      </div>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>{detail}</div>
    </div>
  )
}
