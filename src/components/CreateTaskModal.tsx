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

// Catálogo padrão de módulos SAP — sempre disponível no combo, mesmo que o
// projeto ainda não tenha esses módulos cadastrados em project_modules.
const SAP_MODULE_CATALOG: { code: string; name: string }[] = [
  { code: 'FI',   name: 'Financeiro' },
  { code: 'CO',   name: 'Controlling' },
  { code: 'MM',   name: 'Materiais' },
  { code: 'SD',   name: 'Vendas' },
  { code: 'PP',   name: 'Produção' },
  { code: 'QM',   name: 'Qualidade' },
  { code: 'PM',   name: 'Manutenção' },
  { code: 'PS',   name: 'Projetos' },
  { code: 'WM',   name: 'Armazém / EWM' },
  { code: 'TR',   name: 'Tesouraria' },
  { code: 'HCM',  name: 'Recursos Humanos' },
  { code: 'BW/BO',name: 'Business Warehouse / BI' },
  { code: 'ABAP', name: 'Desenvolvimento ABAP' },
  { code: 'BASIS',name: 'Basis' },
  { code: 'FIORI',name: 'Fiori / UX' },
  { code: 'S/4HANA', name: 'S/4HANA Core' },
  { code: 'SF',   name: 'SuccessFactors' },
  { code: 'ARIBA',name: 'Ariba' },
  { code: 'TAX',  name: 'Fiscal / TAX' },
]
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
  const [moduleCode,       setModuleCode]       = useState('')
  const [phaseId,          ] = useState('')  // kept for phase_id in insert
  const [sapPhase,         setSapPhase]         = useState('')
  const [frente,           setFrente]           = useState('')
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
    setModuleCode('')
  }

  // Combo mostra sempre o catálogo padrão de módulos SAP + qualquer módulo
  // específico já cadastrado neste projeto que não esteja no catálogo.
  const moduleOptions = (() => {
    const byCode = new Map(SAP_MODULE_CATALOG.map(m => [m.code, m.name]))
    modules.forEach(m => { if (!byCode.has(m.code)) byCode.set(m.code, m.name) })
    return Array.from(byCode.entries()).map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code))
  })()

  // Garante um project_modules para o código escolhido, criando na hora se
  // o projeto ainda não tinha esse módulo cadastrado.
  async function resolveModuleId(code: string): Promise<string | undefined> {
    if (!code) return undefined
    const existing = modules.find(m => m.code === code)
    if (existing) return existing.id
    const catalogName = SAP_MODULE_CATALOG.find(m => m.code === code)?.name ?? code
    const { data, error } = await (supabase as any)
      .from('project_modules')
      .insert({ organization_id: organizationId, project_id: projectId, name: catalogName, code })
      .select('id,name,code')
      .single()
    if (error || !data) return undefined
    setModules(prev => [...prev, data])
    return data.id
  }

  async function handleCreate() {
    if (!title.trim()) { setErro('Título obrigatório.'); return }
    if (!projectId)    { setErro('Selecione um projeto.'); return }
    setSaving(true); setErro(null)

    const resolvedModuleId = moduleCode ? await resolveModuleId(moduleCode) : undefined
    if (moduleCode && !resolvedModuleId) {
      setErro('Não foi possível cadastrar esse módulo no projeto (peça a um admin/gerente). A tarefa será criada sem módulo.')
    }

    const payload: Database['public']['Tables']['tasks']['Insert'] & { frente?: string } = {
      project_id: projectId, organization_id: organizationId,
      title: title.trim(), description: description || undefined,
      priority,
      assignee_id:        assigneeId      || undefined,
      reviewer_id:        reviewerId      || undefined,
      module_id:          resolvedModuleId,
      phase_id:           phaseId         || undefined,
      sap_activate_phase: sapPhase        || undefined,
      frente:             frente.trim()   || undefined,
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
              <label>Frente / Bloco</label>
              <input value={frente} onChange={e => setFrente(e.target.value)} placeholder="Ex: Governança, Basis/Cloud, TAX/Fiscal…" />
            </div>

            <div>
              <label>Módulo SAP</label>
              <select value={moduleCode} onChange={e => setModuleCode(e.target.value)}>
                <option value="">— Nenhum —</option>
                {moduleOptions.map(m => (
                  <option key={m.code} value={m.code}>{m.code} — {m.name}</option>
                ))}
              </select>
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
