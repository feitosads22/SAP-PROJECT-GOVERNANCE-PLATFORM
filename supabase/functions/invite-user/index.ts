// Edge Function: invite-user
// Envia convite real por e-mail via Supabase Auth Admin API (service_role).
// NUNCA rodar isso no frontend — só aqui, no servidor.
//
// Deploy: supabase functions deploy invite-user
// (ou cole este arquivo no editor de Edge Functions do Dashboard)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })

    const { data: callerProfile } = await anonClient
      .from('profiles').select('role, organization_id').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['admin', 'manager'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Sem permissão para convidar usuários' }), { status: 403 })
    }

    const { email, full_name, role } = await req.json()
    if (!email) return new Response(JSON.stringify({ error: 'email é obrigatório' }), { status: 400 })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name ?? null,
        role: role ?? 'consultant',
        organization_id: callerProfile.organization_id,
      },
    })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
