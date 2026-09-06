import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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

function buildColumns(tasks: Task[]): ColumnMap {
  const cols = Object.fromEntries(KANBAN_COLUMNS.map(s => [s, []])) as unknown as ColumnMap
  for (const t of tasks) {
    const s = t.status as TaskStatus
    if (cols[s]) cols[s].push(t)
  }
  return cols
}

// ── Card ─────────────────────────────────────────────────────────────
function TaskCard({
  task, onClick, overlay = false,
}: { task: Task; onClick?: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const prio = task.priority as keyof typeof PRIORITY_COLOR
  const overdue =
    task.planned_end_date && task.status !== 'completed' && task.status !== 'cancelled'
      ? new Date(task.planned_end_date) < new Date()
      : false

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      className={`kcard${overdue ? ' kcard--overdue' : ''}`}
      onClick={onClick}
    >
      <div className="kcard__prio" style={{ background: PRIORITY_COLOR[prio] }} />
      <p className="kcard__title">{task.title}</p>
      <div className="kcard__meta">
        <span>{PRIORITY_LABEL[prio]}</span>
        {task.planned_end_date && (
          <span className={overdue ? 'overdue-label' : ''}>
            {new Date(task.planned_end_date).toLocaleDateString('pt-BR')}
          </span>
        )}
        {task.requires_evidence && <span className="badge badge--ev">Evidência</span>}
        {String((task as unknown as Record<string, unknown>)['sap_activate_phase'] ?? '') && (
          <span className="badge">{String((task as unknown as Record<string, unknown>)['sap_activate_phase'])}</span>
        )}
        <span className="badge">{task.progress}%</span>
      </div>
    </div>
  )
}

// ── Coluna droppable ──────────────────────────────────────────────────
// Usa useDroppable com id = status para que over.id seja o status.
function KanbanColumn({
  status, tasks, onCardClick,
}: { status: TaskStatus; tasks: Task[]; onCardClick: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className={`kcol${isOver ? ' kcol--over' : ''}`}>
      <div className="kcol__header">
        <span>{TASK_STATUS_LABEL[status]}</span>
        <span className="kcol__count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="kcol__body">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
          {tasks.length === 0 && <p className="kcol__empty">Solte aqui</p>}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────
export default function KanbanBoard({ projectId, organizationId, role, userId }: Props) {
  const [columns, setColumns]       = useState<ColumnMap>(buildColumns([]))
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [erro, setErro]             = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const load = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await getTasksByProject(projectId)
    if (error) setErro(error.message)
    else setColumns(buildColumns((data ?? []) as Task[]))
    setCarregando(false)
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function findTask(id: string): Task | undefined {
    return Object.values(columns).flat().find(t => t.id === id)
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTask(findTask(String(active.id)) ?? null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null)
    if (!over) return

    const task = findTask(String(active.id))
    if (!task) return

    // over.id pode ser um status (coluna droppable) ou um task id
    let targetStatus: TaskStatus | undefined
    if (KANBAN_COLUMNS.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus
    } else {
      // caiu sobre um card — usa o status desse card
      targetStatus = findTask(String(over.id))?.status as TaskStatus | undefined
    }

    if (!targetStatus || targetStatus === task.status) return

    // Optimistic update
    setColumns(prev => {
      const next = { ...prev }
      next[task.status as TaskStatus] = next[task.status as TaskStatus].filter(t => t.id !== task.id)
      next[targetStatus!] = [{ ...task, status: targetStatus! }, ...next[targetStatus!]]
      return next
    })

    const { error } = await updateTaskStatus(task.id, targetStatus)
    if (error) {
      const msg = error.message ?? ''
      setErro(
        msg.includes('EVIDENCE_REQUIRED') || msg.includes('P0001')
          ? 'Esta tarefa exige evidência aprovada para ser concluída.'
          : msg || 'Erro ao mover a tarefa.',
      )
      void load() // reverte
    }
  }

  if (carregando) return <p className="sutil">Carregando tarefas…</p>

  return (
    <div className="kanban-wrap">
      {erro && (
        <div className="kanban-erro">
          <span>{erro}</span>
          <button className="link" onClick={() => setErro(null)}>×</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban">
          {KANBAN_COLUMNS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
              onCardClick={t => { setErro(null); setSelectedTask(t) }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>

      {(role === 'admin' || role === 'manager') && (
        <button
          className="btn-sm"
          style={{ marginTop:'0.75rem' }}
          onClick={() => setShowCreate(true)}
        >
          + Nova tarefa
        </button>
      )}

      {showCreate && (
        <CreateTaskModal
          projectId={projectId}
          organizationId={organizationId}
          onCreated={() => { setShowCreate(false); void load() }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selectedTask && (
        <EvidencePanel
          task={selectedTask}
          role={role}
          userId={userId}
          onClose={() => { setSelectedTask(null); void load() }}
        />
      )}
    </div>
  )
}
