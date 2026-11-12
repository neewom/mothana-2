// Demande d'espace Samakan depuis le formulaire public /inscription (carte https://trello.com/c/hNqpdZXL).
// Publique : déployée avec --no-verify-jwt. Logique dans traitement.ts :
//   1. champ piège rempli → succès apparent, rien n'est écrit ni envoyé ;
//   2. validation complète côté serveur (_shared/inscription.ts, partagé avec le formulaire) ;
//   3. RPC soumettre_demande_inscription (service_role) : limites par IP (429), plafond global
//      quotidien (429), accusés par adresse, cas (nouvelle / compte existant / déjà en attente)
//      et insertion, dans une transaction ;
//   4. accusé de réception adapté au cas, et notification du super-admin pour une nouvelle demande
//      (secret INSCRIPTION_NOTIF_EMAIL), envoyés après la réponse.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp, hashValeur } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { CGU_PUBLIEES } from '../_shared/cgu.ts'
import { traiterSoumission, type ResultatRpc } from './traitement.ts'

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
    if (!notif) console.error('soumettre-demande-inscription : INSCRIPTION_NOTIF_EMAIL absent, pas de notification')

    const reponse = await traiterSoumission(await req.text(), {
      hashIp: () => hashClientIp(req),
      hashEmail: (email) => hashValeur(`inscription:${email}`),
      soumettre: async (ipHash, emailHash, demande) => {
        const { data, error } = await adminClient.rpc('soumettre_demande_inscription', {
          p_ip_hash: ipHash,
          p_email_hash: emailHash,
          p_demande: demande,
        })
        if (error) {
          console.error('soumettre_demande_inscription :', error.code, error.message)
          return null
        }
        return data as ResultatRpc
      },
      envoyer: async (destinataire, email) => {
        const envoi = await sendViaResend(destinataire, email.sujet, email.html, {
          tags: [{ name: 'parcours', value: 'inscription' }],
        })
        if (!envoi.ok) console.error('soumettre-demande-inscription : envoi en échec', envoi.status)
      },
      emailNotification: notif,
      cguPubliees: CGU_PUBLIEES,
      arrierePlan: (tache) => {
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(tache)
      },
    })
    return json(reponse.body, reponse.status, reponse.headers)
  } catch (err) {
    console.error('soumettre-demande-inscription :', err)
    return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
  }
})
