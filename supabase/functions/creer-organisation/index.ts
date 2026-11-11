// Création d'une organisation par le super-admin, en une opération atomique
// (carte https://trello.com/c/3sMxN5w5). Cœur partagé : _shared/creerOrganisation.ts.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerOrganisation } from '../_shared/creerOrganisation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Authorization header manquant' }, 401)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // Jeton vérifié par l'auth (signature contrôlée), droit lu dans app_metadata côté serveur.
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) return json({ error: 'Session invalide' }, 401)
    if (user.app_metadata?.is_super_admin !== true) {
      return json({ error: 'Accès refusé — réservé au super-admin' }, 403)
    }

    const body = await req.json().catch(() => null)
    const nom = body && typeof body.nom === 'string' ? body.nom : ''

    // Le super-admin ne fournit que le nom : slug dérivé, modèles et fonctionnalités par défaut.
    const resultat = await creerOrganisation(adminClient, { nom })
    if (resultat.ok) return json({ organisation_id: resultat.organisationId }, 200)
    if (resultat.code === 'NOM_INVALIDE') return json({ error: resultat.message, code: resultat.code }, 400)
    if (resultat.code === 'DOUBLON') return json({ error: resultat.message, code: resultat.code }, 409)
    console.error('creer-organisation :', resultat.message)
    return json({ error: resultat.message, code: resultat.code }, 500)
  } catch (err) {
    console.error('creer-organisation :', err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
