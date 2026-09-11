import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { parseScheduleExcel } from '../lib/scheduleImport'

type Milestone = {
  id: string; name: string; description: string | null
  due_date: string; status: string; criticality: string | null
}
type Task = {
  id: string; title: string; status: string; priority: string
  start_date: string | null; due_date: string | null
  sap_activate_phase: string | null; estimated_hours: number | null
  progress: number; frente: string | null
}

const CRIT_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }
const CRIT_COLOR: Record<string, string> = { baixa: '#94A3B8', media: '#F59E0B', alta: '#EF4444', critica: '#7C3AED' }

// % Planejado: com base no tempo já decorrido entre início e fim planejados.
function plannedPct(task: Task, today: Date): number | null {
  if (!task.start_date || !task.due_date) return null
  const start = new Date(task.start_date).getTime()
  const end = new Date(task.due_date).getTime()
  if (end <= start) return today.getTime() >= end ? 100 : 0
  const now = today.getTime()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

// SPI (Schedule Performance Index) — % realizado / % planejado, como no EVM.
function spiOf(task: Task, planned: number | null): number | null {
  if (planned == null || planned === 0) return null
  return Math.round((task.progress / planned) * 100) / 100
}
function spiColor(spi: number | null): string {
  if (spi == null) return 'var(--subtle)'
  if (spi >= 1) return 'var(--ok)'
  if (spi >= 0.8) return 'var(--warn)'
  return 'var(--danger)'
}

const SAP_COLOR: Record<string,string> = {
  Descobrir:'#8B5CF6',Preparar:'#3B82F6',Explorar:'#06B6D4',
  Realizar:'#10B981',Implementar:'#F59E0B',Executar:'#EF4444',
}
const TASK_COLOR: Record<string,string> = {
  todo:'#94A3B8',in_progress:'#0A6ED1',blocked:'#DC2626',
  validation:'#F59E0B',adjustment_required:'#F97316',completed:'#16A34A',cancelled:'#6B7280',
}
const MIL_STATUS: Record<string,string> = {
  not_started:'Não iniciado',in_progress:'Em andamento',completed:'Concluído',cancelled:'Cancelado',
}

type Props = { projectId?: string; role: string }

export default function SchedulePage({ projectId: propId, role }: Props) {
  const params    = useParams<{ id: string }>()
  const projectId = propId ?? params.id
  const { profile } = useAuth()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<'gantt'|'list'>('gantt')
  const [filterPhase,setFilterPhase]= useState('')
  const [showMilForm,setShowMilForm]= useState(false)
  const [milName,    setMilName]    = useState('')
  const [milDate,    setMilDate]    = useState('')
  const [milDesc,    setMilDesc]    = useState('')
  const [milCrit,    setMilCrit]    = useState('media')
  const [savingMil,  setSavingMil]  = useState(false)
  const [importing,  setImporting]  = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canEdit = ['admin','manager'].includes(role)

  async function load() {
    if (!projectId) return
    setLoading(true)
    const [rM, rT] = await Promise.all([
      sb.from('milestones').select('*').eq('project_id', projectId).order('due_date'),
      sb.from('tasks')
        .select('id,title,status,priority,start_date,due_date,sap_activate_phase,estimated_hours,progress,frente')
        .eq('project_id', projectId).order('due_date', { ascending: true }),
    ])
    if (!rM.error) setMilestones(rM.data ?? [])
    if (!rT.error) setTasks(rT.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function saveMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!milName.trim() || !milDate) return
    setSavingMil(true)
    const { error } = await sb.from('milestones').insert({
      organization_id: profile?.organization_id,
      project_id: projectId, name: milName.trim(),
      description: milDesc.trim() || null, due_date: milDate, status: 'not_started',
      criticality: milCrit,
    })
    if (error) { toast(error.message, 'error') }
    else { toast('Marco criado!', 'ok'); setMilName(''); setMilDate(''); setMilDesc(''); setMilCrit('media'); setShowMilForm(false); void load() }
    setSavingMil(false)
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !projectId) return

    setImporting(true)
    try {
      const { rows, errors } = await parseScheduleExcel(file)
      if (rows.length === 0) {
        toast(errors[0] ?? 'Nenhuma linha reconhecida na planilha.', 'error')
        return
      }

      // Resolve e-mail -> profile.id (quando a coluna Responsável veio preenchida)
      const emails = [...new Set(rows.map(r => r.assignee_email).filter(Boolean))] as string[]
      let emailToId: Record<string, string> = {}
      if (emails.length > 0) {
        const { data: profs } = await sb.from('profiles').select('id,email').in('email', emails)
        emailToId = Object.fromEntries((profs ?? []).map((p: { id: string; email: string }) => [p.email.toLowerCase(), p.id]))
      }

      const payload = rows.map(r => ({
        organization_id: profile?.organization_id,
        project_id: projectId,
        title: r.title,
        frente: r.frente,
        sap_activate_phase: r.sap_activate_phase,
        priority: r.priority,
        planned_start_date: r.planned_start_date,
        planned_end_date: r.planned_end_date,
        estimated_hours: r.estimated_hours,
        progress: r.progress,
        status: r.progress >= 100 ? 'completed' : 'todo',
        assignee_id: r.assignee_email ? (emailToId[r.assignee_email] ?? null) : null,
      }))

      const { error } = await sb.from('tasks').insert(payload)
      if (error) throw error

      const notFound = emails.filter(e2 => !emailToId[e2])
      toast(
        `${payload.length} tarefa(s) importada(s) do Excel.` +
        (notFound.length ? ` ${notFound.length} responsável(is) não encontrado(s) por e-mail.` : ''),
        'ok'
      )
      void load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao importar a planilha.', 'error')
    } finally {
      setImporting(false)
    }
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Excluir este marco?')) return
    await sb.from('milestones').delete().eq('id', id)
    toast('Marco removido.', 'warn'); void load()
  }

  const phases   = [...new Set(tasks.map(t => t.sap_activate_phase).filter(Boolean))] as string[]
  const filtered = tasks.filter(t => !filterPhase || t.sap_activate_phase === filterPhase)
  const today    = new Date()

  const allDates = [
    ...filtered.filter(t=>t.start_date).map(t=>new Date(t.start_date!)),
    ...filtered.filter(t=>t.due_date).map(t=>new Date(t.due_date!)),
    ...milestones.map(m=>new Date(m.due_date)),
  ]
  const minDate   = allDates.length>0 ? new Date(Math.min(...allDates.map(d=>d.getTime()))) : today
  const maxDate   = allDates.length>0 ? new Date(Math.max(...allDates.map(d=>d.getTime()))) : new Date(Date.now()+60*86400000)
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime()-minDate.getTime())/86400000))+14
  const pct = (d: Date) => Math.min(100,Math.max(0,((d.getTime()-minDate.getTime())/86400000/totalDays)*100))
  const todayPct  = pct(today)
  const NAME_W    = 220

  const months: {label:string;left:number;width:number}[] = []
  let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cur <= maxDate) {
    const next = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
    months.push({ label: cur.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), left: pct(cur), width: pct(next)-pct(cur) })
    cur = next
  }

  const SAP_PHASES = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar']

  return (
    <div>
      <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', alignItems:'center', marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', gap:'.25rem', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'.2rem' }}>
          {(['gantt','list'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)} style={{ background:view===v?'var(--surface)':'', border:'none', borderRadius:'var(--r-sm)', padding:'.3rem .75rem', fontSize:'.8125rem', fontWeight:view===v?600:400, color:view===v?'var(--text)':'', boxShadow:view===v?'var(--shadow-xs)':'' }}>
              {v==='gantt'?'📊 Gantt':'☰ Lista'}
            </button>
          ))}
        </div>
        <select value={filterPhase} onChange={e=>setFilterPhase(e.target.value)} style={{ width:'auto', fontSize:'.8125rem' }}>
          <option value="">Todas as fases</option>
          {phases.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {filterPhase && <button className="btn-ghost btn-sm" onClick={()=>setFilterPhase('')}>Limpar</button>}
        {canEdit && (
          <div style={{ marginLeft:'auto', display:'flex', gap:'.5rem' }}>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleImportExcel} />
            <button className="btn-secondary btn-sm" disabled={importing} onClick={() => importInputRef.current?.click()}>
              {importing ? 'Importando…' : '📤 Importar Excel'}
            </button>
            <button className="btn-sm" onClick={()=>setShowMilForm(v=>!v)}>{showMilForm?'✕':'+ Marco'}</button>
          </div>
        )}
      </div>
      {canEdit && (
        <p className="sutil" style={{ fontSize:'.75rem', marginTop:'-.75rem', marginBottom:'1rem' }}>
          A planilha deve ter colunas como Título, Frente, Fase, Prioridade, Início, Fim, Horas Estimadas, Progresso e Responsável (e-mail) — os nomes são flexíveis quanto a acentos/maiúsculas.
        </p>
      )}

      {showMilForm && canEdit && (
        <form onSubmit={saveMilestone} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1rem', marginBottom:'1rem', display:'flex', gap:'.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:2, minWidth:160 }}>
            <label>Nome do marco *</label>
            <input value={milName} onChange={e=>setMilName(e.target.value)} required placeholder="Ex: Go-Live Fase 1" />
          </div>
          <div style={{ flex:1, minWidth:140 }}>
            <label>Data *</label>
            <input type="date" value={milDate} onChange={e=>setMilDate(e.target.value)} required />
          </div>
          <div style={{ flex:2, minWidth:160 }}>
            <label>Descrição</label>
            <input value={milDesc} onChange={e=>setMilDesc(e.target.value)} placeholder="Opcional" />
          </div>
          <div style={{ flex:1, minWidth:120 }}>
            <label>Criticidade</label>
            <select value={milCrit} onChange={e=>setMilCrit(e.target.value)}>
              {Object.entries(CRIT_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={()=>setShowMilForm(false)}>Cancelar</button>
            <button type="submit" disabled={savingMil}>{savingMil?'…':'✓ Criar'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
          {[1,2,3].map(i=><div key={i} style={{ height:40, borderRadius:'var(--r)' }} className="skeleton"/>)}
        </div>
      ) : filtered.length===0 && milestones.length===0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📅</div>
          <div className="empty-state__title">Sem dados de cronograma</div>
          <p className="empty-state__desc">Adicione tarefas com datas e use "+ Marco" para criar marcos.</p>
        </div>
      ) : view==='gantt' ? (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth:800 }}>
              <div style={{ display:'grid', gridTemplateColumns:`${NAME_W}px 1fr`, borderBottom:'1px solid var(--border)' }}>
                <div style={{ background:'var(--surface-2)', padding:'.4rem .875rem', fontSize:'.6875rem', fontWeight:700, color:'var(--subtle)' }}>ITEM</div>
                <div style={{ position:'relative', height:28, background:'var(--surface-2)' }}>
                  {months.map((m,i)=>(
                    <div key={i} style={{ position:'absolute', left:`${m.left}%`, width:`${m.width}%`, top:0, bottom:0, borderLeft:'1px solid var(--border)', padding:'0 .25rem', display:'flex', alignItems:'center', fontSize:'.5625rem', fontWeight:700, color:'var(--subtle)', textTransform:'uppercase', overflow:'hidden', whiteSpace:'nowrap' }}>
                      {m.label}
                    </div>
                  ))}
                  <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:2, background:'var(--danger)', opacity:.6 }}/>
                </div>
              </div>

              {milestones.map(m=>{
                const d = new Date(m.due_date); const p = pct(d)
                const over = d<today && m.status!=='completed'
                return (
                  <div key={m.id} style={{ display:'grid', gridTemplateColumns:`${NAME_W}px 1fr`, borderBottom:'1px solid var(--border)' }}>
                    <div style={{ padding:'.5rem .875rem', display:'flex', alignItems:'center', gap:'.375rem', background:'var(--surface)' }}>
                      <span>🔷</span>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'.25rem' }}>
                          <div style={{ fontWeight:700, fontSize:'.8125rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:over?'var(--danger)':'var(--text)' }}>{m.name}</div>
                          {m.criticality && (
                            <span className="badge" style={{ fontSize:'.5rem', padding:'.05rem .3rem', background:(CRIT_COLOR[m.criticality]??'#94A3B8')+'22', color:CRIT_COLOR[m.criticality]??'#94A3B8', flexShrink:0 }}>
                              {CRIT_LABEL[m.criticality]??m.criticality}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:'.5625rem', color:'var(--subtle)' }}>{d.toLocaleDateString('pt-BR')} · {MIL_STATUS[m.status]??m.status}</div>
                      </div>
                      {canEdit && <button className="btn-ghost btn-sm" onClick={()=>deleteMilestone(m.id)} style={{ marginLeft:'auto', fontSize:'.5625rem', padding:'.1rem .3rem', opacity:.5 }}>✕</button>}
                    </div>
                    <div style={{ position:'relative', height:40, background:'var(--surface)' }}>
                      <div style={{ position:'absolute', left:`${p}%`, top:'50%', transform:'translate(-50%,-50%)', width:12, height:12, background:over?'var(--danger)':m.status==='completed'?'var(--ok)':'var(--brand)', borderRadius:2, rotate:'45deg', border:'2px solid white', boxShadow:'var(--shadow-xs)' }}/>
                      <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--danger)', opacity:.2 }}/>
                    </div>
                  </div>
                )
              })}

              {SAP_PHASES.map(ph=>{
                const group = filtered.filter(t=>t.sap_activate_phase===ph)
                if (!group.length) return null
                return (
                  <div key={ph}>
                    <div style={{ display:'grid', gridTemplateColumns:`${NAME_W}px 1fr`, background:`${SAP_COLOR[ph]}18`, borderBottom:'1px solid var(--border)' }}>
                      <div style={{ padding:'.375rem .875rem', display:'flex', alignItems:'center', gap:'.375rem' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:SAP_COLOR[ph] }}/>
                        <span style={{ fontWeight:700, fontSize:'.75rem', color:SAP_COLOR[ph] }}>{ph}</span>
                        <span style={{ fontSize:'.625rem', color:'var(--subtle)' }}>({group.length})</span>
                      </div>
                      <div style={{ position:'relative' }}><div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--danger)', opacity:.2 }}/></div>
                    </div>
                    {group.map(task=>{
                      const s = task.start_date ? pct(new Date(task.start_date)) : null
                      const e = task.due_date   ? pct(new Date(task.due_date))   : null
                      const w = s!==null && e!==null ? Math.max(0.5,e-s) : null
                      const over = task.due_date && new Date(task.due_date)<today && task.status!=='completed'
                      return (
                        <div key={task.id} style={{ display:'grid', gridTemplateColumns:`${NAME_W}px 1fr`, borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
                          <div style={{ padding:'.4rem .875rem .4rem 1.375rem', display:'flex', alignItems:'center', gap:'.375rem' }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:TASK_COLOR[task.status]??'#94A3B8', flexShrink:0 }}/>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:'.8125rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:over?'var(--danger)':'var(--text)' }}>{task.title}</div>
                              <div style={{ fontSize:'.5625rem', color:'var(--subtle)', display:'flex', gap:'.25rem', alignItems:'center' }}>
                                {task.frente && <span style={{ fontWeight:700 }}>{task.frente}</span>}
                                {task.estimated_hours ? <span>{task.estimated_hours}h</span> : null}
                              </div>
                            </div>
                          </div>
                          <div style={{ position:'relative', height:40, background:'var(--surface)' }}>
                            {s!==null && w!==null && <div style={{ position:'absolute', left:`${s}%`, width:`${w}%`, top:'50%', transform:'translateY(-50%)', height:14, borderRadius:4, background:task.status==='completed'?'var(--ok)':over?'var(--danger)':SAP_COLOR[ph], opacity:.85, minWidth:4 }}><div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${task.progress}%`, background:'rgba(255,255,255,.3)', borderRadius:4 }}/></div>}
                            {s===null && e!==null && <div style={{ position:'absolute', left:`${e}%`, top:'50%', transform:'translate(-50%,-50%)', width:10, height:10, background:TASK_COLOR[task.status], borderRadius:2, rotate:'45deg' }}/>}
                            <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--danger)', opacity:.2 }}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {filtered.filter(t=>!t.sap_activate_phase).map(task=>{
                const s = task.start_date ? pct(new Date(task.start_date)) : null
                const e = task.due_date   ? pct(new Date(task.due_date))   : null
                const w = s!==null && e!==null ? Math.max(0.5,e-s) : null
                return (
                  <div key={task.id} style={{ display:'grid', gridTemplateColumns:`${NAME_W}px 1fr`, borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
                    <div style={{ padding:'.4rem .875rem', display:'flex', alignItems:'center', gap:'.375rem' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:TASK_COLOR[task.status]??'#94A3B8', flexShrink:0 }}/>
                      <div style={{ fontSize:'.8125rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</div>
                    </div>
                    <div style={{ position:'relative', height:40, background:'var(--surface)' }}>
                      {s!==null && w!==null && <div style={{ position:'absolute', left:`${s}%`, width:`${w}%`, top:'50%', transform:'translateY(-50%)', height:14, borderRadius:4, background:'#0A6ED1', opacity:.8, minWidth:4 }}/>}
                      <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--danger)', opacity:.2 }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ padding:'.625rem 1rem', borderTop:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', gap:'1rem', flexWrap:'wrap' }}>
            {[{c:'#16A34A',l:'Concluído'},{c:'#0A6ED1',l:'Em andamento'},{c:'var(--danger)',l:'Atrasado'},{c:'#94A3B8',l:'A fazer'}].map(x=>(
              <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'.375rem', fontSize:'.6875rem' }}>
                <div style={{ width:20, height:7, borderRadius:2, background:x.c }}/>{x.l}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:'.375rem', fontSize:'.6875rem', color:'var(--danger)' }}>
              <div style={{ width:2, height:12, background:'var(--danger)' }}/> Hoje
            </div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Tipo</th><th>Fase</th><th>Frente</th><th>Status</th><th>Início</th><th>Fim</th><th>% Real.</th><th>% Plan.</th><th>SPI</th></tr></thead>
            <tbody>
              {milestones.map(m=>(
                <tr key={m.id} style={{ background:'var(--surface-2)' }}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}><span>🔷</span><b>{m.name}</b></div></td>
                  <td><span className="badge">Marco</span></td><td>—</td>
                  <td>{m.criticality ? <span className="badge" style={{ background:(CRIT_COLOR[m.criticality]??'#94A3B8')+'22', color:CRIT_COLOR[m.criticality]??'#94A3B8' }}>{CRIT_LABEL[m.criticality]??m.criticality}</span> : '—'}</td>
                  <td><span className="badge">{MIL_STATUS[m.status]??m.status}</span></td><td>—</td>
                  <td style={{ color:new Date(m.due_date)<today?'var(--danger)':'var(--text)' }}>{new Date(m.due_date).toLocaleDateString('pt-BR')}</td><td>—</td><td>—</td><td>—</td>
                </tr>
              ))}
              {filtered.map(t=>{
                const planned = plannedPct(t, today)
                const spi = spiOf(t, planned)
                return (
                <tr key={t.id}>
                  <td style={{ fontSize:'.875rem' }}>{t.title}</td>
                  <td><span className="badge">Tarefa</span></td>
                  <td>{t.sap_activate_phase?<span className="badge" style={{ background:(SAP_COLOR[t.sap_activate_phase]??'#94A3B8')+'22', color:SAP_COLOR[t.sap_activate_phase]??'#94A3B8' }}>{t.sap_activate_phase}</span>:'—'}</td>
                  <td style={{ fontSize:'.8125rem' }}>{t.frente ?? '—'}</td>
                  <td><span className="badge" style={{ background:(TASK_COLOR[t.status]??'#94A3B8')+'22', color:TASK_COLOR[t.status]??'#94A3B8' }}>{t.status.replace(/_/g,' ')}</span></td>
                  <td style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{t.start_date?new Date(t.start_date).toLocaleDateString('pt-BR'):'—'}</td>
                  <td style={{ fontSize:'.8125rem', color:t.due_date&&new Date(t.due_date)<today&&t.status!=='completed'?'var(--danger)':'var(--text-2)' }}>{t.due_date?new Date(t.due_date).toLocaleDateString('pt-BR'):'—'}</td>
                  <td style={{ fontSize:'.8125rem' }}>{t.progress>0?t.progress+'%':'—'}</td>
                  <td style={{ fontSize:'.8125rem' }}>{planned!=null?planned+'%':'—'}</td>
                  <td style={{ fontSize:'.8125rem', fontWeight:700, color:spiColor(spi) }}>{spi!=null?spi.toFixed(2):'—'}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
