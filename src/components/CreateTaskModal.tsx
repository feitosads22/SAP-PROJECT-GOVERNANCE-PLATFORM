import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrgProfiles } from '../lib/api'
import type { Database } from '../types/database.types'
import type { Project } from '../types/app.types'

type Profile = { id: string; full_name: string | null; email: string | null; role: string }
type Module  = { id: string; name: string; code: string }

type Props = {
  projectId:      string
  organizationId: string
  projects?:      Project[]           // opcional: para MyTasks escolher o projeto
  onCreated:      () => void
  onClose:        () => void
}

const SAP_PHASES = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar'] as const
const PRIORITIES  = ['low','medium','high','critical'] as const
const PRIO_LABEL: Record<string,string> = {
  low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica',
}

function err(e: unknown): string {
  if (!e) return 'Erro.'
  if (typeof e === 'string') return e
  const r = e as Record<string, unknown>
  return typeof r['message'] === 'string' ? r['message'] : 'Erro desconhecido.'
}

export default function CreateTaskModal({
  projectId: initialProjectId, organizationId,
  projects = [], onCreated, onClose,
}: Props) {
  const [profiles,  setProfiles]  = useState<Profile[]>([])
  const [modules,   setModules]   = useState<Module[]>([])
  const [saving,    setSaving]    = useState(false)
  const [erro,      setErro]      = useState<string | null>(null)

  const [projectId,        setProjectId]        = useState(initialProjectId)
  const [title,            setTitle]            = useState('')
  const [description,      setDescription]      = useState('')
  const [priority,         setPriority]         = useState('medium')
  const [assigneeId,       setAssigneeId]       = useState('')
  const [reviewerId,       setReviewerId]       = useState('')
  const [moduleId,         setModuleId]         = useState('')
  const [phaseId,          ] = useState('')  // kept for phase_id in insert
  const [sapPhase,         setSapPhase]         = useState('')
  const [startDate,        setStartDate]        = useState('')
  const [endDate,          setEndDate]          = useState('')
  const [estimatedHours,   setEstimatedHours]   = useState('')
  const [requiresEvidence, setRequiresEvidence] = useState(false)

  useEffect(() => { void loadProfiles() }, [])

  useEffect(() => {
    if (projectId) void loadProjectData(projectId)
    else { setModules([]) }
  }, [projectId])

  async function loadProfiles() {
    const { data } = await getOrgProfiles()
    if (data) setProfiles(data as Profile[])
  }

  async function loadProjectData(pid: string) {
    const { data: mData, error: mErr } = await (supabase as any).from('project_modules').select('id,name,code').eq('project_id', pid).order('sort_order')
    if (!mErr) setModules(mData ?? [])
    setModuleId('')
  }

  async function handleCreate() {
    if (!title.trim()) { setErro('Título obrigatório.'); return }
    if (!projectId)    { setErro('Selecione um projeto.'); return }
    setSaving(true); setErro(null)

    const payload: Database['public']['Tables']['tasks']['Insert'] = {
      project_id: projectId, organization_id: organizationId,
      title: title.trim(), description: description || undefined,
      priority,
      assignee_id:        assigneeId      || undefined,
      reviewer_id:        reviewerId      || undefined,
      module_id:          moduleId        || undefined,
      phase_id:           phaseId         || undefined,
      sap_activate_phase: sapPhase        || undefined,
      planned_start_date: startDate       || undefined,
      planned_end_date:   endDate         || undefined,
      estimated_hours:    estimatedHours ? parseFloat(estimatedHours) : undefined,
      requires_evidence:  requiresEvidence,
      status: 'todo',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('tasks').insert(payload)
    setSaving(false)
    if (error) { setErro(err(error)); return }
    onCreated()
  }

  const consultants = profiles.filter(p => ['admin','manager','consultant'].includes(p.role))

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="panel panel--wide">
        <header className="panel__header">
          <div>
            <h2 className="panel__title">Nova tarefa</h2>
            <p className="sutil">Preencha os campos e clique em criar</p>
          </div>
          <button className="panel__close" onClick={onClose}>×</button>
        </header>

        <div className="panel__body">
          {erro && <p className="erro">{erro}</p>}

          {/* Projeto — só quando vem de MyTasks */}
          {projects.length > 0 && (
            <>
              <label>Projeto *</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Selecione…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </>
          )}

          <label>Título *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Configurar plano de contas" />

          <label>Descrição</label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />

          <div className="modal-grid">
            <div>
              <label>Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}
              </select>
            </div>

            <div>
              <label>Fase SAP Activate</label>
              <select value={sapPhase} onChange={e => setSapPhase(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {SAP_PHASES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label>Módulo SAP</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                ))}
              </select>
              {modules.length === 0 && projectId && (
                <p className="sutil" style={{ marginTop: '.25rem', fontSize: '.75rem' }}>
                  Este projeto ainda não tem módulos cadastrados.
                </p>
              )}
            </div>

            <div>
              <label>Responsável</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {consultants.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </select>
            </div>

            <div>
              <label>Revisor</label>
              <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {consultants.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
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

            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', paddingTop:'1.75rem' }}>
              <input type="checkbox" id="req-ev" checked={requiresEvidence}
                onChange={e => setRequiresEvidence(e.target.checked)}
                style={{ width:'auto', display:'inline' }} />
              <label htmlFor="req-ev" style={{ margin:0, textTransform:'none', fontSize:'0.875rem', fontWeight:500, color:'var(--text)', letterSpacing:0 }}>
                Exige evidência para concluir
              </label>
            </div>
          </div>

          <button onClick={handleCreate} disabled={saving || !title.trim() || !projectId}
            style={{ marginTop:'0.5rem' }}>
            {saving ? 'Criando…' : 'Criar tarefa'}
          </button>
        </div>
      </aside>
    </div>
  )
}
