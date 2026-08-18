import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Réponse générique dans tous les cas — évite de révéler si un token est valide
  const genericResponse = () =>
    new Response(
      JSON.stringify({ message: 'Si ce lien est valide, vous ne recevrez plus nos emails de campagnes mailing.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return genericResponse()
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { error } = await adminClient
      .from('adherents')
      .update({ mailing_opt_out: true, mailing_opt_out_at: new Date().toISOString() })
      .eq('mailing_unsubscribe_token', token)

    if (error) {
      console.error('unsubscribe-mailing update error:', error)
    }

    return genericResponse()
  } catch (err) {
    console.error('unsubscribe-mailing error:', err)
    return genericResponse()
  }
})
