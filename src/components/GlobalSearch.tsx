import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Result = {
  type: 'project' | 'task' | 'person'
  id: string; label: string; sub: string; icon: string
}

export default function GlobalSearch() {
  const navigate  = useNavigate()
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const timer= useRef<ReturnType<typeof setTimeout>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      const q = query.trim()
      const [rP, rT, rPr] = await Promise.all([
        sb.from('projects').select('id,name,code,status').or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(4),
        sb.from('tasks').select('id,title,status,project_id').ilike('title', `%${q}%`).limit(4),
        sb.from('profiles').select('id,full_name,email,role').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(3),
      ])

      const res: Result[] = [
        ...(rP.data ?? []).map((p: any) => ({
          type: 'project' as const, id: p.id,
          label: p.name, sub: `${p.code} · ${p.status}`, icon: '📁',
        })),
        ...(rT.data ?? []).map((t: any) => ({
          type: 'task' as const, id: t.project_id,
          label: t.title, sub: `Tarefa · ${t.status.replace(/_/g,' ')}`, icon: '✓',
        })),
        ...(rPr.data ?? []).map((p: any) => ({
          type: 'person' as const, id: p.id,
          label: p.full_name ?? p.email, sub: p.role, icon: '👤',
        })),
      ]
      setResults(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 280)
    return () => clearTimeout(timer.current)
  }, [query])

  function select(r: Result) {
    setQuery(''); setOpen(false)
    if (r.type === 'project' || r.type === 'task') navigate(`/projeto/${r.id}`)
    else navigate('/equipe')
  }

  return (
    <div ref={ref} style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
      <div className="topbar__search">
        <span className="topbar__search-icon">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false) }
            if (e.key === 'Enter' && results.length > 0) select(results[0])
          }}
          placeholder="Buscar projetos, tarefas, pessoas…"
        />
        {loading && (
          <span style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '.75rem', color: 'var(--subtle-2)' }}>…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
          zIndex: 600, overflow: 'hidden',
        }}>
          {results.map((r, i) => (
            <button key={`${r.type}-${r.id}-${i}`}
              onClick={() => select(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: '.75rem',
                width: '100%', padding: '.625rem 1rem', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', transition: 'background .1s', boxShadow: 'none',
                borderRadius: 0, color: 'var(--text)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{r.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                <div style={{ fontSize: '.6875rem', color: 'var(--subtle)', marginTop: '.1rem' }}>{r.sub}</div>
              </div>
            </button>
          ))}
          {query.length >= 2 && (
            <button
              onClick={() => { navigate(`/?q=${encodeURIComponent(query)}`); setQuery(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '.5rem', background: 'var(--surface-2)', border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: '.75rem', color: 'var(--brand)', fontWeight: 600, boxShadow: 'none' }}>
              Ver todos os resultados para "{query}" →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
