import { useEffect, useState, useCallback } from 'react'
import EditTaskModal from './EditTaskModal'
import {
  DndContext, DragOverlay, PointerSensor,
  useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getTasksByProject, updateTaskStatus } from '../lib/api'
import type { Task, TaskStatus } from '../types/app.types'
import { KANBAN_COLUMNS, TASK_STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from '../types/app.types'
import EvidencePanel from './EvidencePanel'
import CreateTaskModal from './CreateTaskModal'

type Props = { projectId: string; organizationId: string; role: string; userId: string }
type ColumnMap = Record<TaskStatus, Task[]>

// Uma tarefa em "Validação" que exige evidência fica travada até o
// gerente aprovar — espelha o trigger do banco (0016_lock_validation_until_approved).
function isLockedInValidation(task: Task): boolean {
  if (task.status !== 'validation' || !task.requires_evidence) return false
  const hasApproved = (task.evidences ?? []).some(ev => ev.status === 'approved')
  return !hasApproved
}

function buildColumns(tasks: Task[]): ColumnMap {
  const cols = Object.fromEntries(KANBAN_COLUMNS.map(s => [s, []])) as unknown as ColumnMap
  for (const t of tasks) { const s = t.status as TaskStatus; if (cols[s]) cols[s].push(t) }
  return cols
}

// ── Card ──────────────────────────────────────────────────────────
function TaskCard({ task, onClick, overlay = false }:
  { task: Task; onClick?: () => void; overlay?: boolean }) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: overlay ? undefined : isLockedInValidation(task) })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  const prio  = task.priority as keyof typeof PRIORITY_COLOR
  const sapPhase = (task as unknown as Record<string,unknown>)['sap_activate_phase'] as string | undefined
  const overdue = task.planned_end_date && task.status !== 'completed' && task.status !== 'cancelled'
    ? new Date(task.planned_end_date) < new Date() : false
  const responsavel = task.assignee?.full_name ?? task.assignee?.email ?? null
  const arquivosEvidencia = (task.evidences ?? []).flatMap(ev => ev.attachments ?? [])
  const locked = !overlay && isLockedInValidation(task)

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      className={`kcard${overdue ? ' kcard--overdue' : ''}${locked ? ' kcard--locked' : ''}`}
      onClick={onClick}
    >
      <div className="kcard__prio" style={{ background: PRIORITY_COLOR[prio] }} />
      {locked && (
        <span className="badge" style={{ background: '#F59E0B22', color: '#F59E0B', fontSize: '.625rem', marginBottom: '.25rem', display: 'inline-block' }}>
          🔒 Aguardando aprovação do gerente
        </span>
      )}
      <p className="kcard__title">{task.title}</p>

      <div className="kcard__assignee" style={{ display:'flex', alignItems:'center', gap:'.375rem', margin:'.25rem 0' }}>
        <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--brand-light)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.625rem', flexShrink:0 }}>
          {(responsavel?.[0] ?? '?').toUpperCase()}
        </div>
        <span style={{ fontSize:'.75rem', color:'var(--subtle)' }}>{responsavel ?? 'Sem responsável'}</span>
      </div>

      <div className="kcard__meta">
        <span className="badge" style={{ background: PRIORITY_COLOR[prio] + '22', color: PRIORITY_COLOR[prio], borderColor: PRIORITY_COLOR[prio] + '44' }}>
          {PRIORITY_LABEL[prio]}
        </span>
        {sapPhase && <span className="kcard__sap-phase">{sapPhase}</span>}
        {task.planned_end_date && (
          <span className={overdue ? 'overdue-label' : 'sutil-2'} style={{ fontSize:'0.6875rem' }}>
            {new Date(task.planned_end_date).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
          </span>
        )}
        {task.requires_evidence && <span className="badge badge--ev">Ev.</span>}
        {task.progress > 0 && <span className="badge">{task.progress}%</span>}
      </div>

      {arquivosEvidencia.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'.125rem', marginTop:'.25rem' }}>
          {arquivosEvidencia.map(f => (
            <span key={f.id} style={{ fontSize:'.6875rem', color:'var(--subtle)', display:'flex', alignItems:'center', gap:'.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              📎 {f.file_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────
function KanbanColumn({ status, tasks, onCardClick }:
  { status: TaskStatus; tasks: Task[]; onCardClick: (t: Task) => void }) {

  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className={`kcol${isOver ? ' kcol--over' : ''}`}>
      <div className="kcol__header">
        <span>{TASK_STATUS_LABEL[status]}</span>
        <span className="kcol__count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="kcol__body">
          {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />)}
          {tasks.length === 0 && <p className="kcol__empty">Solte aqui</p>}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────
export default function KanbanBoard({ projectId, organizationId, role, userId }: Props) {
  const [columns,      setColumns]      = useState<ColumnMap>(buildColumns([]))
  const [activeTask,   setActiveTask]   = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [erro,         setErro]         = useState<string | null>(null)
  const [carregando,   setCarregando]   = useState(true)

  const canCreate = role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await getTasksByProject(projectId)
    if (error) setErro(error.message)
    else setColumns(buildColumns((data ?? []) as Task[]))
    setCarregando(false)
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function findTask(id: string) { return Object.values(columns).flat().find(t => t.id === id) }
  function handleDragStart({ active }: DragStartEvent) { setActiveTask(findTask(String(active.id)) ?? null) }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null)
    if (!over) return
    const task = findTask(String(active.id))
    if (!task) return
    let targetStatus: TaskStatus | undefined
    if (KANBAN_COLUMNS.includes(over.id as TaskStatus)) targetStatus = over.id as TaskStatus
    else targetStatus = findTask(String(over.id))?.status as TaskStatus | undefined
    if (!targetStatus || targetStatus === task.status) return

    setColumns(prev => {
      const next = { ...prev }
      next[task.status as TaskStatus] = next[task.status as TaskStatus].filter(t => t.id !== task.id)
      next[targetStatus!] = [{ ...task, status: targetStatus! }, ...next[targetStatus!]]
      return next
    })

    const { error } = await updateTaskStatus(task.id, targetStatus)
    if (error) {
      const msg = error.message ?? ''
      setErro(msg.includes('EVIDENCE_REQUIRED') || msg.includes('P0001')
        ? 'Esta tarefa exige evidência aprovada para ser concluída.'
        : msg || 'Erro ao mover a tarefa.')
      void load()
    }
  }

  if (carregando) return <p className="sutil">Carregando tarefas…</p>

  return (
    <div className="kanban-wrap">
      {/* Toolbar */}
      <div className="kanban-toolbar">
        <p className="sutil">
          {Object.values(columns).flat().length} tarefa(s)
        </p>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}>
            + Nova tarefa
          </button>
        )}
      </div>

      {erro && (
        <div className="kanban-erro">
          <span>{erro}</span>
          <button className="btn-ghost" style={{ padding:'0 0.25rem' }} onClick={() => setErro(null)}>×</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban">
          {KANBAN_COLUMNS.map(status => (
            <KanbanColumn key={status} status={status} tasks={columns[status]}
              onCardClick={t => { setErro(null); setSelectedTask(t) }} />
          ))}
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      {showCreate && (
        <CreateTaskModal
          projectId={projectId} organizationId={organizationId}
          onCreated={() => { setShowCreate(false); void load() }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selectedTask && (
        <EvidencePanel task={selectedTask} role={role} userId={userId}
          onClose={() => { setSelectedTask(null); void load() }} />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask as any}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); void load() }}
        />
      )}
    </div>
  )
}
