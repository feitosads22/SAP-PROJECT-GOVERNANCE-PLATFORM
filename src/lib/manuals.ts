import { jsPDF } from 'jspdf'
import { supabase } from './supabase'

export type GenerateManualResult =
  | { ok: true; markdown: string; evidenceCount: number; projectCode: string; projectName: string }
  | { ok: false; reason: string }

export async function generateManualFromEvidences(projectId: string, moduleId?: string): Promise<GenerateManualResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('generate-manual', {
    body: { project_id: projectId, module_id: moduleId || undefined },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  })
  if (error) {
    // O corpo do erro (mensagem específica da function) vem em error.context, não em error.message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any)?.context
    let reason = error.message ?? 'Erro ao gerar manual.'
    if (ctx?.json) {
      try { reason = (await ctx.json())?.error ?? reason } catch { /* usa reason padrão */ }
    }
    return { ok: false, reason }
  }
  if (data?.error) return { ok: false, reason: data.error }
  return {
    ok: true,
    markdown: data.markdown as string,
    evidenceCount: data.evidence_count as number,
    projectCode: data.project?.code ?? '',
    projectName: data.project?.name ?? '',
  }
}

// Renderizador de Markdown bem simples (títulos #/##/###, listas -/*, resto
// como parágrafo) — suficiente pro texto que a IA devolve, sem depender de
// nenhuma lib de markdown->pdf.
export function markdownToPdfBlob(markdown: string, brandName = '2F_System'): Blob {
  const doc = new jsPDF()
  const marginX = 15
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - marginX * 2
  let y = 20

  function ensureSpace(lineH: number) {
    if (y + lineH > pageH - 15) { doc.addPage(); y = 20 }
  }

  doc.setFontSize(9); doc.setTextColor('#94A3B8')
  doc.text(brandName, marginX, 10)

  const lines = markdown.split('\n')
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { y += 3; continue }

    if (line.startsWith('### ')) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#111111')
      const wrapped = doc.splitTextToSize(line.slice(4), maxW)
      ensureSpace(wrapped.length * 6 + 4); y += 4
      doc.text(wrapped, marginX, y); y += wrapped.length * 6
    } else if (line.startsWith('## ')) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0A6ED1')
      const wrapped = doc.splitTextToSize(line.slice(3), maxW)
      ensureSpace(wrapped.length * 7 + 6); y += 6
      doc.text(wrapped, marginX, y); y += wrapped.length * 7
    } else if (line.startsWith('# ')) {
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor('#071B33')
      const wrapped = doc.splitTextToSize(line.slice(2), maxW)
      ensureSpace(wrapped.length * 9 + 8); y += 8
      doc.text(wrapped, marginX, y); y += wrapped.length * 9
    } else if (/^[-*]\s+/.test(line)) {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#333333')
      const wrapped = doc.splitTextToSize('•  ' + line.replace(/^[-*]\s+/, ''), maxW - 4)
      ensureSpace(wrapped.length * 5.5 + 2); y += 2
      doc.text(wrapped, marginX + 3, y); y += wrapped.length * 5.5
    } else {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#333333')
      const clean = line.replace(/\*\*(.*?)\*\*/g, '$1')
      const wrapped = doc.splitTextToSize(clean, maxW)
      ensureSpace(wrapped.length * 5.5 + 3); y += 3
      doc.text(wrapped, marginX, y); y += wrapped.length * 5.5
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor('#94A3B8')
    doc.text(`Gerado por IA a partir de evidências aprovadas · ${new Date().toLocaleString('pt-BR')} · página ${i}/${pageCount}`, marginX, pageH - 8)
  }

  return doc.output('blob') as Blob
}
