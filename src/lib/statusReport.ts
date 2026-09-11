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

// Gera o status report de UM projeto só, como Blob (não baixa direto) — usado
// pela aba Documentos DENTRO do projeto, que sobe o PDF pro storage e
// registra em project_documents (histórico de status reports por data).
export async function generateProjectStatusReport(projectId: string, brandName?: string) {
  const [{ data: pRow, error: pErr }, { data: milestones }, { data: risks }, { data: issues }] = await Promise.all([
    sb.from('portfolio_summary').select('*').eq('project_id', projectId).maybeSingle(),
    sb.from('milestones').select('name, due_date, status').eq('project_id', projectId)
      .in('status', ['not_started', 'in_progress']).not('due_date', 'is', null).order('due_date'),
    sb.from('project_risks').select('title, probability, impact, status').eq('project_id', projectId)
      .not('status', 'in', '(resolved,accepted)'),
    sb.from('project_issues').select('title, priority, status').eq('project_id', projectId)
      .in('status', ['open', 'in_progress']),
  ])

  if (pErr || !pRow) return { ok: false as const, reason: 'Projeto não encontrado para gerar o status report.' }
  const p = pRow as Record<string, unknown>

  const today = new Date()
  const dateLabel = today.toLocaleDateString('pt-BR')
  const doc = newReportDoc('Status Report Semanal',
    `${p.project_code} — ${p.project_name} · ${dateLabel} · Health: ${HEALTH_LABEL[p.health_status as string] ?? '—'} (${p.health_score ?? '—'})`,
    brandName)

  addReportTable(doc, ['Indicador', 'Valor'], [
    ['Progresso',          `${p.progress}%`],
    ['Budget total',       brl(p.budget_total as number)],
    ['Custo realizado',    brl(p.cost_actual as number)],
    ['Forecast',           brl(p.cost_forecast as number)],
    ['Tarefas concluídas', `${p.tasks_done}/${(p.tasks_done as number) + (p.tasks_open as number)}`],
    ['Prazo',              p.schedule_status === 'atrasado' ? 'Atrasado' : p.days_remaining != null ? `${p.days_remaining} dia(s) restantes` : 'Sem prazo definido'],
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY1 = (doc as any).lastAutoTable?.finalY ?? 90
  addReportTable(doc, ['Próximos marcos', 'Data'],
    (milestones ?? []).length > 0
      ? (milestones ?? []).map((m: Record<string, unknown>) => [m.name as string, new Date(m.due_date as string).toLocaleDateString('pt-BR')])
      : [['Nenhum marco pendente', '—']],
    lastY1 + 10)

  const pRisks  = risks ?? []
  const pIssues = issues ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY2 = (doc as any).lastAutoTable?.finalY ?? 130
  addReportTable(doc, ['Riscos e issues em aberto', 'Tipo', 'Status'],
    [...pRisks.map((r: Record<string, unknown>) => [r.title as string, 'Risco', r.status as string]),
     ...pIssues.map((i: Record<string, unknown>) => [i.title as string, 'Issue', i.status as string])]
      .slice(0, 15).concat(pRisks.length === 0 && pIssues.length === 0 ? [['Nenhum item em aberto', '—', '—']] : []),
    lastY2 + 10)

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor('#94A3B8')
    doc.text(`Gerado em ${today.toLocaleString('pt-BR')} · página ${i}/${pageCount}`, 10, doc.internal.pageSize.getHeight() - 8)
  }

  const isoDate = today.toISOString().slice(0, 10)
  const fileName = `Status Report - ${p.project_code} - ${isoDate}.pdf`
  const blob = doc.output('blob') as Blob
  return { ok: true as const, blob, fileName, isoDate }
}
