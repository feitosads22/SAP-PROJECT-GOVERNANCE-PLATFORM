import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getTasksByProject } from '../lib/api'
import { getProjectFinancial } from '../lib/financial'
import { supabase } from '../lib/supabase'
import { newReportDoc, addReportTable, footerAndSave } from '../lib/pdf'
import type { Project, Task } from '../types/app.types'
import type { FinancialRow } from '../lib/financial'
import KanbanBoard from '../components/KanbanBoard'
import ProjectDocuments from './ProjectDocuments'
import SchedulePage from './SchedulePage'
import BudgetPage from './BudgetPage'
import EditProjectModal from '../components/EditProjectModal'
import GovernancePage from './GovernancePage'
import CustomerManagePage from './CustomerManagePage'
import ProjectTeamTab from '../components/ProjectTeamTab'

const STATUS_COLOR: Record<string,string> = {
  draft:'#94A3B8', active:'#16A34A', on_hold:'#F59E0B',
  completed:'#2563EB', cancelled:'#DC2626',
}
const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}

function brl(v: number|null|undefined) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

type Risk   = { id:string; title:string; probability:string; impact:string; score:number|null; status:string; category:string|null }
type Issue  = { id:string; title:string; priority:string; status:string; created_at:string }

type Props = { role: string; userId: string }
export default function ProjectDetail({ role, userId }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [project,  setProject]  = useState<Project | null>(null)
  const [fin,      setFin]      = useState<FinancialRow | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [risks,    setRisks]    = useState<Risk[]>([])
  const [issues,   setIssues]   = useState<Issue[]>([])
  const [summary,  setSummary]  = useState<{ health_score: number | null; health_status: string | null; schedule_status: string; days_remaining: number | null } | null>(null)
  const [activity, setActivity] = useState<{ id: string; icon: string; who: string; text: string; taskTitle?: string; when: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)

  const canEdit = role === 'admin' || role === 'manager'
  const [showEdit, setShowEdit] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    if (!id) return
    setLoading(true)
    const [rPrj, rFin, rTasks, rRisks, rIssues, rSummary] = await Promise.all([
      getProject(id),
      getProjectFinancial(id),
      getTasksByProject(id),
      sb.from('project_risks').select('*').eq('project_id', id).order('score', { ascending: false }),
      sb.from('project_issues').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      sb.from('portfolio_summary').select('health_score,health_status,schedule_status,days_remaining').eq('project_id', id).maybeSingle(),
    ])
    if (rPrj.error) setErro(rPrj.error.message)
    else setProject(rPrj.data)
    if (!rFin.error) setFin(rFin.data)
    if (!rTasks.error) setTasks((rTasks.data ?? []) as Task[])
    if (!rRisks.error) setRisks(rRisks.data ?? [])
    if (!rIssues.error) setIssues(rIssues.data ?? [])
    if (!rSummary.error) setSummary(rSummary.data ?? null)
    setLoading(false)
  }

  useEffect(() => { void load() }, [id])

  useEffect(() => {
    if (tasks.length === 0) { setActivity([]); return }
    const ids = tasks.map(t => t.id)
    const titleOf = (tid: string) => tasks.find(t => t.id === tid)?.title
    const FIELD_LABEL: Record<string, string> = { status: 'status', priority: 'prioridade', assignee_id: 'responsável', reviewer_id: 'revisor' }
    Promise.all([
      sb.from('task_history').select('id,field,old_value,new_value,created_at,task_id,changer:profiles(full_name)').in('task_id', ids).order('created_at', { ascending: false }).limit(10),
      sb.from('task_comments').select('id,body,created_at,task_id,author:profiles(full_name)').in('task_id', ids).order('created_at', { ascending: false }).limit(10),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]).then(([{ data: h }, { data: c }]: any[]) => {
      const items = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(h ?? []).map((r: any) => ({
          id: 'h' + r.id, when: r.created_at, icon: '✏️',
          who: r.changer?.full_name ?? 'Alguém',
          text: `alterou ${FIELD_LABEL[r.field] ?? r.field} de "${r.old_value ?? '—'}" para "${r.new_value ?? '—'}"`,
          taskTitle: titleOf(r.task_id),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(c ?? []).map((r: any) => ({
          id: 'c' + r.id, when: r.created_at, icon: '💬',
          who: r.author?.full_name ?? 'Alguém',
          text: `comentou: "${String(r.body).slice(0, 80)}"`,
          taskTitle: titleOf(r.task_id),
        })),
      ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 15)
      setActivity(items)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  if (loading) return (
    <div className="page">
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {[1,2,3].map(i => <div key={i} style={{ height:80, borderRadius:'var(--r-lg)' }} className="skeleton" />)}
      </div>
    </div>
  )

  if (erro || !project) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state__icon">⚠️</div>
        <div className="empty-state__title">{erro ?? 'Projeto não encontrado'}</div>
        <button onClick={() => navigate('/')} style={{ marginTop:'1rem' }}>← Voltar</button>
      </div>
    </div>
  )

  const tasksDone   = tasks.filter(t => t.status === 'completed').length
  const tasksOpen   = tasks.filter(t => !['completed','cancelled'].includes(t.status)).length
  const risksCrit   = risks.filter(r => !['resolved','accepted'].includes(r.status) && (r.score ?? 0) >= 9).length
  const issuesOpen  = issues.filter(i => ['open','in_progress'].includes(i.status)).length
  const healthScore = summary?.health_score ?? null
  const healthStatus = summary?.health_status ?? null

  const RISK_SCORE_COLOR = (s: number) =>
    s >= 12 ? '#7C3AED' : s >= 9 ? '#DC2626' : s >= 6 ? '#F59E0B' : '#16A34A'

  const PROB_LABEL: Record<string,string> = { low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica' }
  const IMPACT_LABEL: Record<string,string> = { low:'Baixo', medium:'Médio', high:'Alto', critical:'Crítico' }
  const ISSUE_STATUS: Record<string,string> = { open:'Aberta', in_progress:'Em andamento', resolved:'Resolvida', closed:'Fechada', cancelled:'Cancelada' }

type Tab = 'overview'|'tasks'|'equipe'|'risks'|'financial'|'governance'|'clientes'|'documentos'|'cronograma'|'documentos'
  const TABS: { id: Tab; label: string; icon: string; roles?: string[] }[] = [
    { id:'overview',   label:'Visão Geral',  icon:'📊' },
    { id:'tasks',      label:'Tarefas',       icon:'✓' },
    { id:'equipe',     label:'Equipe',        icon:'👥', roles:['admin','manager','consultant'] },
    { id:'risks',      label:'Riscos & Issues',icon:'⚠️' },
    { id:'financial',  label:'Financeiro',    icon:'💰', roles:['admin','manager','consultant'] },
    { id:'governance', label:'Governança',    icon:'🛡️', roles:['admin','manager','consultant'] },
    { id:'clientes',   label:'Clientes',      icon:'👥', roles:['admin','manager'] },
    { id:'documentos',  label:'Documentos',    icon:'📁' },
    { id:'cronograma', label:'Cronograma',    icon:'📅' },
  ]

  return (
    <div className="page page--wide">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="btn-ghost" style={{ padding:0, fontSize:'.8125rem', boxShadow:'none', border:'none', background:'none', color:'var(--subtle)' }}
          onClick={() => navigate('/')}>
          Projetos
        </button>
        <span className="breadcrumb__sep">›</span>
        <span className="breadcrumb__current">{project.name}</span>
      </div>

      {/* Header */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', padding:'1.5rem', marginBottom:'1.25rem', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', gap:'.5rem', alignItems:'center', marginBottom:'.5rem', flexWrap:'wrap' }}>
              <span className="badge" style={{
                background: (STATUS_COLOR[project.status]??'#94A3B8')+'22',
                color: STATUS_COLOR[project.status]??'#94A3B8',
                borderColor: (STATUS_COLOR[project.status]??'#94A3B8')+'44',
              }}>{STATUS_LABEL[project.status]??project.status}</span>
              {project.sap_module && <span className="badge badge--brand">{project.sap_module}</span>}
              {project.code && <span className="badge">{project.code}</span>}
              {healthStatus && (
                <span className={`health-badge health-badge--${healthStatus}`}>
                  {healthStatus === 'healthy' ? '🟢 Saudável' : healthStatus === 'attention' ? '🟡 Atenção' : healthStatus === 'at_risk' ? '🟠 Em risco' : '🔴 Crítico'}
                </span>
              )}
            </div>
            <h1 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-.025em', margin:0 }}>{project.name}</h1>
            {project.description && <p style={{ color:'var(--subtle)', fontSize:'.875rem', marginTop:'.375rem', maxWidth:560 }}>{project.description}</p>}
          </div>

          <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', alignItems:'center' }}>
            {role !== 'customer' && (
              <button className="btn-secondary" onClick={() => {
                const doc = newReportDoc(`Relatório de Status — ${project.name}`, `${project.code} · gerado em ${new Date().toLocaleDateString('pt-BR')}`)
                addReportTable(doc, ['Indicador', 'Valor'], [
                  ['Status', STATUS_LABEL[project.status] ?? project.status],
                  ['Progresso', `${project.progress}%`],
                  ['Health score', healthScore != null ? `${healthScore} (${healthStatus === 'healthy' ? 'Saudável' : healthStatus === 'attention' ? 'Atenção' : healthStatus === 'at_risk' ? 'Em risco' : healthStatus === 'critical' ? 'Crítico' : '—'})` : '—'],
                  ['Prazo', summary?.schedule_status === 'atrasado' ? 'Atrasado' : summary?.days_remaining != null ? `${summary.days_remaining} dia(s) restante(s)` : '—'],
                  ['Budget total', brl(fin?.budget_total)],
                  ['Custo realizado', brl(fin?.cost_actual_total)],
                  ['Tarefas concluídas', `${tasksDone}/${tasksDone + tasksOpen}`],
                  ['Riscos críticos', String(risksCrit)],
                  ['Issues abertas', String(issuesOpen)],
                ], 45)
                if (risks.length > 0) {
                  addReportTable(doc, ['Risco', 'Probabilidade', 'Impacto', 'Score', 'Status'],
                    risks.map(r => [r.title, PROB_LABEL[r.probability] ?? r.probability, IMPACT_LABEL[r.impact] ?? r.impact, r.score ?? '—', r.status]),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ((doc as any).lastAutoTable?.finalY ?? 45) + 10)
                }
                footerAndSave(doc, `status_${project.code}_${new Date().toISOString().slice(0, 10)}.pdf`)
              }}>📄 Relatório PDF</button>
            )}
            {canEdit && (
              <>
                <button className="btn-secondary" onClick={() => { setTab('financial') }}>💰 Financeiro</button>
                <button className="btn-secondary" onClick={() => { setTab('governance') }}>🛡️ Governança</button>
                <button className="btn-secondary" onClick={() => { setTab('clientes') }}>👥 Clientes</button>
              </>
            )}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.875rem', fontWeight:800, color:'var(--brand)', lineHeight:1 }}>{project.progress}%</div>
              <div style={{ width:100, height:5, background:'var(--surface-3)', borderRadius:99, overflow:'hidden', marginTop:'.25rem' }}>
                <div style={{ width:`${project.progress}%`, height:'100%', background:'var(--brand)', borderRadius:99 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mini KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'.75rem', marginTop:'1.25rem', paddingTop:'1.25rem', borderTop:'1px solid var(--border)' }}>
          {[
            { label:'Tarefas concluídas', val:`${tasksDone}/${tasksDone+tasksOpen}`, icon:'✓', color:'var(--ok)' },
            { label:'Riscos críticos',    val:String(risksCrit), icon:'⚠️', color: risksCrit > 0 ? 'var(--danger)' : 'var(--ok)' },
            { label:'Issues abertas',     val:String(issuesOpen), icon:'🔴', color: issuesOpen > 0 ? 'var(--warn)' : 'var(--ok)' },
            { label:'Budget',             val:brl(fin?.budget_total), icon:'💰', color:'var(--brand)' },
            { label:'Custo realizado',    val:brl(fin?.cost_actual_total), icon:'📈', color:'var(--text-2)' },
            { label:'Prazo',              val: project.end_date ? new Date(project.end_date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—', icon:'📅', color: project.end_date && new Date(project.end_date) < new Date() ? 'var(--danger)' : 'var(--text-2)' },
          ].map(k => (
            <div key={k.label} style={{ display:'flex', flexDirection:'column', gap:'.2rem' }}>
              <span style={{ fontSize:'.6875rem', color:'var(--subtle)', fontWeight:600 }}>{k.label}</span>
              <span style={{ fontSize:'1rem', fontWeight:800, color: k.color }}>{k.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.filter(t => !t.roles || t.roles.includes(role)).map(t => (
          <button key={t.id} className={`tab-btn${tab===t.id?' tab-btn--active':''}`}
            onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
          {/* Datas */}
          <div className="card">
            <div className="card__header"><span className="card__title"><span className="card__title-icon">📅</span>Cronograma</span></div>
            <div className="card__body">
              {[
                { label:'Início planejado', val: project.start_date ? new Date(project.start_date).toLocaleDateString('pt-BR') : '—' },
                { label:'Fim planejado',    val: project.end_date   ? new Date(project.end_date).toLocaleDateString('pt-BR')   : '—' },
                { label:'Progresso',        val: `${project.progress}%` },
                { label:'Status',           val: STATUS_LABEL[project.status] ?? project.status },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{r.label}</span>
                  <span style={{ fontSize:'.875rem', fontWeight:600 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financeiro resumo */}
          <div className="card">
            <div className="card__header">
              <span className="card__title"><span className="card__title-icon">💰</span>Financeiro</span>
              {canEdit && <button className="card__link" onClick={() => setTab('financial')}>Ver detalhes →</button>}
            </div>
            <div className="card__body">
              {fin ? (
                <>
                  {[
                    { label:'Budget total',    val: brl(fin.budget_total) },
                    { label:'Custo realizado', val: brl(fin.cost_actual_total) },
                    { label:'Forecast',        val: brl(fin.cost_forecast) },
                    { label:'Variance',        val: fin.variance_pct != null ? `${fin.variance_pct}%` : '—' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{r.label}</span>
                      <span style={{ fontSize:'.875rem', fontWeight:600 }}>{r.val}</span>
                    </div>
                  ))}
                  {fin.budget_total > 0 && (
                    <div style={{ marginTop:'.75rem' }}>
                      <div style={{ height:8, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${Math.min(fin.cost_actual_total/fin.budget_total*100,100)}%`, height:'100%', background: fin.financial_status==='estourado'?'var(--danger)':fin.financial_status==='atencao'?'var(--warn)':'var(--ok)', borderRadius:99 }} />
                      </div>
                    </div>
                  )}
                </>
              ) : <p className="sutil">Sem dados financeiros.</p>}
            </div>
          </div>

          {/* Riscos resumo */}
          <div className="card">
            <div className="card__header">
              <span className="card__title"><span className="card__title-icon">⚠️</span>Top Riscos</span>
              <button className="card__link" onClick={() => setTab('risks')}>Ver todos →</button>
            </div>
            <div className="card__body">
              {risks.slice(0,4).map(r => (
                <div key={r.id} style={{ display:'flex', gap:'.75rem', alignItems:'center', padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: RISK_SCORE_COLOR(r.score??0)+'22', color: RISK_SCORE_COLOR(r.score??0), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.75rem', fontWeight:800, flexShrink:0 }}>
                    {r.score ?? '?'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.8125rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize:'.6875rem', color:'var(--subtle)' }}>
                      {PROB_LABEL[r.probability]??r.probability} × {IMPACT_LABEL[r.impact]??r.impact}
                    </div>
                  </div>
                  <span className="badge">{r.status}</span>
                </div>
              ))}
              {risks.length === 0 && <p className="sutil">Nenhum risco registrado.</p>}
            </div>
          </div>

          {/* Issues resumo */}
          <div className="card">
            <div className="card__header">
              <span className="card__title"><span className="card__title-icon">🔴</span>Issues Abertas</span>
              <button className="card__link" onClick={() => setTab('risks')}>Ver todas →</button>
            </div>
            <div className="card__body">
              {issues.filter(i=>['open','in_progress'].includes(i.status)).slice(0,4).map(i => (
                <div key={i.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.5rem 0', borderBottom:'1px solid var(--border)', gap:'.5rem' }}>
                  <div style={{ fontSize:'.8125rem', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.title}</div>
                  <span className="badge">{ISSUE_STATUS[i.status]??i.status}</span>
                </div>
              ))}
              {issues.filter(i=>['open','in_progress'].includes(i.status)).length === 0 && (
                <p className="sutil">Nenhuma issue aberta. ✓</p>
              )}
            </div>
          </div>

          {/* Atividades recentes */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card__header">
              <span className="card__title"><span className="card__title-icon">🕓</span>Atividades Recentes</span>
            </div>
            <div className="card__body">
              {activity.length === 0 ? (
                <p className="sutil">Sem atividade recente.</p>
              ) : activity.map(a => (
                <div key={a.id} style={{ display:'flex', gap:'.625rem', padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:'1rem' }}>{a.icon}</span>
                  <div style={{ flex:1, fontSize:'.8125rem' }}>
                    <strong>{a.who}</strong> {a.text} {a.taskTitle && <span className="sutil">— {a.taskTitle}</span>}
                    <div style={{ fontSize:'.6875rem', color:'var(--subtle)' }}>{new Date(a.when).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <KanbanBoard
          projectId={project.id}
          organizationId={project.organization_id}
          role={role}
          userId={userId}
        />
      )}

      {tab === 'equipe' && (
        <ProjectTeamTab projectId={project.id} canManage={canEdit} />
      )}

      {tab === 'risks' && (
        <GovernancePage role={role} userId={userId} overrideProjectId={project.id} />
      )}

      {tab === 'financial' && (
        <BudgetPage role={role} userId={userId} overrideProjectId={project.id} />
      )}

      {tab === 'governance' && (
        <GovernancePage role={role} userId={userId} overrideProjectId={project.id} />
      )}

      {tab === 'clientes' && (
        <CustomerManagePage role={role} userId={userId} overrideProjectId={project.id} />
      )}

      {tab === 'documentos' && (
        <ProjectDocuments projectId={project.id} role={role} />
      )}

      {showEdit && project && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={p => { setProject(p); setShowEdit(false) }}
        />
      )}

      {tab === 'cronograma' && (
        <SchedulePage projectId={project.id} role={role} />
      )}
    </div>
  )
}
