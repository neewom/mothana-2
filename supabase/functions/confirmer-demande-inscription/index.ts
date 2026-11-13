// Confirmation de l'adresse d'une demande d'inscription, depuis la page publique
// /inscription/confirmer (carte https://trello.com/c/hNqpdZXL). Publique : déployée avec
// --no-verify-jwt. Logique dans traitement.ts :
//   1. corps {jeton, site_url} validé (400 sinon) ;
//   2. RPC confirmer_demande_inscription (service_role) avec l'empreinte SHA-256 du jeton :
//      limite par IP (10 / heure, 429), puis a_confirmer → en_attente si le jeton est valide ;
//   3. notification du super-admin (secret INSCRIPTION_NOTIF_EMAIL) à la confirmation seulement,
//      envoyée après la réponse.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { empreinteJeton } from '../_shared/jetonConfirmation.ts'
import { traiterConfirmation, type ResultatRpcConfirmation } from './traitement.ts'

// Tâches poursuivies après la réponse (runtime Supabase Edge) ; absent en local → attendues.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHODE_NON_AUTORISEE' }, 405)

  try {
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const notif = Deno.env.get('INSCRIPTION_NOTIF_EMAIL')?.trim() || null
    if (!notif) console.error('confirmer-demande-inscription : INSCRIPTION_NOTIF_EMAIL absent, pas de notification')

    const reponse = await traiterConfirmation(await req.text(), {
      hashIp: () => hashClientIp(req),
      empreinte: empreinteJeton,
      confirmer: async (ipHash, jetonHash) => {
        const { data, error } = await adminClient.rpc('confirmer_demande_inscription', {
          p_ip_hash: ipHash,
          p_jeton_hash: jetonHash,
        })
        if (error) {
          console.error('confirmer_demande_inscription :', error.code, error.message)
          return null
        }
        return data as ResultatRpcConfirmation
      },
      envoyer: async (destinataire, email) => {
        const envoi = await sendViaResend(destinataire, email.sujet, email.html, {
          tags: [{ name: 'parcours', value: 'inscription' }],
        })
        if (!envoi.ok) console.error('confirmer-demande-inscription : envoi en échec', envoi.status)
      },
      emailNotification: notif,
      arrierePlan: (tache) => {
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(tache)
      },
    })
    return json(reponse.body, reponse.status, reponse.headers)
  } catch (err) {
    console.error('confirmer-demande-inscription :', err)
    return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
  }
})
