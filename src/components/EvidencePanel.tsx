import { useEffect, useState } from 'react'
import {
  getEvidencesByTask,
  createEvidence,
  submitEvidence,
  reviewEvidence,
} from '../lib/api'
import type { Task, TaskEvidence } from '../types/app.types'

type Props = {
  task: Task
  role: string
  userId: string
  onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Aguardando revisão',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

export default function EvidencePanel({ task, role, userId, onClose }: Props) {
  const [evidences, setEvidences] = useState<TaskEvidence[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // novo
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [criando, setCriando] = useState(false)

  // revisão
  const [rejMotivo, setRejMotivo] = useState<Record<string, string>>({})
  const [revisando, setRevisando] = useState<string | null>(null)

  const canCreate = role === 'admin' || role === 'manager' || role === 'consultant'
  const canReview = role === 'admin' || role === 'manager'

  async function load() {
    setCarregando(true)
    const { data, error } = await getEvidencesByTask(task.id)
    if (error) setErro(error.message)
    else setEvidences((data ?? []) as TaskEvidence[])
    setCarregando(false)
  }

  useEffect(() => { void load() }, [task.id])

  async function handleCreate() {
    if (!novoTitulo.trim()) return
    setCriando(true)
    setErro(null)
    const { error } = await createEvidence({
      task_id: task.id,
      title: novoTitulo,
      description: novaDesc || undefined,
      organization_id: task.organization_id,
      created_by: userId,
    })
    setCriando(false)
    if (error) { setErro(error.message); return }
    setNovoTitulo(''); setNovaDesc('')
    void load()
  }

  async function handleSubmit(ev: TaskEvidence) {
    setRevisando(ev.id)
    const { error } = await submitEvidence(ev.id, userId)
    setRevisando(null)
    if (error) setErro(error.message)
    else void load()
  }

  async function handleReview(ev: TaskEvidence, verdict: 'approved' | 'rejected') {
    setRevisando(ev.id)
    const { error } = await reviewEvidence(
      ev.id, verdict, userId,
      verdict === 'rejected' ? rejMotivo[ev.id] : undefined,
    )
    setRevisando(null)
    if (error) setErro(error.message)
    else { void load() }
  }

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="panel">
        <header className="panel__header">
          <div>
            <h2 className="panel__title">{task.title}</h2>
            <p className="sutil">Evidências · {task.requires_evidence ? 'Obrigatória para concluir' : 'Opcional'}</p>
          </div>
          <button className="panel__close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        {erro && <p className="erro" style={{ padding: '0 1.5rem' }}>{erro}</p>}

        <div className="panel__body">
          {/* Lista de evidências */}
          {carregando && <p className="sutil">Carregando…</p>}

          {!carregando && evidences.length === 0 && (
            <p className="sutil">Nenhuma evidência registrada.</p>
          )}

          {evidences.map(ev => (
            <div key={ev.id} className={`ev-card ev-card--${ev.status}`}>
              <div className="ev-card__top">
                <span className="ev-card__title">{ev.title}</span>
                <span className={`badge badge--${ev.status}`}>{STATUS_LABEL[ev.status]}</span>
              </div>
              {ev.description && <p className="ev-card__desc">{ev.description}</p>}
              {ev.rejection_reason && (
                <p className="ev-card__rejection">Motivo: {ev.rejection_reason}</p>
              )}

              {/* Ações do criador */}
              {ev.status === 'draft' && ev.created_by === userId && (
                <button
                  className="btn-sm"
                  disabled={revisando === ev.id}
                  onClick={() => handleSubmit(ev)}
                >
                  {revisando === ev.id ? 'Enviando…' : 'Submeter para revisão'}
                </button>
              )}

              {/* Ações do revisor */}
              {ev.status === 'submitted' && canReview && (
                <div className="ev-card__review">
                  <button
                    className="btn-sm btn-sm--ok"
                    disabled={revisando === ev.id}
                    onClick={() => handleReview(ev, 'approved')}
                  >
                    Aprovar
                  </button>
                  <div className="ev-card__reject-group">
                    <input
                      placeholder="Motivo da rejeição"
                      value={rejMotivo[ev.id] ?? ''}
                      onChange={e => setRejMotivo(p => ({ ...p, [ev.id]: e.target.value }))}
                    />
                    <button
                      className="btn-sm btn-sm--danger"
                      disabled={revisando === ev.id || !rejMotivo[ev.id]?.trim()}
                      onClick={() => handleReview(ev, 'rejected')}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Formulário de nova evidência */}
          {canCreate && (
            <div className="ev-new">
              <p className="ev-new__label">Nova evidência</p>
              <label htmlFor="ev-titulo">Título</label>
              <input
                id="ev-titulo"
                value={novoTitulo}
                onChange={e => setNovoTitulo(e.target.value)}
                placeholder="Ex: Print do sistema após configuração"
              />
              <label htmlFor="ev-desc">Descrição (opcional)</label>
              <textarea
                id="ev-desc"
                rows={3}
                value={novaDesc}
                onChange={e => setNovaDesc(e.target.value)}
                placeholder="Detalhes adicionais…"
              />
              <button
                onClick={handleCreate}
                disabled={criando || !novoTitulo.trim()}
              >
                {criando ? 'Salvando…' : 'Criar evidência'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
