import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTaskComments, createTaskComment, deleteTaskComment, extractMentions, notifyMention } from '../lib/comments'
import type { TaskComment } from '../lib/comments'
import { getOrgProfiles } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { toast } from './Toast'

type HistoryRow = {
  id: string; field: string; old_value: string | null; new_value: string | null
  created_at: string; changer?: { full_name: string | null } | null
}

const FIELD_LABEL: Record<string, string> = {
  status: 'Status', priority: 'Prioridade', assignee_id: 'Responsável', reviewer_id: 'Revisor',
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.round(diff / 60)} min`
  if (diff < 86400) return `há ${Math.round(diff / 3600)} h`
  return new Date(date).toLocaleDateString('pt-BR')
}

type Props = { taskId: string; taskTitle: string }

export default function TaskActivity({ taskId, taskTitle }: Props) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'comments' | 'history'>('comments')
  const [comments, setComments] = useState<TaskComment[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: h }, { data: p }] = await Promise.all([
      getTaskComments(taskId),
      sb.from('task_history').select('*, changer:profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: false }),
      getOrgProfiles(),
    ])
    setComments((c ?? []) as TaskComment[])
    setHistory((h ?? []) as HistoryRow[])
    setProfiles(p ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [taskId])

  async function handleSubmit() {
    if (!body.trim() || !profile?.id || !profile.organization_id) return
    setSaving(true)
    const { data, error } = await createTaskComment(taskId, profile.id, body.trim(), profile.organization_id)
    if (error) { toast(error.message, 'error'); setSaving(false); return }
    const mentioned = extractMentions(body, profiles)
    for (const m of mentioned) {
      if (m.id !== profile.id && profile.organization_id) {
        void notifyMention(profile.organization_id, m.id, taskId, taskTitle, profile.full_name ?? 'Alguém')
      }
    }
    setComments(prev => [...prev, data as TaskComment])
    setBody('')
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este comentário?')) return
    await deleteTaskComment(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="form-group" style={{ marginTop: '.5rem' }}>
      <div className="tabs" style={{ marginBottom: '.5rem' }}>
        <button type="button" className={`tab-btn${tab === 'comments' ? ' tab-btn--active' : ''}`} onClick={() => setTab('comments')}>
          💬 Comentários ({comments.length})
        </button>
        <button type="button" className={`tab-btn${tab === 'history' ? ' tab-btn--active' : ''}`} onClick={() => setTab('history')}>
          🕓 Histórico
        </button>
      </div>

      {tab === 'comments' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', maxHeight: 220, overflowY: 'auto', marginBottom: '.5rem' }}>
            {loading ? <p className="sutil">Carregando…</p> : comments.length === 0 ? (
              <p style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>Nenhum comentário ainda.</p>
            ) : comments.map(c => (
              <div key={c.id} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '.5rem .75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '.8125rem' }}>{c.author?.full_name ?? 'Usuário'}</span>
                  <span style={{ fontSize: '.6875rem', color: 'var(--subtle)' }}>{timeAgo(c.created_at)}</span>
                </div>
                <p style={{ fontSize: '.8125rem', marginTop: '.125rem', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                {c.author_id === profile?.id && (
                  <button type="button" className="btn-ghost btn-sm" style={{ fontSize: '.625rem', color: 'var(--danger)', padding: 0, marginTop: '.25rem' }}
                    onClick={() => handleDelete(c.id)}>Excluir</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva um comentário… use @Nome para mencionar"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() } }}
              style={{ flex: 1, fontSize: '.8125rem' }} />
            <button type="button" className="btn-sm" disabled={saving || !body.trim()} onClick={handleSubmit}>{saving ? '…' : 'Enviar'}</button>
          </div>
        </>
      )}

      {tab === 'history' && (
        loading ? <p className="sutil">Carregando…</p> : history.length === 0 ? (
          <p style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>Sem alterações registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.375rem', maxHeight: 220, overflowY: 'auto' }}>
            {history.map(h => (
              <div key={h.id} style={{ fontSize: '.8125rem', borderLeft: '2px solid var(--border)', paddingLeft: '.5rem' }}>
                <strong>{h.changer?.full_name ?? 'Alguém'}</strong> alterou <strong>{FIELD_LABEL[h.field] ?? h.field}</strong>{' '}
                de &quot;{h.old_value ?? '—'}&quot; para &quot;{h.new_value ?? '—'}&quot;
                <div style={{ fontSize: '.6875rem', color: 'var(--subtle)' }}>{timeAgo(h.created_at)}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
