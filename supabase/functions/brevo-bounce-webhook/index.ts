import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cibleRejet } from '../_shared/brevo.ts'
import { classerRejet, normaliserEmail } from '../_shared/brevoRejets.ts'
import { secretsEgaux } from '../_shared/webhookSecret.ts'

// Reçoit les événements webhook Brevo (hard_bounce, soft_bounce, invalid_email, blocked, error) sur les
// campagnes mailing envoyées via send-mailing-brevo et les reçus fiscaux envoyés via
// send-recu-email (API transactionnelle Brevo /v3/smtp/email). Un email de reçu porte les tags
// `recu-fiscal` et `profil:<profil_participant_id>` (_shared/brevo.ts) : son rejet marque le profil
// du donateur dans l'organisation ; tout autre rejet marque les adhérents de l'organisation dont le courriel correspond (sans casse ni espaces de bord). Volet 2 de la carte Trello "Détection d'emails
// adhérents invalides (bounce)". Enregistré automatiquement par
// register-brevo-webhook dès qu'un admin configure sa clé API Brevo.
//
// Brevo ne signe pas ses webhooks : l'URL enregistrée par register-brevo-webhook porte un
// secret aléatoire propre à l'organisation (?org=<uuid>&secret=<hex>, dans
// organisation_secrets), vérifié ici avant tout traitement (audit sécurité 2026-10-24 :
// l'UUID seul, public, permettait à n'importe qui de marquer des adresses invalides).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tri des événements par `classerRejet` (_shared/brevoRejets.ts) : adresse invalide marque
// toujours ; hard bounce / blocked / error / soft bounce seulement si la raison ne met pas en cause
// l'expéditeur, le domaine d'envoi ou le compte Brevo (soft bounce : domaine introuvable seul). Correction du 2026-10-23 : les `error`
// du 2026-09-10 (@exemple.fr), pris pour des domaines sans MX, étaient en fait des refus
// d'expéditeur non validé ; le vrai « MX introuvable » arrive en softBounce, souscrit depuis le
// 2026-11-08 : un soft bounce ne marque que si le domaine est introuvable (autres : temporaires).
// Noms d'événement : le payload utilise hard_bounce / invalid_email (constaté en prod : aucun
// hardBounce n'avait jamais été marqué) ; les deux formes sont acceptées.

interface BrevoEvent {
  event?: string
  email?: string
  reason?: string
  tags?: unknown
  tag?: unknown
}

interface Marquage {
  evenement: string
  raison: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const organisationId = new URL(req.url).searchParams.get('org')
    if (!organisationId) {
      return new Response(JSON.stringify({ error: 'Paramètre org manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const secretRecu = new URL(req.url).searchParams.get('secret')
    const { data: secrets } = await adminClient
      .from('organisation_secrets')
      .select('brevo_webhook_secret')
      .eq('organisation_id', organisationId)
      .maybeSingle()
    if (!secretsEgaux(secretRecu, secrets?.brevo_webhook_secret ?? null)) {
      console.warn('brevo-bounce-webhook: secret absent ou invalide pour', organisationId)
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const events: BrevoEvent[] = Array.isArray(body) ? body : [body]

    // Une décision par adresse (la dernière reçue l'emporte), séparément pour les adhérents et les
    // donateurs (profil connu par son tag, sinon retrouvé par l'adresse dans l'organisation).
    const adherentsParEmail = new Map<string, Marquage>()
    const profilsAMarquer = new Map<string, Marquage>()
    const donateursParEmail = new Map<string, Marquage>()
    for (const e of events) {
      if (!e.email) continue
      const decision = classerRejet(e.event, e.reason)
      if (decision.marquer) {
        const marquage = { evenement: decision.evenement, raison: decision.raison }
        const cible = cibleRejet(e)
        if (cible.type === 'adherent') adherentsParEmail.set(normaliserEmail(e.email), marquage)
        else if (cible.profilParticipantId) profilsAMarquer.set(cible.profilParticipantId, marquage)
        else donateursParEmail.set(normaliserEmail(e.email), marquage)
      } else if (decision.motif === 'cote_expediteur') {
        // Jamais imputé au destinataire : à corriger côté expéditeur / compte Brevo.
        console.warn('brevo-bounce-webhook: rejet côté expéditeur ignoré', e.event, e.reason)
      }
    }

    // Donateur sans tag de profil : profils de l'organisation dont la personne a cette adresse,
    // comparée sans casse ni espaces de bord (RPC profils_donateur_par_emails, service_role seul).
    if (donateursParEmail.size > 0) {
      const { data: profils, error } = await adminClient.rpc('profils_donateur_par_emails', {
        p_organisation_id: organisationId,
        p_emails: [...donateursParEmail.keys()],
      })
      if (error) {
        console.error('profils_donateur_par_emails error:', error.code, error.message)
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      for (const p of (profils ?? []) as { profil_id: string; email_normalise: string }[]) {
        const marquage = donateursParEmail.get(p.email_normalise)
        if (marquage) profilsAMarquer.set(p.profil_id, marquage)
      }
    }

    // Adhérents : retrouvés par adresse comparée sans casse ni espaces de bord (RPC
    // adherents_par_emails, service_role seul), puis marqués par id.
    const adherentsAMarquer = new Map<string, Marquage>()
    if (adherentsParEmail.size > 0) {
      const { data: adherents, error } = await adminClient.rpc('adherents_par_emails', {
        p_organisation_id: organisationId,
        p_emails: [...adherentsParEmail.keys()],
      })
      if (error) {
        console.error('adherents_par_emails error:', error.code, error.message)
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      for (const a of (adherents ?? []) as { adherent_id: string; email_normalise: string }[]) {
        const marquage = adherentsParEmail.get(a.email_normalise)
        if (marquage) adherentsAMarquer.set(a.adherent_id, marquage)
      }
    }

    const maintenant = new Date().toISOString()
    for (const [profilId, { evenement, raison }] of profilsAMarquer) {
      // Filtré par organisation : un tag d'une autre organisation ne marque rien.
      const { error } = await adminClient
        .from('profils_participant')
        .update({ email_invalide_at: maintenant, email_invalide_evenement: evenement, email_invalide_raison: raison })
        .eq('organisation_id', organisationId)
        .eq('id', profilId)
      if (error) {
        console.error('profils_participant update error:', error.code, error.message)
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (adherentsParEmail.size === 0 && profilsAMarquer.size === 0) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const [adherentId, { evenement, raison }] of adherentsAMarquer) {
      // Filtré par organisation, comme les profils : seul un adhérent de l'organisation authentifiée.
      const { error } = await adminClient
        .from('adherents')
        .update({ email_invalide_at: maintenant, email_invalide_evenement: evenement, email_invalide_raison: raison })
        .eq('organisation_id', organisationId)
        .eq('id', adherentId)

      if (error) {
        console.error('adherents update error:', error)
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ ok: true, emails: adherentsParEmail.size, profils: profilsAMarquer.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('brevo-bounce-webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
