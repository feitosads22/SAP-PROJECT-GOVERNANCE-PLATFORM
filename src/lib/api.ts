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
      phase:phases(id, name, code),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
      reviewer:profiles!tasks_reviewer_id_fkey(id, full_name, email),
      evidences:task_evidences(
        id, status,
        attachments(id, file_name)
      )
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
      module:project_modules(id, name, code),
      phase:phases(id, name, code),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
      reviewer:profiles!tasks_reviewer_id_fkey(id, full_name, email),
      evidences:task_evidences(
        id, status,
        attachments(id, file_name)
      )
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

// ── Storage — upload de evidência ─────────────────────────────────────
export async function uploadEvidenceFile(
  orgId: string,
  projectId: string,
  taskId: string,
  file: File,
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  // path: {org_id}/{project_id}/{task_id}/{timestamp}_{filename}

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${orgId}/${projectId}/${taskId}/${Date.now()}_${safe}`

  const { error } = await supabase.storage
    .from('task-evidence')
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) return { error: error.message }

  const { data } = supabase.storage
    .from('task-evidence')
    .getPublicUrl(path)

  return { path, publicUrl: data.publicUrl }
}

export async function getEvidenceFileUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from('task-evidence')
    .createSignedUrl(path, 3600) // 1 hora
  return data?.signedUrl ?? ''
}

export async function saveAttachment(data: {
  organization_id: string
  evidence_id: string
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  uploaded_by: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('attachments') as any).insert(data)
}

export async function getAttachmentsByEvidence(evidenceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('attachments') as any)
    .select('*')
    .eq('evidence_id', evidenceId)
    .order('created_at', { ascending: false })
}
