import { supabase } from './supabase'

export type TaskComment = {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  author?: { id: string; full_name: string | null } | null
}

export async function getTaskComments(taskId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('task_comments')
    .select('*, author:profiles(id, full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
}

export async function createTaskComment(taskId: string, authorId: string, body: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('task_comments')
    .insert({ task_id: taskId, author_id: authorId, body })
    .select('*, author:profiles(id, full_name)')
    .single()
}

export async function deleteTaskComment(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('task_comments').delete().eq('id', id)
}

// Extrai @Nome Completo do texto do comentário (nomes com espaço, até pontuação)
export function extractMentions(body: string, candidates: { id: string; full_name: string | null }[]) {
  const mentioned: { id: string; full_name: string }[] = []
  for (const c of candidates) {
    if (!c.full_name) continue
    if (body.includes('@' + c.full_name)) mentioned.push({ id: c.id, full_name: c.full_name })
  }
  return mentioned
}

export async function notifyMention(
  organizationId: string, userId: string, taskId: string, taskTitle: string, authorName: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc('create_notification', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_type: 'task_comment_mention',
    p_title: `${authorName} mencionou você em "${taskTitle}"`,
    p_body: null,
    p_entity_type: 'task',
    p_entity_id: taskId,
  })
}
