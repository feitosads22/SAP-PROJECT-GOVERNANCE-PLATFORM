import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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

type Props = { projectId: string; role: string; userId: string }

type ColumnMap = Record<TaskStatus, Task[]>

function buildColumns(tasks: Task[]): ColumnMap {
  const cols = Object.fromEntries(KANBAN_COLUMNS.map(s => [s, []])) as unknown as ColumnMap
  for (const t of tasks) {
    const s = t.status as TaskStatus
    if (cols[s]) cols[s].push(t)
  }
  return cols
}

// ── Card arrastável ──────────────────────────────────────────────────
function TaskCard({
  task,
  onClick,
  overlay = false,
}: {
  task: Task
  onClick?: () => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

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
        <span className="badge">{task.progress}%</span>
      </div>
    </div>
  )
}

// ── Coluna ───────────────────────────────────────────────────────────
function KanbanColumn({
  status,
  tasks,
  onCardClick,
}: {
  status: TaskStatus
  tasks: Task[]
  onCardClick: (t: Task) => void
}) {
  return (
    <div className="kcol">
      <div className="kcol__header">
        <span>{TASK_STATUS_LABEL[status]}</span>
        <span className="kcol__count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="kcol__body">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
          {tasks.length === 0 && <p className="kcol__empty">Sem tarefas</p>}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────
export default function KanbanBoard({ projectId, role, userId }: Props) {
  const [columns, setColumns] = useState<ColumnMap>(buildColumns([]))
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [erro, setErro] = useState<string | null>(null)
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
    if (!over || active.id === over.id) return

    const task = findTask(String(active.id))
    if (!task) return

    // Verifica se o destino é o id de uma coluna (status) ou de uma tarefa
    const targetStatus = KANBAN_COLUMNS.includes(over.id as TaskStatus)
      ? (over.id as TaskStatus)
      : findTask(String(over.id))?.status as TaskStatus | undefined

    if (!targetStatus || targetStatus === task.status) return

    // Optimistic update
    setColumns(prev => {
      const next = { ...prev }
      next[task.status as TaskStatus] = next[task.status as TaskStatus].filter(t => t.id !== task.id)
      next[targetStatus] = [{ ...task, status: targetStatus }, ...next[targetStatus]]
      return next
    })

    const { error } = await updateTaskStatus(task.id, targetStatus)
    if (error) {
      setErro(
        error.message.includes('EVIDENCE_REQUIRED')
          ? 'Esta tarefa exige evidência aprovada para ser concluída.'
          : error.message,
      )
      void load() // reverte
    }
  }

  if (carregando) return <p className="sutil">Carregando tarefas…</p>

  return (
    <div className="kanban-wrap">
      {erro && (
        <div className="kanban-erro">
          {erro}
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
              onCardClick={setSelectedTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>

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
