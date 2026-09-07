import { useEffect, useState } from 'react'
import { getCapacity } from '../lib/resources'
import type { CapacityRow } from '../lib/resources'

const STATUS_CONFIG = {
  overload:    { label: 'Sobrecarga',   icon: '🔴', cls: 'cap--overload' },
  atencao:     { label: 'Atenção',      icon: '🟡', cls: 'cap--atencao'  },
  disponivel:  { label: 'Disponível',   icon: '🟢', cls: 'cap--ok'       },
  indisponivel:{ label: 'Indisponível', icon: '⚪', cls: 'cap--off'      },
}

const SENIORITY: Record<string, string> = {
  junior: 'Júnior', pleno: 'Pleno',
  senior: 'Sênior', especialista: 'Especialista',
}


function extractError(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e['message'] === 'string') return e['message']
    if (typeof e['details'] === 'string') return e['details']
  }
  return 'Erro desconhecido.'
}

export default function Capacity() {
  const [rows, setRows] = useState<CapacityRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    getCapacity().then(({ data, error }) => {
      if (error) setErro(extractError(error))
      else setRows((data ?? []) as CapacityRow[])
      setCarregando(false)
    })
  }, [])

  const overloaded = rows.filter(r => r.capacity_status === 'overload')
  const atencao    = rows.filter(r => r.capacity_status === 'atencao')

  return (
    <div className="page">
      <header className="topo">
        <div>
          <h1>Capacidade de recursos</h1>
          <p className="sutil">Horas realizadas esta semana vs capacidade semanal</p>
        </div>
      </header>

      {/* Alertas */}
      {overloaded.length > 0 && (
        <div className="cap-alert cap-alert--danger">
          🔴 {overloaded.length} consultor{overloaded.length > 1 ? 'es' : ''} em sobrecarga:{' '}
          {overloaded.map(r => r.full_name ?? r.email).join(', ')}
        </div>
      )}
      {atencao.length > 0 && (
        <div className="cap-alert cap-alert--warn">
          🟡 {atencao.length} consultor{atencao.length > 1 ? 'es' : ''} em atenção:{' '}
          {atencao.map(r => r.full_name ?? r.email).join(', ')}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="sutil">Carregando…</p>}

      {!carregando && rows.length === 0 && (
        <p className="sutil">Nenhum recurso cadastrado. Acesse Recursos para criar.</p>
      )}

      <div className="cap-grid">
        {rows.map(r => {
          const cfg = STATUS_CONFIG[r.capacity_status]
          const pct = Math.min(r.utilization_pct, 150) // cap visual em 150%
          return (
            <div key={r.resource_id} className={`cap-card ${cfg.cls}`}>
              <div className="cap-card__top">
                <div>
                  <p className="cap-card__name">{r.full_name ?? r.email}</p>
                  <p className="sutil">{SENIORITY[r.seniority] ?? r.seniority} · {r.sap_modules.join(', ')}</p>
                </div>
                <span className="cap-card__badge">{cfg.icon} {cfg.label}</span>
              </div>

              {/* Barra de utilização */}
              <div className="cap-bar-wrap">
                <div className="cap-bar">
                  <div
                    className={`cap-bar__fill cap-bar__fill--${r.capacity_status}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="cap-pct">{r.utilization_pct}%</span>
              </div>

              <div className="cap-stats">
                <div className="cap-stat">
                  <span className="cap-stat__val">{r.hours_this_week}h</span>
                  <span className="cap-stat__lbl">esta semana</span>
                </div>
                <div className="cap-stat">
                  <span className="cap-stat__val">{r.weekly_capacity_hours}h</span>
                  <span className="cap-stat__lbl">capacidade</span>
                </div>
                <div className="cap-stat">
                  <span className="cap-stat__val">{r.hours_this_month}h</span>
                  <span className="cap-stat__lbl">este mês</span>
                </div>
                <div className="cap-stat">
                  <span className="cap-stat__val">{r.total_allocated_hours}h</span>
                  <span className="cap-stat__lbl">alocado</span>
                </div>
              </div>

              {r.hourly_rate != null && (
                <p className="sutil cap-rate">
                  R$ {r.hourly_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
