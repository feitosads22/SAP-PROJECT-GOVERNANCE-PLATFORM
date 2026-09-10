import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import type { Project } from '../types/app.types'

const SAP_MODULES = ['FI','CO','MM','SD','PP','WM','HCM','PS','PM','QM','FI/TR','BW/BO','HCM/SF','MM/SD']
const PRIORITIES  = [{v:'low',l:'Baixa'},{v:'medium',l:'Média'},{v:'high',l:'Alta'},{v:'critical',l:'Crítica'}]
const STATUSES    = [{v:'draft',l:'Rascunho'},{v:'active',l:'Ativo'},{v:'on_hold',l:'Em espera'},{v:'completed',l:'Concluído'},{v:'cancelled',l:'Cancelado'}]
const SAP_PHASES  = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar']

type Props = { project: Project; onClose: () => void; onSaved: (p: Project) => void }

export default function EditProjectModal({ project, onClose, onSaved }: Props) {
  const [name,        setName]        = useState(project.name)
  const [code,        setCode]        = useState(project.code ?? '')
  const [description, setDescription] = useState(project.description ?? '')
  const [status,      setStatus]      = useState(project.status)
  const [priority,    setPriority]    = useState(project.priority ?? 'medium')
  const [startDate,   setStartDate]   = useState(project.start_date ?? '')
  const [endDate,     setEndDate]     = useState(project.end_date ?? '')
  const [progress,    setProgress]    = useState(project.progress ?? 0)
  const [sapModule,   setSapModule]   = useState(project.sap_module ?? '')
  const [sapPhase,    setSapPhase]    = useState('')
  const [saving,      setSaving]      = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setSaving(true)
    const { data, error } = await sb.from('projects').update({
      name:        name.trim(),
      code:        code.trim().toUpperCase(),
      description: description.trim() || null,
      status, priority,
      start_date:  startDate || null,
      end_date:    endDate   || null,
      progress:    Number(progress),
      sap_module:  sapModule || null,
    }).eq('id', project.id).select().single()

    if (error) { toast(error.message, 'error'); setSaving(false); return }
    toast('Projeto atualizado!', 'ok')
    onSaved(data)
  }

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Editar Projeto</div>
            <div style={{ fontSize: '.75rem', color: 'var(--subtle)', marginTop: '.1rem' }}>{project.code}</div>
          </div>
          <button className="panel__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'contents' }}>
          <div className="panel__body">
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Código *</label>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required style={{ fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
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
                <label>Progresso (%)</label>
                <input type="number" value={progress} min={0} max={100}
                  onChange={e => setProgress(Math.min(100, Math.max(0, +e.target.value)))} />
              </div>
              <div className="form-group">
                <label>Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Término</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Módulo SAP</label>
                <select value={sapModule} onChange={e => setSapModule(e.target.value)}>
                  <option value="">— Nenhum —</option>
                  {SAP_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fase Atual (SAP Activate)</label>
                <select value={sapPhase} onChange={e => setSapPhase(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {SAP_PHASES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Descrição</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '.75rem', justifyContent: 'flex-end', background: 'var(--surface-2)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Salvando…' : '✓ Salvar alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
