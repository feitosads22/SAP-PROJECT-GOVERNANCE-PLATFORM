import type { Database } from './database.types'

export type Task = Database['public']['Tables']['tasks']['Row'] & {
  start_date?: string | null
  due_date?: string | null
  progress?: number
  description?: string | null
  frente?: string | null
}
export type Project = Database['public']['Tables']['projects']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type TaskEvidence = Database['public']['Tables']['task_evidences']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'validation'
  | 'adjustment_required'
  | 'completed'
  | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo:               'A fazer',
  in_progress:        'Em andamento',
  blocked:            'Bloqueado',
  validation:         'Validação',
  adjustment_required:'Ajuste necessário',
  completed:          'Concluído',
  cancelled:          'Cancelado',
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  'todo','in_progress','blocked','validation',
  'adjustment_required','completed','cancelled',
]

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'var(--prio-low)',
  medium: 'var(--prio-medium)',
  high: 'var(--prio-high)',
  critical: 'var(--prio-critical)',
}
