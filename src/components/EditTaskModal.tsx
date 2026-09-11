import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import TaskActivity from './TaskActivity'
import type { Task } from '../types/app.types'

const SAP_PHASES  = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar']
const SAP_MODULES = ['FI','CO','MM','SD','PP','WM','HCM','PS','PM','QM','FI/TR','BW/BO']
const PRIORITIES  = [{v:'low',l:'Baixa'},{v:'medium',l:'Média'},{v:'high',l:'Alta'},{v:'critical',l:'Crítica'}]
const STATUSES    = [
  {v:'todo',l:'A fazer'},{v:'in_progress',l:'Em andamento'},
  {v:'blocked',l:'Bloqueado'},{v:'validation',l:'Validação'},
  {v:'adjustment_required',l:'Ajuste necessário'},{v:'completed',l:'Concluído'},
  {v:'cancelled',l:'Cancelado'},
]

type Props = { task: Task; onClose: () => void; onSaved: () => void }

export default function EditTaskModal({ task, onClose, onSaved }: Props) {
  const [title,      setTitle]      = useState(task.title)
  const [status,     setStatus]     = useState(task.status)
  const [priority,   setPriority]   = useState(task.priority ?? 'medium')
  const [sapPhase,   setSapPhase]   = useState(task.sap_activate_phase ?? '')
  const [sapModule,  setSapModule]  = useState('')
  const [frente,     setFrente]     = useState(task.frente ?? '')
  const [startDate,  setStartDate]  = useState(task.start_date ?? '')
  const [dueDate,    setDueDate]    = useState(task.due_date ?? '')
  const [estHours,   setEstHours]   = useState(String(task.estimated_hours ?? ''))
  const [progress,   setProgress]   = useState(task.progress ?? 0)
  const [description,setDescription]= useState(task.description ?? '')
  const [saving,     setSaving]     = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const { error } = await sb.from('tasks').update({
      title:              title.trim(),
      status, priority,
      sap_activate_phase: sapPhase  || null,
      frente:             frente.trim() || null,
      start_date:         startDate || null,
      due_date:           dueDate   || null,
      estimated_hours:    estHours  ? Number(estHours) : null,
      progress:           Number(progress),
      description:        description.trim() || null,
    }).eq('id', task.id)

    if (error) { toast(error.message, 'error'); setSaving(false); return }
    toast('Tarefa atualizada!', 'ok')
    onSaved()
  }

  async function handleDelete() {
    if (!confirm('Excluir esta tarefa permanentemente?')) return
    const { error } = await sb.from('tasks').delete().eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Tarefa excluída.', 'warn')
    onSaved()
  }

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <div className="panel__header">
          <div className="panel__title">Editar Tarefa</div>
          <button className="panel__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'contents' }}>
          <div className="panel__body">
            <div className="form-group">
              <label>Título *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fase SAP Activate</label>
                <select value={sapPhase} onChange={e => setSapPhase(e.target.value)}>
                  <option value="">— Nenhuma —</option>
                  {SAP_PHASES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Frente / Bloco</label>
                <input value={frente} onChange={e => setFrente(e.target.value)} placeholder="Ex: Governança, Basis/Cloud…" />
              </div>
              <div className="form-group">
                <label>Módulo SAP</label>
                <select value={sapModule} onChange={e => setSapModule(e.target.value)}>
                  <option value="">— Nenhum —</option>
                  {SAP_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Prazo</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Horas estimadas</label>
                <input type="number" value={estHours} min={0} step={0.5}
                  onChange={e => setEstHours(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Progresso (%)</label>
                <input type="number" value={progress} min={0} max={100}
                  onChange={e => setProgress(Math.min(100, Math.max(0, +e.target.value)))} />
              </div>
            </div>
            <div className="form-group">
              <label>Descrição / Observações</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Detalhes, contexto, links…" />
            </div>
            <TaskActivity taskId={task.id} taskTitle={task.title} />
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '.75rem', background: 'var(--surface-2)' }}>
            <button type="button" className="btn-danger btn-sm" onClick={handleDelete}
              style={{ marginRight: 'auto' }}>
              🗑 Excluir
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Salvando…' : '✓ Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
