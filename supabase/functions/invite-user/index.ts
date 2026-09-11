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
    if (!callerProfile || !['admin', 'manager'].includes(callerProfile.role)) {
      return json({ error: 'Sem permissão para convidar usuários' }, 403)
    }

    const { email, full_name, role } = await req.json()
    if (!email) return json({ error: 'email é obrigatório' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name ?? null,
        role: role ?? 'consultant',
        organization_id: callerProfile.organization_id,
      },
    })
    if (error) return json({ error: error.message }, 400)

    return json({ user: data.user })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
