import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrgProfiles } from '../lib/api'
import type { Database } from '../types/database.types'

type Profile = { id: string; full_name: string | null; email: string | null; role: string }
type Module  = { id: string; name: string; code: string }
type Phase   = { id: string; name: string; code: string }

type Props = {
  projectId: string
  organizationId: string
  onCreated: () => void
  onClose: () => void
}

const SAP_ACTIVATE_PHASES = [
  'Descobrir','Preparar','Explorar','Realizar','Implementar','Executar',
] as const

const PRIORITIES = ['low','medium','high','critical'] as const
const PRIORITY_LABEL: Record<string, string> = {
  low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica',
}

function extractError(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e['message'] === 'string') return e['message']
  }
  return 'Erro desconhecido.'
}

export default function CreateTaskModal({ projectId, organizationId, onCreated, onClose }: Props) {
  const [profiles,  setProfiles]  = useState<Profile[]>([])
  const [modules,   setModules]   = useState<Module[]>([])
  const [phases,    setPhases]    = useState<Phase[]>([])
  const [saving,    setSaving]    = useState(false)
  const [erro,      setErro]      = useState<string | null>(null)

  // form fields
  const [title,            setTitle]            = useState('')
  const [description,      setDescription]      = useState('')
  const [priority,         setPriority]         = useState<string>('medium')
  const [assigneeId,       setAssigneeId]       = useState('')
  const [reviewerId,       setReviewerId]       = useState('')
  const [moduleId,         setModuleId]         = useState('')
  const [phaseId,          setPhaseId]          = useState('')
  const [sapPhase,         setSapPhase]         = useState('')
  const [startDate,        setStartDate]        = useState('')
  const [endDate,          setEndDate]          = useState('')
  const [estimatedHours,   setEstimatedHours]   = useState('')
  const [requiresEvidence, setRequiresEvidence] = useState(false)

  useEffect(() => {
    Promise.all([
      getOrgProfiles(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('project_modules').select('id,name,code').eq('project_id', projectId).order('sort_order'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('phases').select('id,name,code').eq('project_id', projectId).order('sort_order'),
    ]).then(([rProfiles, rModules, rPhases]) => {
      if (!rProfiles.error) setProfiles(rProfiles.data ?? [])
      if (!rModules.error)  setModules(rModules.data ?? [])
      if (!rPhases.error)   setPhases(rPhases.data ?? [])
    })
  }, [projectId])

  async function handleCreate() {
    if (!title.trim()) { setErro('Título obrigatório.'); return }
    setSaving(true); setErro(null)

    const payload: Database['public']['Tables']['tasks']['Insert'] = {
      project_id:         projectId,
      organization_id:    organizationId,
      title:              title.trim(),
      description:        description || undefined,
      priority,
      assignee_id:        assigneeId  || undefined,
      reviewer_id:        reviewerId  || undefined,
      module_id:          moduleId    || undefined,
      phase_id:           phaseId     || undefined,
      sap_activate_phase: sapPhase    || undefined,
      planned_start_date: startDate   || undefined,
      planned_end_date:   endDate     || undefined,
      estimated_hours:    estimatedHours ? parseFloat(estimatedHours) : undefined,
      requires_evidence:  requiresEvidence,
      status:             'todo',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('tasks').insert(payload)
    setSaving(false)
    if (error) { setErro(extractError(error)); return }
    onCreated()
  }

  const consultants = profiles.filter(p => ['admin','manager','consultant'].includes(p.role))

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="panel panel--wide">
        <header className="panel__header">
          <h2 className="panel__title">Nova tarefa</h2>
          <button className="panel__close" onClick={onClose}>×</button>
        </header>

        <div className="panel__body">
          {erro && <p className="erro">{erro}</p>}

          <label>Título *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Configurar plano de contas" />

          <label>Descrição</label>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />

          <div className="modal-grid">
            <div>
              <label>Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>

            <div>
              <label>Fase SAP Activate</label>
              <select value={sapPhase} onChange={e => setSapPhase(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {SAP_ACTIVATE_PHASES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label>Módulo SAP</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
            </div>

            <div>
              <label>Fase do projeto</label>
              <select value={phaseId} onChange={e => setPhaseId(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {phases.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label>Responsável</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {consultants.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Revisor</label>
              <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {consultants.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Início planejado</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div>
              <label>Fim planejado</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            <div>
              <label>Horas estimadas</label>
              <input type="number" min="0" step="0.5" value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)} placeholder="Ex: 40" />
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', paddingTop:'1.5rem' }}>
              <input
                type="checkbox" id="req-ev"
                checked={requiresEvidence}
                onChange={e => setRequiresEvidence(e.target.checked)}
                style={{ width:'auto' }}
              />
              <label htmlFor="req-ev" style={{ margin:0, color:'var(--text)' }}>
                Exige evidência para concluir
              </label>
            </div>
          </div>

          <button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Criando…' : 'Criar tarefa'}
          </button>
        </div>
      </aside>
    </div>
  )
}
