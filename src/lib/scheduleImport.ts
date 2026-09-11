import * as XLSX from 'xlsx'

export type ImportedTaskRow = {
  title: string
  frente: string | null
  sap_activate_phase: string | null
  priority: string
  planned_start_date: string | null
  planned_end_date: string | null
  estimated_hours: number | null
  progress: number
  assignee_email: string | null
}

const PHASE_ALIASES: Record<string, string> = {
  descobrir: 'Descobrir', discover: 'Descobrir',
  preparar: 'Preparar', prepare: 'Preparar',
  explorar: 'Explorar', explore: 'Explorar',
  realizar: 'Realizar', realize: 'Realizar',
  implementar: 'Implementar', deploy: 'Implementar',
  executar: 'Executar', run: 'Executar',
}

const PRIORITY_ALIASES: Record<string, string> = {
  baixa: 'low', low: 'low',
  media: 'medium', média: 'medium', medium: 'medium',
  alta: 'high', high: 'high',
  critica: 'critical', crítica: 'critical', critical: 'critical',
}

function norm(s: unknown): string {
  return String(s ?? '').trim()
}
function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Converte um valor de célula de data (string, serial do Excel, ou Date) pra 'YYYY-MM-DD'.
function parseExcelDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return `${d.y.toString().padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(v).trim()
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const [, d, m, y] = br
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  return null
}

// Cabeçalhos aceitos (case/acento-insensitive) por campo — flexível o
// bastante pra aceitar planilhas exportadas de outros PMOs (ex: o template
// de cronograma SAP Activate usado como base do sistema).
const HEADER_MAP: Record<string, keyof ImportedTaskRow> = {
  'titulo': 'title', 'título': 'title', 'title': 'title', 'tarefa': 'title', 'atividade': 'title',
  'frente': 'frente', 'frente/bloco': 'frente', 'bloco': 'frente',
  'fase': 'sap_activate_phase', 'fase sap activate': 'sap_activate_phase', 'fase activate': 'sap_activate_phase',
  'prioridade': 'priority', 'priority': 'priority',
  'inicio': 'planned_start_date', 'início': 'planned_start_date', 'data inicio': 'planned_start_date', 'data início': 'planned_start_date', 'start date': 'planned_start_date',
  'fim': 'planned_end_date', 'data fim': 'planned_end_date', 'termino': 'planned_end_date', 'término': 'planned_end_date', 'end date': 'planned_end_date', 'due date': 'planned_end_date',
  'horas': 'estimated_hours', 'horas estimadas': 'estimated_hours', 'estimated hours': 'estimated_hours',
  'progresso': 'progress', '% progresso': 'progress', 'progress': 'progress', '%': 'progress',
  'responsavel': 'assignee_email', 'responsável': 'assignee_email', 'assignee': 'assignee_email', 'email': 'assignee_email',
}

export type ParseResult = {
  rows: ImportedTaskRow[]
  errors: string[]
}

// Lê a primeira planilha do arquivo e devolve linhas normalizadas prontas
// pra virar tasks. Linhas sem título são ignoradas silenciosamente (linhas
// em branco no fim da planilha são comuns).
export async function parseScheduleExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { rows: [], errors: ['Planilha vazia.'] }

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null })
  const errors: string[] = []
  const rows: ImportedTaskRow[] = []

  raw.forEach((r, idx) => {
    const mapped: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(r)) {
      const field = HEADER_MAP[normKey(key)]
      if (!field) continue
      mapped[field] = value
    }

    const title = norm(mapped.title)
    if (!title) return // linha em branco / sem título — ignora

    const phaseRaw = norm(mapped.sap_activate_phase)
    const priorityRaw = norm(mapped.priority)
    const hoursRaw = mapped.estimated_hours
    const progressRaw = mapped.progress

    rows.push({
      title,
      frente: norm(mapped.frente) || null,
      sap_activate_phase: PHASE_ALIASES[normKey(phaseRaw)] ?? (phaseRaw || null),
      priority: PRIORITY_ALIASES[normKey(priorityRaw)] ?? 'medium',
      planned_start_date: parseExcelDate(mapped.planned_start_date),
      planned_end_date: parseExcelDate(mapped.planned_end_date),
      estimated_hours: hoursRaw != null && hoursRaw !== '' ? Number(hoursRaw) || null : null,
      progress: progressRaw != null && progressRaw !== '' ? Math.max(0, Math.min(100, Number(progressRaw) || 0)) : 0,
      assignee_email: norm(mapped.assignee_email).toLowerCase() || null,
    })

    if (!mapped.title) errors.push(`Linha ${idx + 2}: sem coluna de título reconhecida.`)
  })

  if (rows.length === 0 && errors.length === 0) {
    errors.push('Nenhuma linha reconhecida. Verifique se a planilha tem uma coluna "Título".')
  }

  return { rows, errors }
}
