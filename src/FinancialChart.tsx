import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type MonthData = {
  year_month: string
  planned: number
  actual: number
}

type Props = { projectId: string }

const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function brl(v: number) {
  if (v >= 1_000_000) return `R$${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$${(v/1_000).toFixed(0)}K`
  return `R$${v.toLocaleString('pt-BR')}`
}

export default function FinancialChart({ projectId }: Props) {
  const [data,    setData]    = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm,setShowForm]= useState(false)
  const [fMonth,  setFMonth]  = useState(new Date().toISOString().slice(0,7))
  const [fPlanned,setFPlanned]= useState('')
  const [saving,  setSaving]  = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [rPlan, rActual] = await Promise.all([
      sb.from('project_monthly_budgets').select('year_month,planned_cost').eq('project_id', projectId).order('year_month'),
      sb.from('project_monthly_costs').select('year_month,actual_cost').eq('project_id', projectId).order('year_month'),
    ])
    const planned: Record<string,number> = {}
    const actual:  Record<string,number> = {}
    ;(rPlan.data ?? []).forEach((r: any) => { planned[r.year_month] = r.planned_cost })
    ;(rActual.data ?? []).forEach((r: any) => { actual[r.year_month] = r.actual_cost })
    const months = [...new Set([...Object.keys(planned), ...Object.keys(actual)])].sort()
    setData(months.map(m => ({ year_month: m, planned: planned[m] ?? 0, actual: actual[m] ?? 0 })))
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function savePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!fMonth || !fPlanned) return
    setSaving(true)
    await sb.from('project_monthly_budgets').upsert(
      { project_id: projectId, year_month: fMonth, planned_cost: parseFloat(fPlanned) },
      { onConflict: 'project_id,year_month' }
    )
    setFPlanned(''); setShowForm(false); void load()
    setSaving(false)
  }

  if (loading) return <div style={{ height:200 }} className="skeleton" />

  if (data.length === 0 && !showForm) return (
    <div style={{ textAlign:'center', padding:'2rem', color:'var(--subtle)' }}>
      <p style={{ marginBottom:'1rem' }}>Nenhum dado financeiro mensal. Adicione o custo planejado por mês.</p>
      <button className="btn-sm" onClick={() => setShowForm(true)}>+ Planejamento mensal</button>
    </div>
  )

  const maxVal = Math.max(1, ...data.map(d => Math.max(d.planned, d.actual)))
  const BAR_H  = 160

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem' }}>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {[{color:'#0A6ED1',label:'Planejado'},{color:'#16A34A',label:'Realizado'}].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'.375rem', fontSize:'.8125rem' }}>
              <div style={{ width:14, height:14, borderRadius:3, background:l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <button className="btn-sm btn-secondary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕' : '+ Planejar mês'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={savePlan} style={{ display:'flex', gap:'.75rem', alignItems:'flex-end', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'.875rem', marginBottom:'1rem', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:120 }}>
            <label>Mês</label>
            <input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} required />
          </div>
          <div style={{ flex:1, minWidth:140 }}>
            <label>Custo planejado (R$)</label>
            <input type="number" value={fPlanned} onChange={e => setFPlanned(e.target.value)} min={0} step={100} required placeholder="0" />
          </div>
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? '…' : '✓ Salvar'}</button>
          </div>
        </form>
      )}

      {/* Bar chart */}
      {data.length > 0 && (
        <div style={{ overflow:'auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'.5rem', minWidth: Math.max(400, data.length * 72), paddingBottom:'.5rem' }}>
            {data.map(d => {
              const pctP = (d.planned / maxVal) * BAR_H
              const pctA = (d.actual  / maxVal) * BAR_H
              const [yr, mo] = d.year_month.split('-')
              const label = `${MONTH_PT[parseInt(mo)-1]}/${yr.slice(2)}`
              const over  = d.actual > d.planned && d.planned > 0
              return (
                <div key={d.year_month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'.375rem', minWidth:56 }}>
                  {/* Values on hover-like tooltip */}
                  <div style={{ fontSize:'.5rem', color:'var(--subtle)', textAlign:'center', lineHeight:1.4, whiteSpace:'nowrap' }}>
                    {d.planned > 0 && <div style={{ color:'#0A6ED1' }}>{brl(d.planned)}</div>}
                    {d.actual  > 0 && <div style={{ color: over ? '#DC2626' : '#16A34A' }}>{brl(d.actual)}</div>}
                  </div>
                  {/* Bars */}
                  <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:BAR_H }}>
                    <div style={{ width:18, background:'#0A6ED1', borderRadius:'3px 3px 0 0', height:Math.max(pctP, d.planned > 0 ? 3 : 0), opacity:.8 }} title={`Planejado: ${brl(d.planned)}`} />
                    <div style={{ width:18, background: over ? '#DC2626' : '#16A34A', borderRadius:'3px 3px 0 0', height:Math.max(pctA, d.actual > 0 ? 3 : 0), opacity:.85 }} title={`Realizado: ${brl(d.actual)}`} />
                  </div>
                  <span style={{ fontSize:'.625rem', color:'var(--subtle)', fontWeight:600 }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.75rem', marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
        {[
          { label:'Total planejado',  val: data.reduce((s,d)=>s+d.planned,0), color:'#0A6ED1' },
          { label:'Total realizado',  val: data.reduce((s,d)=>s+d.actual,0),  color: data.reduce((s,d)=>s+d.actual,0) > data.reduce((s,d)=>s+d.planned,0) ? '#DC2626' : '#16A34A' },
          { label:'Variância',        val: data.reduce((s,d)=>s+d.planned-d.actual,0), color: data.reduce((s,d)=>s+d.planned-d.actual,0) >= 0 ? '#16A34A' : '#DC2626' },
        ].map(k => (
          <div key={k.label} style={{ textAlign:'center' }}>
            <div style={{ fontSize:'.6875rem', color:'var(--subtle)', marginBottom:'.25rem' }}>{k.label}</div>
            <div style={{ fontSize:'1.125rem', fontWeight:800, color:k.color }}>{brl(k.val)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
