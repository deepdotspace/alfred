/**
 * Toast (DESIGN-SPEC §3.6): a dark pill at bottom-center with a green check,
 * auto-clearing after 2400ms. `useToast` drives it.
 */
import { useCallback, useRef, useState } from 'react'
import { CheckIcon } from '../ui/alfred/icons'

export function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(message)
    timer.current = setTimeout(() => setToast(null), 2400)
  }, [])
  return { toast, showToast }
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
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
      <span style={{ color: 'var(--alf-toast-check)', display: 'inline-flex' }}>
        <CheckIcon size={15} />
      </span>
      {message}
    </div>
  )
}
