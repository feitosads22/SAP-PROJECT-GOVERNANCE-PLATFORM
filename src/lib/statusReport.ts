import { supabase } from './supabase'
import { newReportDoc, addReportPage, addReportTable, footerAndSave } from './pdf'

const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Saudável', attention: 'Atenção', at_risk: 'Em risco', critical: 'Crítico',
}

function brl(v: number | null | undefined) {
  if (!v) return 'R$ 0'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

// Gera um único PDF com uma página de status report por projeto ativo —
// pensado para o update semanal com o cliente (aba Documentos).
export async function generateWeeklyStatusReport(brandName?: string) {
  const [{ data: portfolio }, { data: milestones }, { data: risks }, { data: issues }] = await Promise.all([
    sb.from('portfolio_summary').select('*').eq('project_status', 'active').order('project_code'),
    sb.from('milestones').select('project_id, name, due_date, status')
      .in('status', ['not_started', 'in_progress']).not('due_date', 'is', null).order('due_date'),
    sb.from('project_risks').select('project_id, title, probability, impact, status')
      .not('status', 'in', '(resolved,accepted)'),
    sb.from('project_issues').select('project_id, title, priority, status')
      .in('status', ['open', 'in_progress']),
  ])

  const projects = portfolio ?? []
  if (projects.length === 0) return { ok: false as const, reason: 'Nenhum projeto ativo para gerar status report.' }

  const weekLabel = `Semana de ${new Date().toLocaleDateString('pt-BR')}`
  const doc = newReportDoc('Status Report Semanal', `${weekLabel} · ${projects.length} projeto(s) ativo(s)`, brandName)

  addReportTable(doc,
    ['Projeto', 'Health', 'Progresso', 'Budget', 'Custo realizado', 'Prazo'],
    projects.map((p: Record<string, unknown>) => [
      `${p.project_code} — ${p.project_name}`,
      HEALTH_LABEL[p.health_status as string] ?? '—',
      `${p.progress}%`,
      brl(p.budget_total as number), brl(p.cost_actual as number),
      p.schedule_status === 'atrasado' ? 'Atrasado' : p.days_remaining != null ? `${p.days_remaining}d restantes` : '—',
    ]))

  for (const p of projects as Record<string, unknown>[]) {
    const pid = p.project_id as string
    addReportPage(doc, `${p.project_code} — ${p.project_name}` as string,
      `Status desta semana · Health: ${HEALTH_LABEL[p.health_status as string] ?? '—'} (${p.health_score ?? '—'})`, brandName)

    addReportTable(doc, ['Indicador', 'Valor'], [
      ['Progresso',        `${p.progress}%`],
      ['Budget total',     brl(p.budget_total as number)],
      ['Custo realizado',  brl(p.cost_actual as number)],
      ['Forecast',         brl(p.cost_forecast as number)],
      ['Tarefas concluídas', `${p.tasks_done}/${(p.tasks_done as number) + (p.tasks_open as number)}`],
      ['Prazo',            p.schedule_status === 'atrasado' ? 'Atrasado' : p.days_remaining != null ? `${p.days_remaining} dia(s) restantes` : 'Sem prazo definido'],
    ], 45)

    const pMilestones = (milestones ?? []).filter((m: Record<string, unknown>) => m.project_id === pid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY1 = (doc as any).lastAutoTable?.finalY ?? 90
    addReportTable(doc, ['Próximos marcos', 'Data'],
      pMilestones.length > 0
        ? pMilestones.map((m: Record<string, unknown>) => [m.name as string, new Date(m.due_date as string).toLocaleDateString('pt-BR')])
        : [['Nenhum marco pendente', '—']],
      lastY1 + 10)

    const pRisks  = (risks ?? []).filter((r: Record<string, unknown>) => r.project_id === pid)
    const pIssues = (issues ?? []).filter((i: Record<string, unknown>) => i.project_id === pid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY2 = (doc as any).lastAutoTable?.finalY ?? 130
    addReportTable(doc, ['Riscos e issues em aberto', 'Tipo', 'Status'],
      [...pRisks.map((r: Record<string, unknown>) => [r.title as string, 'Risco', r.status as string]),
       ...pIssues.map((i: Record<string, unknown>) => [i.title as string, 'Issue', i.status as string])]
        .slice(0, 12).concat(pRisks.length === 0 && pIssues.length === 0 ? [['Nenhum item em aberto', '—', '—']] : []),
      lastY2 + 10)
  }

  footerAndSave(doc, `status_report_semanal_${new Date().toISOString().slice(0, 10)}.pdf`)
  return { ok: true as const }
}
