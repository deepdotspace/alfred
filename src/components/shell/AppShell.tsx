/**
 * AppShell (DESIGN-SPEC §2.1): the 78px white left icon rail + content area
 * that every in-app screen lives inside.
 *
 * Rail: decorative small mascot on top; Brief (sun) / Tracker (kanban) /
 * Profile (person) icon buttons; user-initial avatar pinned to the bottom.
 * Presentational + route-aware (active state from the URL). Pass the real user
 * initial from the gated layout.
 */
import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Alfred from '../Alfred'
import { SunIcon, KanbanIcon, PersonIcon } from '../ui/alfred/icons'

interface NavDef {
  to: string
  label: string
  Icon: typeof SunIcon
}

const NAV: NavDef[] = [
  { to: '/brief', label: 'Brief', Icon: SunIcon },
  { to: '/tracker', label: 'Tracker', Icon: KanbanIcon },
  { to: '/profile', label: 'Profile', Icon: PersonIcon },
]

export interface AppShellProps {
  children: ReactNode
  userInitial?: string
  /** Full user name, for the avatar's accessible label + tests. */
  userName?: string
  /** Force the active rail item (for previews/tests); defaults to the URL. */
  activePath?: string
}

export function AppShell({ children, userInitial = 'A', userName, activePath }: AppShellProps) {
  const navigate = useNavigate()
  const { pathname: locationPath } = useLocation()
  const pathname = activePath ?? locationPath

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--alf-bg)' }}>
      {/* nav rail */}
      <div
        style={{
          width: 78,
          flexShrink: 0,
          background: 'var(--alf-surface)',
          borderRight: '1px solid var(--alf-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          gap: 6,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <Alfred size="sm" />
        </div>
        {NAV.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/')
          return (
            <button
              key={to}
              title={label}
              onClick={() => navigate(to)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--alf-indigo-tint)' : 'transparent',
                color: active ? 'var(--alf-indigo)' : 'var(--alf-disabled)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .18s',
              }}
            >
              <Icon size={22} />
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <div
          data-testid="shell-user"
          title={userName}
          aria-label={userName ? `Signed in as ${userName}` : undefined}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--alf-avatar-a), var(--alf-avatar-b))',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {userInitial}
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
