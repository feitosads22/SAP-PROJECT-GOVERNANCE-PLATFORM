// Edge Function: generate-manual
// Gera um manual/documentação técnica em Markdown a partir das evidências
// APROVADAS de um projeto (opcionalmente filtrado por módulo), usando a
// Claude API. Server-side porque precisa da ANTHROPIC_API_KEY (secreta).
//
// Configuração necessária antes de usar:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: supabase functions deploy generate-manual

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

type EvidenceRow = {
  title: string
  description: string | null
  reviewed_at: string | null
  task: {
    title: string
    description: string | null
    sap_activate_phase: string | null
    frente: string | null
    module: { name: string; code: string } | null
  } | null
  attachments: { file_name: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY não configurada no projeto Supabase (supabase secrets set ANTHROPIC_API_KEY=...)' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) return json({ error: 'Não autenticado' }, 401)

    const { data: callerProfile } = await anonClient
      .from('profiles').select('role, organization_id').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['admin', 'manager', 'consultant'].includes(callerProfile.role)) {
      return json({ error: 'Sem permissão para gerar manuais' }, 403)
    }

    const { project_id, module_id } = await req.json()
    if (!project_id) return json({ error: 'project_id é obrigatório' }, 400)

    // service_role só pra ler tudo sem depender de policy de embed — a
    // organização já foi validada acima via callerProfile.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: project, error: projErr } = await admin
      .from('projects').select('id, name, code, sap_module, organization_id')
      .eq('id', project_id).maybeSingle()
    if (projErr || !project) return json({ error: 'Projeto não encontrado' }, 404)
    if (project.organization_id !== callerProfile.organization_id) {
      return json({ error: 'Projeto não pertence à sua organização' }, 403)
    }

    let taskQuery = admin.from('tasks').select('id').eq('project_id', project_id)
    if (module_id) taskQuery = taskQuery.eq('module_id', module_id)
    const { data: taskRows } = await taskQuery
    const taskIds = (taskRows ?? []).map((t: { id: string }) => t.id)

    if (taskIds.length === 0) {
      return json({ error: 'Nenhuma tarefa encontrada para gerar o manual.' }, 400)
    }

    const { data: evidences, error: evErr } = await admin
      .from('task_evidences')
      .select(`
        title, description, reviewed_at,
        task:tasks!task_evidences_task_id_fkey(title, description, sap_activate_phase, frente,
          module:project_modules(name, code)),
        attachments(file_name)
      `)
      .eq('status', 'approved')
      .in('task_id', taskIds)
      .order('reviewed_at')
    if (evErr) return json({ error: evErr.message }, 500)

    const rows = (evidences ?? []) as unknown as EvidenceRow[]
    if (rows.length === 0) {
      return json({ error: 'Nenhuma evidência aprovada encontrada para este projeto/módulo. Aprove evidências antes de gerar o manual.' }, 400)
    }

    // Monta o contexto que vai pro modelo: cada evidência aprovada + a
    // tarefa/fase/frente/módulo a que pertence + nomes dos anexos (o modelo
    // não vê o conteúdo dos arquivos, só os metadados — ele referencia o
    // anexo pelo nome como fonte, não inventa o conteúdo do arquivo).
    const contextBlocks = rows.map((ev, i) => {
      const t = ev.task
      const files = (ev.attachments ?? []).map(a => a.file_name).join(', ') || 'nenhum arquivo anexado'
      return [
        `### Evidência ${i + 1}: ${ev.title}`,
        t?.module ? `Módulo: ${t.module.code} — ${t.module.name}` : null,
        t?.sap_activate_phase ? `Fase SAP Activate: ${t.sap_activate_phase}` : null,
        t?.frente ? `Frente/Bloco: ${t.frente}` : null,
        `Tarefa relacionada: ${t?.title ?? '—'}`,
        t?.description ? `Descrição da tarefa: ${t.description}` : null,
        ev.description ? `Descrição da evidência: ${ev.description}` : null,
        `Arquivos anexados: ${files}`,
      ].filter(Boolean).join('\n')
    }).join('\n\n')

    const systemPrompt = `Você é um consultor SAP sênior escrevendo documentação técnica de projeto para a metodologia SAP Activate. \
Receberá uma lista de evidências JÁ APROVADAS pelo gerente do projeto, com a tarefa, fase, frente e módulo a que cada uma pertence. \
Sua tarefa é sintetizar um MANUAL TÉCNICO em Markdown, em português, organizado por Módulo/Frente e depois por Fase SAP Activate (Preparar, Explorar, Realizar, Implementar, Executar), \
descrevendo o que foi configurado/entregue com base nas evidências. \
Quando uma evidência tiver arquivos anexados, referencie-os como "(ver anexo: nome_do_arquivo)" no texto — NUNCA invente o conteúdo desses arquivos, você não tem acesso a eles, só ao título/descrição da evidência. \
Não invente informação que não esteja nas evidências fornecidas. Se uma seção não tiver evidências, omita a seção. \
Comece direto com um título de nível 1 com o nome do projeto.`

    const userPrompt = `Projeto: ${project.code} — ${project.name}\nMódulo SAP do projeto: ${project.sap_module ?? '—'}\n\nEvidências aprovadas:\n\n${contextBlocks}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      return json({ error: `Falha ao chamar a IA: ${errText}` }, 502)
    }
    const aiData = await aiRes.json()
    const markdown = (aiData.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')

    return json({
      markdown,
      evidence_count: rows.length,
      project: { code: project.code, name: project.name },
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
