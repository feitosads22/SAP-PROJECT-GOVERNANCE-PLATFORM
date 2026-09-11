import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SAP_MODULES = ['FI','CO','MM','SD','PP','WM','HCM','PS','PM','QM','FI/TR','BW/BO','HCM/SF','MM/SD']
const SAP_PHASES  = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar'] as const
const PRIORITIES  = [{v:'low',l:'Baixa'},{v:'medium',l:'Média'},{v:'high',l:'Alta'},{v:'critical',l:'Crítica'}]
const STATUSES    = [{v:'draft',l:'Rascunho'},{v:'active',l:'Ativo'},{v:'on_hold',l:'Em espera'}]

type Props = { onClose: () => void; onCreated: () => void }

export default function CreateProjectModal({ onClose, onCreated }: Props) {
  const { profile } = useAuth()
  const navigate     = useNavigate()
  const [saving, setSaving] = useState(false)
  const [erro,   setErro]   = useState<string | null>(null)

  const [name,       setName]       = useState('')
  const [code,       setCode]       = useState('')
  const [description,setDescription]= useState('')
  const [status,     setStatus]     = useState('draft')
  const [priority,   setPriority]   = useState('medium')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [modules,    setModules]    = useState<string[]>([])
  const [phase,      setPhase]      = useState<typeof SAP_PHASES[number]|''>('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  function toggleModule(m: string) {
    setModules(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) { setErro('Nome e código são obrigatórios.'); return }
    setSaving(true); setErro(null)
    const { data, error } = await sb.from('projects').insert({
      organization_id: profile?.organization_id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      status,
      priority,
      progress: 0,
      start_date: startDate || null,
      end_date:   endDate   || null,
      sap_module: modules.length === 1 ? modules[0] : modules.length > 1 ? modules.join('/') : null,
      created_by: profile?.id,
    }).select().single()

    if (error) { setErro(error.message); setSaving(false); return }
    onCreated()
    navigate(`/projeto/${data.id}`)
  }

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Novo Projeto SAP</div>
            <div style={{ fontSize:'.75rem', color:'var(--subtle)', marginTop:'.1rem' }}>Preencha as informações do projeto</div>
          </div>
          <button className="panel__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display:'contents' }}>
          <div className="panel__body">
            {erro && (
              <div style={{ background:'var(--danger-bg)', color:'var(--danger)', border:'1px solid #fecaca', borderRadius:'var(--r)', padding:'.625rem .875rem', fontSize:'.875rem' }}>
                {erro}
              </div>
            )}

            {/* Nome + Código */}
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Nome do projeto *</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: S/4HANA Financeiro" required autoFocus />
              </div>
              <div className="form-group">
                <label>Código *</label>
                <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ex: ALPHA-S4" required style={{ fontFamily:'monospace', fontWeight:700 }} />
              </div>
              <div className="form-group">
                <label>Status inicial</label>
                <select value={status} onChange={e=>setStatus(e.target.value)}>
                  {STATUSES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} placeholder="Objetivo do projeto…" />
            </div>

            {/* Datas */}
            <div className="form-grid">
              <div className="form-group">
                <label>Data de início</label>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Data de término</label>
                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Prioridade + Fase */}
            <div className="form-grid">
              <div className="form-group">
                <label>Prioridade</label>
                <select value={priority} onChange={e=>setPriority(e.target.value)}>
                  {PRIORITIES.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fase SAP Activate inicial</label>
                <select value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}>
                  <option value="">— Selecione —</option>
                  {SAP_PHASES.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Módulos SAP */}
            <div className="form-group">
              <label>Módulos SAP</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'.375rem', marginTop:'.25rem' }}>
                {SAP_MODULES.map(m => (
                  <button key={m} type="button"
                    onClick={() => toggleModule(m)}
                    style={{
                      padding:'.25rem .625rem', borderRadius:'var(--r-sm)',
                      fontSize:'.75rem', fontWeight:600,
                      background: modules.includes(m) ? 'var(--brand)' : 'var(--surface-2)',
                      color: modules.includes(m) ? '#fff' : 'var(--text-2)',
                      border: `1.5px solid ${modules.includes(m) ? 'var(--brand)' : 'var(--border)'}`,
                      boxShadow: 'none',
                    }}>
                    {m}
                  </button>
                ))}
              </div>
              {modules.length > 0 && (
                <p style={{ fontSize:'.75rem', color:'var(--subtle)', marginTop:'.375rem' }}>
                  Selecionados: {modules.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border)', display:'flex', gap:'.75rem', justifyContent:'flex-end', background:'var(--surface-2)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Criando…' : '✓ Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
