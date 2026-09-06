import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getBudget, upsertBudget, approveBudget,
  getCosts, createCost, deleteCost,
  getForecasts, createForecast,
  getProjectFinancial,
} from '../lib/financial'
import { getProject } from '../lib/api'
import type { FinancialRow, ProjectBudget, ProjectCost, ProjectForecast } from '../lib/financial'
import type { Project } from '../types/app.types'

type Props = { role: string; userId: string }

const STATUS_CFG = {
  ok:           { label: 'Dentro do orçamento', icon: '🟢', cls: 'fin--ok'       },
  atencao:      { label: 'Atenção',             icon: '🟡', cls: 'fin--atencao'  },
  estourado:    { label: 'Estourado',           icon: '🔴', cls: 'fin--danger'   },
  sem_orcamento:{ label: 'Sem orçamento',       icon: '⚪', cls: 'fin--none'     },
}

const CATEGORY_LABEL: Record<string, string> = {
  labor:'Mão de obra', travel:'Viagem', software:'Software',
  hardware:'Hardware', training:'Treinamento', consulting:'Consultoria', other:'Outro',
}

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v}%`
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

export default function BudgetPage({ role, userId }: Props) {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project,  setProject]  = useState<Project | null>(null)
  const [fin,      setFin]      = useState<FinancialRow | null>(null)
  const [budget,   setBudget]   = useState<ProjectBudget | null>(null)
  const [costs,    setCosts]    = useState<ProjectCost[]>([])
  const [forecasts,setForecasts]= useState<ProjectForecast[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)

  // budget form
  const [budgetTotal,    setBudgetTotal]    = useState('')
  const [revenuePlanned, setRevenuePlanned] = useState('')
  const [costPlanned,    setCostPlanned]    = useState('')
  const [savingBudget,   setSavingBudget]   = useState(false)

  // cost form
  const [costCategory, setCostCategory] = useState('other')
  const [costDesc,     setCostDesc]     = useState('')
  const [costAmount,   setCostAmount]   = useState('')
  const [costDate,     setCostDate]     = useState(new Date().toISOString().slice(0,10))
  const [savingCost,   setSavingCost]   = useState(false)

  // forecast form
  const [fcCost,    setFcCost]    = useState('')
  const [fcRevenue, setFcRevenue] = useState('')
  const [fcNotes,   setFcNotes]   = useState('')
  const [savingFc,  setSavingFc]  = useState(false)

  const canEdit   = role === 'admin' || role === 'manager'
  const canApprove= role === 'admin'

  async function load() {
    if (!projectId) return
    setLoading(true)
    const [rPrj, rFin, rBudget, rCosts, rFc] = await Promise.all([
      getProject(projectId),
      getProjectFinancial(projectId),
      getBudget(projectId),
      getCosts(projectId),
      getForecasts(projectId),
    ])
    if (!rPrj.error) setProject(rPrj.data)
    if (!rFin.error) setFin(rFin.data)
    if (!rBudget.error) {
      setBudget(rBudget.data)
      if (rBudget.data) {
        setBudgetTotal(String(rBudget.data.budget_total))
        setRevenuePlanned(String(rBudget.data.revenue_planned ?? ''))
        setCostPlanned(String(rBudget.data.cost_planned ?? ''))
      }
    }
    if (!rCosts.error) setCosts(rCosts.data ?? [])
    if (!rFc.error) setForecasts(rFc.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function handleSaveBudget() {
    if (!projectId) return
    setSavingBudget(true); setErro(null)
    const { error } = await upsertBudget({
      project_id:      projectId,
      budget_total:    parseFloat(budgetTotal) || 0,
      revenue_planned: parseFloat(revenuePlanned) || 0,
      cost_planned:    parseFloat(costPlanned) || 0,
      created_by:      userId,
    })
    setSavingBudget(false)
    if (error) setErro(extractError(error))
    else void load()
  }

  async function handleApproveBudget() {
    if (!budget) return
    const { error } = await approveBudget(budget.id, userId)
    if (error) setErro(extractError(error))
    else void load()
  }

  async function handleAddCost() {
    if (!projectId || !costDesc || !costAmount) return
    setSavingCost(true); setErro(null)
    const { error } = await createCost({
      project_id:  projectId,
      category:    costCategory,
      description: costDesc,
      amount:      parseFloat(costAmount),
      cost_date:   costDate,
      created_by:  userId,
    })
    setSavingCost(false)
    if (error) setErro(extractError(error))
    else { setCostDesc(''); setCostAmount(''); void load() }
  }

  async function handleDeleteCost(id: string) {
    const { error } = await deleteCost(id)
    if (error) setErro(extractError(error))
    else void load()
  }

  async function handleAddForecast() {
    if (!projectId || !fcCost) return
    setSavingFc(true); setErro(null)
    const { error } = await createForecast({
      project_id:       projectId,
      cost_forecast:    parseFloat(fcCost),
      revenue_forecast: parseFloat(fcRevenue) || 0,
      notes:            fcNotes || undefined,
      created_by:       userId,
    })
    setSavingFc(false)
    if (error) setErro(extractError(error))
    else { setFcCost(''); setFcRevenue(''); setFcNotes(''); void load() }
  }

  if (loading) return <div className="pagina"><p className="sutil">Carregando…</p></div>

  const cfg = STATUS_CFG[fin?.financial_status ?? 'sem_orcamento']

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <button className="link" onClick={() => navigate(`/projeto/${projectId}`)}>← Kanban</button>
          <h1>Financeiro — {project?.name}</h1>
          <p className="sutil">{project?.code} · {cfg.icon} {cfg.label}</p>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}

      {/* KPIs */}
      {fin && (
        <div className="fin-kpis">
          {[
            { label: 'Budget',          val: brl(fin.budget_total) },
            { label: 'Custo realizado', val: brl(fin.cost_actual_total) },
            { label: 'Forecast',        val: brl(fin.cost_forecast) },
            { label: 'Variance',        val: pct(fin.variance_pct),
              cls: fin.variance >= 0 ? 'kpi--ok' : 'kpi--danger' },
            { label: 'Margem',          val: pct(fin.margin_pct),
              cls: (fin.margin_pct ?? 0) >= 0 ? 'kpi--ok' : 'kpi--danger' },
          ].map(k => (
            <div key={k.label} className={`kpi-card ${k.cls ?? ''}`}>
              <span className="kpi-card__label">{k.label}</span>
              <span className="kpi-card__val">{k.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Barra budget vs realizado */}
      {fin && fin.budget_total > 0 && (
        <div className="fin-bar-wrap">
          <div className="fin-bar">
            <div
              className={`fin-bar__fill fin-bar__fill--${fin.financial_status}`}
              style={{ width: `${Math.min(fin.cost_actual_total / fin.budget_total * 100, 100)}%` }}
            />
          </div>
          <span className="sutil">
            {brl(fin.cost_actual_total)} de {brl(fin.budget_total)}
          </span>
        </div>
      )}

      <div className="fin-cols">
        {/* Coluna orçamento */}
        <section className="fin-section">
          <h2 className="section-title">Orçamento</h2>
          {canEdit && (
            <div className="fin-form">
              <label>Budget total (R$)</label>
              <input type="number" value={budgetTotal} onChange={e => setBudgetTotal(e.target.value)} placeholder="500000" />
              <label>Receita prevista (R$)</label>
              <input type="number" value={revenuePlanned} onChange={e => setRevenuePlanned(e.target.value)} placeholder="600000" />
              <label>Custo planejado (R$)</label>
              <input type="number" value={costPlanned} onChange={e => setCostPlanned(e.target.value)} placeholder="400000" />
              <div className="fin-form__actions">
                <button onClick={handleSaveBudget} disabled={savingBudget}>
                  {savingBudget ? 'Salvando…' : 'Salvar orçamento'}
                </button>
                {budget && !budget.approved_at && canApprove && (
                  <button className="btn-sm btn-sm--ok" onClick={handleApproveBudget}>
                    ✓ Aprovar
                  </button>
                )}
                {budget?.approved_at && (
                  <span className="badge badge--approved">
                    Aprovado {new Date(budget.approved_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Coluna forecast */}
        <section className="fin-section">
          <h2 className="section-title">Forecast</h2>
          {canEdit && (
            <div className="fin-form">
              <label>Custo forecast (R$)</label>
              <input type="number" value={fcCost} onChange={e => setFcCost(e.target.value)} placeholder="420000" />
              <label>Receita forecast (R$)</label>
              <input type="number" value={fcRevenue} onChange={e => setFcRevenue(e.target.value)} placeholder="590000" />
              <label>Observações</label>
              <input value={fcNotes} onChange={e => setFcNotes(e.target.value)} placeholder="Revisão semana X" />
              <button onClick={handleAddForecast} disabled={savingFc || !fcCost}>
                {savingFc ? 'Salvando…' : 'Registrar forecast'}
              </button>
            </div>
          )}
          <table className="tabela" style={{ marginTop: '0.75rem' }}>
            <thead><tr><th>Data</th><th>Custo</th><th>Receita</th><th>Nota</th></tr></thead>
            <tbody>
              {forecasts.map(f => (
                <tr key={f.id}>
                  <td>{new Date(f.forecast_date).toLocaleDateString('pt-BR')}</td>
                  <td>{brl(f.cost_forecast)}</td>
                  <td>{brl(f.revenue_forecast)}</td>
                  <td>{f.notes ?? '—'}</td>
                </tr>
              ))}
              {forecasts.length === 0 && <tr><td colSpan={4} className="sutil">Sem forecasts.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      {/* Custos manuais */}
      <section>
        <h2 className="section-title">Custos manuais</h2>
        {canEdit && (
          <div className="ts-form">
            <div className="ts-form__grid" style={{ gridTemplateColumns: '160px 1fr 130px 130px' }}>
              <div>
                <label>Categoria</label>
                <select value={costCategory} onChange={e => setCostCategory(e.target.value)}>
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Descrição</label>
                <input value={costDesc} onChange={e => setCostDesc(e.target.value)} placeholder="Ex: Licença SAP" />
              </div>
              <div>
                <label>Valor (R$)</label>
                <input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="15000" />
              </div>
              <div>
                <label>Data</label>
                <input type="date" value={costDate} onChange={e => setCostDate(e.target.value)} />
              </div>
            </div>
            <button onClick={handleAddCost} disabled={savingCost || !costDesc || !costAmount}>
              {savingCost ? 'Salvando…' : 'Adicionar custo'}
            </button>
          </div>
        )}
        <table className="tabela">
          <thead>
            <tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th>{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {costs.map(c => (
              <tr key={c.id}>
                <td>{new Date(c.cost_date).toLocaleDateString('pt-BR')}</td>
                <td>{CATEGORY_LABEL[c.category] ?? c.category}</td>
                <td>{c.description}</td>
                <td><strong>{brl(c.amount)}</strong></td>
                {canEdit && (
                  <td>
                    <button className="btn-sm btn-sm--danger"
                      onClick={() => handleDeleteCost(c.id)}>
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {costs.length === 0 && (
              <tr><td colSpan={5} className="sutil">Sem custos manuais.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
