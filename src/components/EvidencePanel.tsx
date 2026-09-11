import { useEffect, useRef, useState } from 'react'
import {
  getEvidencesByTask,
  createEvidence,
  submitEvidence,
  reviewEvidence,
  uploadEvidenceFile,
  saveAttachment,
  getAttachmentsByEvidence,
  getEvidenceFileUrl,
} from '../lib/api'
import type { Task, TaskEvidence } from '../types/app.types'
import type { Database } from '../types/database.types'

type Attachment = Database['public']['Tables']['attachments']['Row']

type Props = { task: Task; role: string; userId: string; onClose: () => void }

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Aguardando revisão',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

const PRIO_LABEL: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',
  'image/jpeg': 'Imagem',
  'image/png': 'Imagem',
  'image/webp': 'Imagem',
  'image/gif': 'Imagem',
  'text/plain': 'Texto',
}

function fileIcon(mime: string | null): string {
  if (!mime) return '📎'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('wordprocessing')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
  return '📎'
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Attachment list for one evidence ──────────────────────────────────
function AttachmentList({ evidenceId }: { evidenceId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  useEffect(() => {
    getAttachmentsByEvidence(evidenceId).then(({ data }: { data: Attachment[] | null }) => {
      setAttachments(data ?? [])
    })
  }, [evidenceId])

  if (attachments.length === 0) return null

  return (
    <div className="attach-list">
      {attachments.map(a => (
        <button
          key={a.id}
          className="attach-item"
          onClick={async () => {
            const url = await getEvidenceFileUrl(a.storage_path)
            if (url) window.open(url, '_blank')
          }}
        >
          <span>{fileIcon(a.mime_type)}</span>
          <span className="attach-name">{a.file_name}</span>
          <span className="attach-meta">
            {MIME_LABELS[a.mime_type ?? ''] ?? a.mime_type} · {formatBytes(a.file_size)}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── File upload area ──────────────────────────────────────────────────
function FileUpload({
  evidenceId,
  orgId,
  projectId,
  taskId,
  userId,
  onUploaded,
}: {
  evidenceId: string
  orgId: string
  projectId: string
  taskId: string
  userId: string
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  async function handleFile(file: File) {
    setErro(null)
    setUploading(true)

    const result = await uploadEvidenceFile(orgId, projectId, taskId, file)
    if ('error' in result) {
      setErro(result.error)
      setUploading(false)
      return
    }

    const { error: attachErr } = await saveAttachment({
      organization_id: orgId,
      evidence_id: evidenceId,
      storage_path: result.path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: userId,
    })

    setUploading(false)
    if (attachErr) setErro((attachErr as { message: string }).message)
    else onUploaded()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <div
      className={`upload-area${drag ? ' upload-area--drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }}
      />
      {uploading
        ? <p className="sutil">Enviando…</p>
        : <>
            <p className="upload-area__icon">⬆️</p>
            <p className="upload-area__label">Clique ou arraste o arquivo</p>
            <p className="sutil">PDF, Word, Excel, imagens · máx 50 MB</p>
          </>
      }
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────
export default function EvidencePanel({ task, role, userId, onClose }: Props) {
  const [evidences, setEvidences] = useState<TaskEvidence[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [criando, setCriando] = useState(false)
  const [rejMotivo, setRejMotivo] = useState<Record<string, string>>({})
  const [revisando, setRevisando] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [attachKey, setAttachKey] = useState(0) // força reload de anexos

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
    setCriando(true); setErro(null)
    const { error } = await createEvidence({
      task_id: task.id, title: novoTitulo,
      description: novaDesc || undefined,
      organization_id: task.organization_id, created_by: userId,
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
    const { error } = await reviewEvidence(ev.id, verdict, userId,
      verdict === 'rejected' ? rejMotivo[ev.id] : undefined)
    setRevisando(null)
    if (error) setErro(error.message)
    else void load()
  }

  return (
    <div className="panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="panel">
        <header className="panel__header">
          <div>
            <h2 className="panel__title">{task.title}</h2>
            <p className="sutil">
              {task.requires_evidence
                ? '⚠️ Evidência obrigatória para concluir'
                : 'Evidência opcional'}
              {' · '}
              <strong>Mova para "Validação"</strong> quando estiver pronto para revisão
            </p>
          </div>
          <button className="panel__close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        {erro && <p className="erro" style={{ padding: '0 1.5rem' }}>{erro}</p>}

        <div className="panel__body">
          {/* Resumo da tarefa — visível assim que o card é aberto */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {task.description && <p style={{ fontSize: '.875rem', color: 'var(--text)' }}>{task.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '.5rem' }}>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Responsável</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.assignee?.full_name ?? task.assignee?.email ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Revisor</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.reviewer?.full_name ?? task.reviewer?.email ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Prioridade</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{PRIO_LABEL[task.priority ?? ''] ?? task.priority ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Módulo SAP</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.module ? `${task.module.code} — ${task.module.name}` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Fase</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.phase?.name ?? task.sap_activate_phase ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Prazo</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{fmtDate(task.planned_end_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Progresso</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.progress ?? 0}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)' }}>Horas estimadas</div>
                  <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{task.estimated_hours ?? '—'}</div>
                </div>
              </div>

              {(task.evidences ?? []).flatMap(ev => ev.attachments ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: '.625rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--subtle)', marginBottom: '.25rem' }}>
                    Arquivos de evidência anexados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.125rem' }}>
                    {(task.evidences ?? []).flatMap(ev => ev.attachments ?? []).map(f => (
                      <span key={f.id} style={{ fontSize: '.8125rem' }}>📎 {f.file_name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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

              {/* Anexos */}
              <AttachmentList key={attachKey} evidenceId={ev.id} />

              {/* Upload de arquivo */}
              {(ev.status === 'draft' || ev.status === 'rejected') &&
               (ev.created_by === userId || canReview) && (
                <>
                  {uploadingFor === ev.id
                    ? <FileUpload
                        evidenceId={ev.id}
                        orgId={task.organization_id}
                        projectId={task.project_id}
                        taskId={task.id}
                        userId={userId}
                        onUploaded={() => {
                          setUploadingFor(null)
                          setAttachKey(k => k + 1)
                        }}
                      />
                    : <button className="btn-sm" onClick={() => setUploadingFor(ev.id)}>
                        📎 Anexar arquivo
                      </button>
                  }
                </>
              )}

              {/* Submeter para revisão */}
              {ev.status === 'draft' && ev.created_by === userId && (
                <button
                  className="btn-sm"
                  style={{ marginTop: '0.25rem' }}
                  disabled={revisando === ev.id}
                  onClick={() => handleSubmit(ev)}
                >
                  {revisando === ev.id ? 'Enviando…' : '↗ Submeter para revisão'}
                </button>
              )}

              {/* Ações do manager/admin */}
              {ev.status === 'submitted' && canReview && (
                <div className="ev-card__review">
                  <button
                    className="btn-sm btn-sm--ok"
                    disabled={revisando === ev.id}
                    onClick={() => handleReview(ev, 'approved')}
                  >
                    ✓ Aprovar
                  </button>
                  <div className="ev-card__reject-group">
                    <input
                      placeholder="Motivo da rejeição (obrigatório)"
                      value={rejMotivo[ev.id] ?? ''}
                      onChange={e => setRejMotivo(p => ({ ...p, [ev.id]: e.target.value }))}
                    />
                    <button
                      className="btn-sm btn-sm--danger"
                      disabled={revisando === ev.id || !rejMotivo[ev.id]?.trim()}
                      onClick={() => handleReview(ev, 'rejected')}
                    >
                      ✗ Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Criar nova evidência */}
          {canCreate && (
            <div className="ev-new">
              <p className="ev-new__label">Nova evidência</p>
              <label htmlFor="ev-titulo">Título</label>
              <input
                id="ev-titulo" value={novoTitulo}
                onChange={e => setNovoTitulo(e.target.value)}
                placeholder="Ex: Print do sistema após configuração"
              />
              <label htmlFor="ev-desc">Descrição (opcional)</label>
              <textarea
                id="ev-desc" rows={2} value={novaDesc}
                onChange={e => setNovaDesc(e.target.value)}
                placeholder="Detalhes adicionais…"
              />
              <button onClick={handleCreate} disabled={criando || !novoTitulo.trim()}>
                {criando ? 'Salvando…' : 'Criar evidência'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
