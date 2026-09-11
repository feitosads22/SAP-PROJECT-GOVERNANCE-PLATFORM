import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Database } from '../types/database.types'

type Risk   = Database['public']['Tables']['project_risks']['Row']
type Issue  = Database['public']['Tables']['project_issues']['Row']
type CR     = Database['public']['Tables']['change_requests']['Row']
type Tab    = 'risks' | 'issues' | 'cr'

type Props = { role: string; userId: string; overrideProjectId?: string }

const PROB_LABEL: Record<string,string>   = { low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica' }
const IMPACT_LABEL: Record<string,string> = { low:'Baixo', medium:'Médio', high:'Alto', critical:'Crítico' }
const RISK_STATUS: Record<string,string>  = {
  identified:'Identificado', analyzing:'Analisando',
  mitigating:'Mitigando', resolved:'Resolvido', accepted:'Aceito',
}
const ISSUE_STATUS: Record<string,string> = {
  open:'Aberta', in_progress:'Em andamento',
  resolved:'Resolvida', closed:'Fechada', cancelled:'Cancelada',
}
const CR_STATUS: Record<string,string> = {
  draft:'Rascunho', submitted:'Submetido',
  approved:'Aprovado', rejected:'Rejeitado', cancelled:'Cancelado',
}
const SCORE_COLOR = (score: number) =>
  score >= 12 ? '#dc2626' : score >= 6 ? '#d97706' : '#16a34a'

const CAT_LABEL: Record<string,string> = {
  scope:'Escopo', schedule:'Prazo', budget:'Orçamento',
  resource:'Recurso', technical:'Técnico', external:'Externo', other:'Outro',
}

function brl(v: number | null | undefined) {
  if (!v) return '—'
  return v.toLocaleString('pt-BR',{ style:'currency', currency:'BRL' })
}
function err(e: unknown): string {
  if (!e) return 'Erro.'
  if (typeof e === 'string') return e
  const r = e as Record<string,unknown>
  return typeof r['message'] === 'string' ? r['message'] : 'Erro.'
}

// ── Generic inline form ───────────────────────────────────────────
function Section({ title, onAdd, children }: {
  title: string; onAdd: () => void; children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
        <h2 className="section-title" style={{ margin:0 }}>{title}</h2>
        <button className="btn-sm" onClick={onAdd}>+ Adicionar</button>
      </div>
      {children}
    </div>
  )
}

export default function GovernancePage({ role, userId, overrideProjectId }: Props) {
  const params = useParams<{ id: string }>()
  const projectId = overrideProjectId ?? params.id
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit  = role === 'admin' || role === 'manager'
  const canApprove = role === 'admin' || role === 'manager'

  const [tab,    setTab]    = useState<Tab>('risks')
  const [risks,  setRisks]  = useState<Risk[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [crs,    setCrs]    = useState<CR[]>([])
  const [loading,setLoading]= useState(true)
  const [erro,   setErro]   = useState<string | null>(null)

  // Risk form
  const [rTitle, setRTitle] = useState('')
  const [rProb,  setRProb]  = useState('medium')
  const [rImp,   setRImp]   = useState('medium')
  const [rCat,   setRCat]   = useState('other')
  const [rMit,   setRMit]   = useState('')
  const [rStatus,setRStatus]= useState('identified')
  const [showRForm, setShowRForm] = useState(false)

  // Issue form
  const [iTitle,  setITitle]  = useState('')
  const [iPrio,   setIPrio]   = useState('medium')
  const [iImpact, setIImpact] = useState('')
  const [iStatus, setIStatus] = useState('open')
  const [showIForm, setShowIForm] = useState(false)

  // CR form
  const [crTitle, setCrTitle] = useState('')
  const [crDesc,  setCrDesc]  = useState('')
  const [crJust,  setCrJust]  = useState('')
  const [crCost,  setCrCost]  = useState('')
  const [crDays,  setCrDays]  = useState('')
  const [crScope, setCrScope] = useState('')
  const [showCrForm, setShowCrForm] = useState(false)

  // CR reject
  const [rejectId,      setRejectId]      = useState<string | null>(null)
  const [rejectReason,  setRejectReason]  = useState('')

  async function load() {
    if (!projectId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [rR, rI, rC] = await Promise.all([
      sb.from('project_risks').select('*').eq('project_id', projectId).order('score', { ascending: false }),
      sb.from('project_issues').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      sb.from('change_requests').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    if (!rR.error) setRisks(rR.data ?? [])
    if (!rI.error) setIssues(rI.data ?? [])
    if (!rC.error) setCrs(rC.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function addRisk() {
    if (!rTitle.trim() || !projectId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('project_risks').insert({
      organization_id: profile?.organization_id,
      project_id: projectId, title: rTitle, probability: rProb,
      impact: rImp, category: rCat, mitigation_plan: rMit || undefined,
      status: rStatus, created_by: userId,
    })
    if (error) { setErro(err(error)); return }
    setRTitle(''); setRMit(''); setShowRForm(false); void load()
  }

  async function addIssue() {
    if (!iTitle.trim() || !projectId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('project_issues').insert({
      organization_id: profile?.organization_id,
      project_id: projectId, title: iTitle, priority: iPrio,
      impact: iImpact || undefined, status: iStatus, created_by: userId,
    })
    if (error) { setErro(err(error)); return }
    setITitle(''); setIImpact(''); setShowIForm(false); void load()
  }

  async function addCR() {
    if (!crTitle.trim() || !projectId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('change_requests').insert({
      organization_id: profile?.organization_id,
      project_id: projectId, title: crTitle,
      description: crDesc || undefined, justification: crJust || undefined,
      additional_cost: parseFloat(crCost) || 0,
      schedule_impact_days: parseInt(crDays) || 0,
      scope_impact: crScope || undefined,
      requested_by: userId, status: 'submitted',
    })
    if (error) { setErro(err(error)); return }
    setCrTitle(''); setCrDesc(''); setCrJust(''); setCrCost(''); setCrDays(''); setCrScope('')
    setShowCrForm(false); void load()
  }

  async function approveCR(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('change_requests')
      .update({ status:'approved', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setErro(err(error)); else void load()
  }

  async function rejectCR(id: string) {
    if (!rejectReason.trim()) { setErro('Informe o motivo.'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('change_requests')
      .update({ status:'rejected', rejection_reason: rejectReason })
      .eq('id', id)
    if (error) setErro(err(error))
    else { setRejectId(null); setRejectReason(''); void load() }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <button className="btn-ghost" style={{ fontSize:'0.8125rem', padding:'0.25rem 0' }}
            onClick={() => navigate(`/projeto/${projectId}`)}>← Kanban</button>
          <h1>Governança</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid var(--border)', marginBottom:'1.5rem' }}>
        {([['risks','⚠️ Riscos',risks.length],['issues','🔴 Issues',issues.filter(i=>i.status==='open'||i.status==='in_progress').length],['cr','📋 Change Requests',crs.length]] as const).map(([id,label,cnt]) => (
          <button key={id} className="btn-ghost"
            style={{
              borderRadius:0, borderBottom: tab===id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab===id ? 'var(--accent)' : 'var(--subtle)',
              fontWeight: tab===id ? 700 : 500, padding:'0.625rem 1rem',
            }}
            onClick={() => setTab(id as Tab)}>
            {label} <span className="badge" style={{ marginLeft:'0.25rem' }}>{cnt}</span>
          </button>
        ))}
      </div>

      {erro && <p className="erro" style={{ marginBottom:'0.75rem' }}>{erro}</p>}
      {loading && <p className="sutil">Carregando…</p>}

      {/* RISKS */}
      {tab === 'risks' && (
        <Section title="Riscos do projeto" onAdd={() => setShowRForm(v => !v)}>
          {showRForm && canEdit && (
            <div className="fin-form" style={{ marginBottom:'1rem' }}>
              <div className="modal-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Título *</label>
                  <input value={rTitle} onChange={e=>setRTitle(e.target.value)} placeholder="Ex: Atraso na aprovação do cliente" />
                </div>
                <div><label>Categoria</label>
                  <select value={rCat} onChange={e=>setRCat(e.target.value)}>
                    {Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label>Probabilidade</label>
                  <select value={rProb} onChange={e=>setRProb(e.target.value)}>
                    {['low','medium','high','critical'].map(v=><option key={v} value={v}>{PROB_LABEL[v]}</option>)}
                  </select>
                </div>
                <div><label>Impacto</label>
                  <select value={rImp} onChange={e=>setRImp(e.target.value)}>
                    {['low','medium','high','critical'].map(v=><option key={v} value={v}>{IMPACT_LABEL[v]}</option>)}
                  </select>
                </div>
                <div><label>Status</label>
                  <select value={rStatus} onChange={e=>setRStatus(e.target.value)}>
                    {Object.entries(RISK_STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Plano de mitigação</label>
                  <textarea rows={2} value={rMit} onChange={e=>setRMit(e.target.value)} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                <button onClick={addRisk} disabled={!rTitle.trim()}>Salvar risco</button>
                <button className="btn-outline" onClick={()=>setShowRForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <table className="tabela">
            <thead><tr><th>Score</th><th>Título</th><th>Categoria</th><th>Prob.</th><th>Impacto</th><th>Status</th></tr></thead>
            <tbody>
              {risks.map(r => (
                <tr key={r.id}>
                  <td><span className="badge" style={{ background: SCORE_COLOR(r.score ?? 0)+'22', color: SCORE_COLOR(r.score ?? 0), borderColor: SCORE_COLOR(r.score ?? 0)+'44', fontWeight:800 }}>{r.score}</span></td>
                  <td><strong>{r.title}</strong>{r.mitigation_plan && <p className="sutil" style={{marginTop:'0.1rem'}}>{r.mitigation_plan}</p>}</td>
                  <td>{CAT_LABEL[r.category ?? ''] ?? '—'}</td>
                  <td>{PROB_LABEL[r.probability]}</td>
                  <td>{IMPACT_LABEL[r.impact]}</td>
                  <td><span className="badge">{RISK_STATUS[r.status]}</span></td>
                </tr>
              ))}
              {risks.length===0 && <tr><td colSpan={6} className="sutil" style={{textAlign:'center',padding:'1.5rem'}}>Nenhum risco registrado.</td></tr>}
            </tbody>
          </table>
        </Section>
      )}

      {/* ISSUES */}
      {tab === 'issues' && (
        <Section title="Issues" onAdd={() => setShowIForm(v=>!v)}>
          {showIForm && (
            <div className="fin-form" style={{ marginBottom:'1rem' }}>
              <div className="modal-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Título *</label>
                  <input value={iTitle} onChange={e=>setITitle(e.target.value)} />
                </div>
                <div><label>Prioridade</label>
                  <select value={iPrio} onChange={e=>setIPrio(e.target.value)}>
                    {['low','medium','high','critical'].map(v=><option key={v} value={v}>{PROB_LABEL[v]}</option>)}
                  </select>
                </div>
                <div><label>Status</label>
                  <select value={iStatus} onChange={e=>setIStatus(e.target.value)}>
                    {Object.entries(ISSUE_STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Impacto</label>
                  <input value={iImpact} onChange={e=>setIImpact(e.target.value)} placeholder="Descreva o impacto…" />
                </div>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                <button onClick={addIssue} disabled={!iTitle.trim()}>Salvar issue</button>
                <button className="btn-outline" onClick={()=>setShowIForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <table className="tabela">
            <thead><tr><th>Prioridade</th><th>Título</th><th>Impacto</th><th>Status</th><th>Criado</th></tr></thead>
            <tbody>
              {issues.map(i => (
                <tr key={i.id}>
                  <td><span className="badge">{PROB_LABEL[i.priority]}</span></td>
                  <td><strong>{i.title}</strong></td>
                  <td>{i.impact ?? '—'}</td>
                  <td><span className="badge">{ISSUE_STATUS[i.status]}</span></td>
                  <td className="sutil">{new Date(i.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {issues.length===0 && <tr><td colSpan={5} className="sutil" style={{textAlign:'center',padding:'1.5rem'}}>Nenhuma issue registrada.</td></tr>}
            </tbody>
          </table>
        </Section>
      )}

      {/* CHANGE REQUESTS */}
      {tab === 'cr' && (
        <Section title="Change Requests" onAdd={() => setShowCrForm(v=>!v)}>
          {showCrForm && (
            <div className="fin-form" style={{ marginBottom:'1rem' }}>
              <label>Título *</label>
              <input value={crTitle} onChange={e=>setCrTitle(e.target.value)} placeholder="Ex: Inclusão módulo HR" />
              <div className="modal-grid">
                <div><label>Custo adicional (R$)</label>
                  <input type="number" value={crCost} onChange={e=>setCrCost(e.target.value)} placeholder="0" /></div>
                <div><label>Impacto em dias</label>
                  <input type="number" value={crDays} onChange={e=>setCrDays(e.target.value)} placeholder="0" /></div>
                <div style={{gridColumn:'1/-1'}}><label>Descrição</label>
                  <textarea rows={2} value={crDesc} onChange={e=>setCrDesc(e.target.value)} /></div>
                <div style={{gridColumn:'1/-1'}}><label>Justificativa</label>
                  <textarea rows={2} value={crJust} onChange={e=>setCrJust(e.target.value)} /></div>
                <div style={{gridColumn:'1/-1'}}><label>Impacto no escopo</label>
                  <input value={crScope} onChange={e=>setCrScope(e.target.value)} /></div>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                <button onClick={addCR} disabled={!crTitle.trim()}>Submeter CR</button>
                <button className="btn-outline" onClick={()=>setShowCrForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <table className="tabela">
            <thead><tr><th>#</th><th>Título</th><th>Custo</th><th>Dias</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {crs.map(c => (
                <>
                  <tr key={c.id}>
                    <td className="sutil">{c.number}</td>
                    <td>
                      <strong>{c.title}</strong>
                      {c.rejection_reason && <p className="overdue-label" style={{fontSize:'0.75rem',marginTop:'0.1rem'}}>Motivo: {c.rejection_reason}</p>}
                    </td>
                    <td>{brl(c.additional_cost)}</td>
                    <td>{c.schedule_impact_days > 0 ? `+${c.schedule_impact_days}d` : '—'}</td>
                    <td><span className={`badge${c.status==='approved'?' badge--approved':c.status==='rejected'?' badge--rejected':''}`}>{CR_STATUS[c.status]}</span></td>
                    <td>
                      {c.status === 'submitted' && canApprove && (
                        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                          <button className="btn-sm btn-sm--ok" onClick={()=>approveCR(c.id)}>✓ Aprovar</button>
                          <button className="btn-sm btn-sm--danger" onClick={()=>setRejectId(rejectId===c.id?null:c.id)}>✗ Rejeitar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rejectId === c.id && (
                    <tr key={c.id+'-reject'}>
                      <td colSpan={6} style={{ background:'var(--danger-light)', padding:'0.75rem 1rem' }}>
                        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                          <input placeholder="Motivo da rejeição" value={rejectReason}
                            onChange={e=>setRejectReason(e.target.value)}
                            style={{ flex:1 }} />
                          <button className="btn-sm btn-sm--danger"
                            disabled={!rejectReason.trim()}
                            onClick={()=>rejectCR(c.id)}>Confirmar rejeição</button>
                          <button className="btn-ghost" onClick={()=>setRejectId(null)}>×</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {crs.length===0 && <tr><td colSpan={6} className="sutil" style={{textAlign:'center',padding:'1.5rem'}}>Nenhum change request.</td></tr>}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}
