import { useEffect, useState } from 'react'
import {
  getTimesheets,
  createTimesheet,
  approveTimesheet,
  getMyResource,
} from '../lib/resources'
import { getProjects } from '../lib/api'
import type { Timesheet } from '../lib/resources'
import type { Project } from '../types/app.types'

type Props = { userId: string; role: string }

export default function TimesheetPage({ userId, role }: Props) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const [myResourceId, setMyResourceId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // form
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [hours,       setHours]       = useState('')
  const [projectId,   setProjectId]   = useState('')
  const [description, setDescription] = useState('')

  const canApprove  = role === 'admin' || role === 'manager'
  const canLaunch   = role === 'admin' || role === 'manager' || role === 'consultant'

  async function load() {
    setCarregando(true)
    const [resTs, resPrj, resR] = await Promise.all([
      getTimesheets(
        canApprove ? {} : { resourceId: myResourceId ?? undefined }
      ),
      getProjects(),
      getMyResource(userId),
    ])
    if (resTs.error) setErro(String(resTs.error))
    else setTimesheets((resTs.data ?? []) as Timesheet[])
    if (!resPrj.error) setProjects(resPrj.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!resR.error && resR.data) setMyResourceId((resR.data as any).id)
    setCarregando(false)
  }

  useEffect(() => { void load() }, [userId])

  async function handleCreate() {
    if (!myResourceId) { setErro('Seu perfil não tem um recurso cadastrado. Peça ao administrador.'); return }
    if (!projectId || !hours || !date) { setErro('Preencha data, projeto e horas.'); return }
    const h = parseFloat(hours)
    if (isNaN(h) || h <= 0 || h > 24) { setErro('Horas deve ser entre 0.5 e 24.'); return }

    setSaving(true); setErro(null)
    const { error } = await createTimesheet({
      organization_id: '', // preenchido pelo trigger set_org_id
      resource_id: myResourceId,
      project_id: projectId,
      date,
      hours: h,
      description: description || undefined,
    })
    setSaving(false)
    if (error) { setErro(String(error)); return }
    setHours(''); setDescription('')
    void load()
  }

  async function handleApprove(ts: Timesheet) {
    const { error } = await approveTimesheet(ts.id, userId)
    if (error) setErro(String(error))
    else void load()
  }

  const totalHoras = timesheets.reduce((s, t) => s + Number(t.hours), 0)

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>Timesheet</h1>
          <p className="sutil">{timesheets.length} lançamentos · {totalHoras}h total</p>
        </div>
      </header>

      {/* Formulário de lançamento */}
      {canLaunch && (
        <div className="ts-form">
          <h2 className="section-title">Lançar horas</h2>
          <div className="ts-form__grid">
            <div>
              <label>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
            </div>
            <div>
              <label>Projeto</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Selecione…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Horas</label>
              <input type="number" min="0.5" max="24" step="0.5" value={hours}
                onChange={e => setHours(e.target.value)} placeholder="Ex: 4" />
            </div>
            <div className="ts-form__desc">
              <label>Descrição</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="O que foi feito?" />
            </div>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button onClick={handleCreate} disabled={saving}>
            {saving ? 'Salvando…' : 'Lançar horas'}
          </button>
        </div>
      )}

      {/* Lista */}
      {carregando && <p className="sutil">Carregando…</p>}
      {!carregando && timesheets.length === 0 && (
        <p className="sutil">Nenhum lançamento encontrado.</p>
      )}

      <table className="tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Consultor</th>
            <th>Projeto</th>
            <th>Horas</th>
            <th>Descrição</th>
            <th>Status</th>
            {canApprove && <th>Ação</th>}
          </tr>
        </thead>
        <tbody>
          {timesheets.map(ts => {
            const row = ts as unknown as Record<string, unknown>
            const resource = row['resource'] as { profile: { full_name: string | null } } | null
            const project  = row['project']  as { code: string } | null
            const aprovado = ts.approved_by !== null
            return (
              <tr key={ts.id}>
                <td>{new Date(ts.date).toLocaleDateString('pt-BR')}</td>
                <td>{resource?.profile?.full_name ?? '—'}</td>
                <td>{project?.code ?? '—'}</td>
                <td><strong>{ts.hours}h</strong></td>
                <td>{ts.description ?? '—'}</td>
                <td>
                  {aprovado
                    ? <span className="badge badge--approved">Aprovado</span>
                    : <span className="badge badge--submitted">Pendente</span>}
                </td>
                {canApprove && (
                  <td>
                    {!aprovado && (
                      <button className="btn-sm btn-sm--ok"
                        onClick={() => handleApprove(ts)}>
                        ✓ Aprovar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
