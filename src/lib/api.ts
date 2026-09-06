import { supabase } from './supabase'
import type { TaskStatus } from '../types/app.types'

// ── Projetos ─────────────────────────────────────────────────────────
export async function getProjects() {
  return supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
}

export async function getProject(id: string) {
  return supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
}

// ── Tarefas ──────────────────────────────────────────────────────────
export async function getTasksByProject(projectId: string) {
  return supabase
    .from('tasks')
    .select(`
      *,
      module:project_modules(id, name, code),
      phase:phases(id, name, code)
    `)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
}

export async function getMyTasks(userId: string) {
  return supabase
    .from('tasks')
    .select(`
      *,
      project:projects(id, name, code),
      module:project_modules(id, name, code)
    `)
    .eq('assignee_id', userId)
    .not('status', 'in', '(completed,cancelled)')
    .order('updated_at', { ascending: false })
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  // O trigger check_evidence_before_completion valida no banco.
  // O erro EVIDENCE_REQUIRED sobe como PostgreSQL exception e chega
  // aqui como error.message.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('tasks') as any)
    .update({ status })
    .eq('id', taskId)
}

// ── Evidências ────────────────────────────────────────────────────────
export async function getEvidencesByTask(taskId: string) {
  return supabase
    .from('task_evidences')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
}

export async function createEvidence(data: {
  task_id: string
  title: string
  description?: string
  organization_id: string
  created_by: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('task_evidences') as any).insert(data).select().single()
}

export async function submitEvidence(evidenceId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('task_evidences') as any)
    .update({
      status: 'submitted',
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', evidenceId)
}

export async function reviewEvidence(
  evidenceId: string,
  verdict: 'approved' | 'rejected',
  reviewerId: string,
  rejectionReason?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('task_evidences') as any)
    .update({
      status: verdict,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? null,
    })
    .eq('id', evidenceId)
}

// ── Notificações ──────────────────────────────────────────────────────
export async function getUnreadNotifications(userId: string) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
}

export async function markNotificationRead(notificationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('notifications') as any)
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

// ── Perfis ─────────────────────────────────────────────────────────────
export async function getOrgProfiles() {
  return supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .not('organization_id', 'is', null)
}
