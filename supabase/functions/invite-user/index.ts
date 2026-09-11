// Edge Function: invite-user
// Envia convite real por e-mail via Supabase Auth Admin API (service_role).
// NUNCA rodar isso no frontend — só aqui, no servidor.
//
// Deploy: supabase functions deploy invite-user
// (ou cole este arquivo no editor de Edge Functions do Dashboard)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

Deno.serve(async (req) => {
  // Preflight do navegador — precisa responder OK com os headers de CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) return json({ error: 'Não autenticado' }, 401)

    const { data: callerProfile } = await anonClient
      .from('profiles').select('role, organization_id').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['admin', 'manager', 'platform_admin'].includes(callerProfile.role)) {
      return json({ error: 'Sem permissão para convidar usuários' }, 403)
    }

    const { email, full_name, role, organization_id } = await req.json()
    if (!email) return json({ error: 'email é obrigatório' }, 400)

    // Só o platform_admin (dono do SaaS) pode escolher a organização de destino —
    // admin/manager normal sempre convida para a própria organização, nunca para outra.
    let targetOrgId = callerProfile.organization_id
    if (callerProfile.role === 'platform_admin') {
      if (!organization_id) return json({ error: 'organization_id é obrigatório para platform_admin' }, 400)
      const admin0 = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: org } = await admin0.from('organizations').select('id').eq('id', organization_id).maybeSingle()
      if (!org) return json({ error: 'Organização não encontrada' }, 400)
      targetOrgId = organization_id
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name ?? null,
        role: role ?? 'consultant',
        organization_id: targetOrgId,
      },
      // Para onde o link do e-mail leva depois que a pessoa define a senha.
      // Troque pela URL de produção real se for diferente.
      redirectTo: 'https://sap-project-governance-platform.vercel.app/login',
    })
    if (error) return json({ error: error.message }, 400)

    return json({ user: data.user })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
