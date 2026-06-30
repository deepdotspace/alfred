/**
 * Toast Notification System
 *
 * Self-contained toast provider with success/error/warning/info variants.
 * Uses the theme's semantic color tokens (success, warning, info, destructive).
 *
 * @example
 * // Wrap your app once:
 * <ToastProvider position="bottom-right">
 *   <App />
 * </ToastProvider>
 *
 * // In any child component:
 * const { success, error, warning, info } = useToast()
 * success('Saved!', 'Your changes have been saved.')
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (options: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

// ============================================================================
// Icons (inline SVGs — no external dependency)
// ============================================================================

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ============================================================================
// ToastProvider
// ============================================================================

interface ToastProviderProps {
  children: ReactNode
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center'
  maxToasts?: number
}

export function ToastProvider({
  children,
  position = 'bottom-center',
  maxToasts = 5,
}: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const addToast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      const duration = options.duration ?? 2400

      setToasts((prev) => {
        const next = [...prev, { ...options, id }]
        return next.slice(-maxToasts)
      })

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss, maxToasts],
  )

  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => addToast(options),
    [addToast],
  )
  const success = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'success', title, description }),
    [addToast],
  )
  const error = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'error', title, description }),
    [addToast],
  )
  const warning = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    [addToast],
  )
  const info = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'info', title, description }),
    [addToast],
  )

  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  return (
    <ToastContext.Provider
      value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}
    >
      {children}

      {/* Toast container */}
      <div
        className={`fixed z-[100] flex flex-col gap-2 ${positionClasses[position]}`}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ============================================================================
// ToastItem
// ============================================================================

/**
 * Alfred toast (DESIGN-SPEC §3.6): a dark ink pill with a green check, centered
 * at the bottom, fading up. The type is conveyed by the glyph only — success
 * shows the green check; other types reuse their icon in the same calm pill.
 */
const TOAST_CONFIG = {
  success: { Icon: CheckCircleIcon, iconColor: 'var(--alf-toast-check)' },
  error:   { Icon: AlertCircleIcon, iconColor: '#fff' },
  warning: { Icon: AlertTriangleIcon, iconColor: '#fff' },
  info:    { Icon: InfoIcon, iconColor: '#fff' },
} as const

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast }: ToastItemProps): React.ReactElement {
  const { Icon, iconColor } = TOAST_CONFIG[toast.type]

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'var(--alf-ink)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 500,
        padding: '13px 22px',
        borderRadius: 99,
        boxShadow: '0 10px 30px -8px rgba(20,30,60,.5)',
        animation: 'fadeUp .25s ease both',
      }}
    >
      <span style={{ color: iconColor, display: 'inline-flex', flexShrink: 0 }}>
        <Icon className="h-4 w-4" />
      </span>
      <div style={{ minWidth: 0 }}>
        <span>{toast.title}</span>
        {toast.description && (
          <span style={{ marginLeft: 6, color: 'var(--alf-faint)' }}>{toast.description}</span>
        )}
      </div>
    </div>
  )
}
