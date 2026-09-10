import { useEffect, useState } from 'react'

export type ToastType = 'ok' | 'error' | 'warn' | 'info'

type ToastItem = { id: number; msg: string; type: ToastType }

let _add: ((msg: string, type: ToastType) => void) | null = null

export function toast(msg: string, type: ToastType = 'ok') {
  _add?.(msg, type)
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  ok:    { bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  error: { bg: '#fef2f2', border: '#fca5a5', icon: '❌' },
  warn:  { bg: '#fffbeb', border: '#fcd34d', icon: '⚠️' },
  info:  { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ️' },
}

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])
  let counter = 0

  useEffect(() => {
    _add = (msg, type) => {
      const id = ++counter
      setItems(prev => [...prev, { id, msg, type }])
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3500)
    }
    return () => { _add = null }
  }, [])

  if (!items.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '.5rem',
      zIndex: 9999, maxWidth: 340,
    }}>
      {items.map(t => {
        const cfg = COLORS[t.type]
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: '.625rem',
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 'var(--r-lg)', padding: '.75rem 1rem',
            boxShadow: 'var(--shadow)',
            animation: 'slideIn .2s ease',
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cfg.icon}</span>
            <span style={{ fontSize: '.875rem', fontWeight: 500, color: 'var(--text)', flex: 1 }}>{t.msg}</span>
          </div>
        )
      })}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
