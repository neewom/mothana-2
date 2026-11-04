// Cœur de l'envoi d'un reçu fiscal par email, partagé par send-recu-email (envoi unitaire, depuis le
// détail d'un reçu) et traiter-lots-recus (lots d'envoi, carte « Reçus en lot 4/5 ») : lecture du
// donateur et de la dernière version du reçu, PDF, modèle d'email de l'organisation, envoi par le
// Brevo de l'organisation ou Resend en secours (envoiRecuEmail.ts ; lots : Brevo seul), puis marquage de la version
// envoyée (recus_fiscaux_versions.email_envoye_le) et du reçu (email_envoye_at, email_canal).
// L'appelant a déjà vérifié les droits sur l'organisation.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { rendreEmailRecu, rendreObjetEmailRecu, valeursEmailRecu } from './recuEmail.ts'
import { type CanalEmail, type DependancesEnvoi, envoyerEmailRecu } from './envoiRecuEmail.ts'

export interface ParametresEnvoiRecu {
  organisationId: string
  profilParticipantId: string
  annee: number
  /** Lot : dernière version déjà envoyée (envoi manuel entre-temps) → succès sans email. */
  seulementSiNonEnvoye?: boolean
  /** Lot : donateur dont l'email est marqué invalide (rejet Brevo) ou au format invalide → refus. */
  refuserEmailInvalide?: boolean
  /** Adresse en .invalid (jamais délivrable) : version marquée envoyée sans aucun email (staging). */
  simulerAdressesInvalid?: boolean
  /** Lot : Brevo seulement, jamais de secours Resend (décision utilisateur, 2026-11-04). */
  sansSecoursResend?: boolean
}

export type CanalEnvoiRecu = CanalEmail | 'simulation'

export type ResultatEnvoiRecuDonateur =
  | {
      ok: true
      canal: CanalEnvoiRecu | null
      motifSecours: string | null
      recuId: string
      versionId: string | null
      envoyeLe: string | null
      /** Dernière version déjà envoyée : aucun email (seulementSiNonEnvoye). */
      dejaEnvoye: boolean
      email: string
    }
  | {
      ok: false
      status: number
      error: string
      /** Envoi ambigu (Brevo ou Resend) : l'email a pu partir, ne pas renvoyer. */
      incertain: boolean
    }

const FORMAT_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Domaine de premier niveau .invalid (RFC 2606) : réservé, jamais délivrable. */
export function adresseNonDelivrable(email: string): boolean {
  return /\.invalid$/i.test(email.trim())
}

export function formatEmailValide(email: string): boolean {
  return FORMAT_EMAIL.test(email.trim())
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function echec(status: number, error: string, incertain = false): ResultatEnvoiRecuDonateur {
  return { ok: false, status, error, incertain }
}

export async function envoyerRecuDonateur(
  adminClient: SupabaseClient,
  params: ParametresEnvoiRecu,
  deps: DependancesEnvoi,
): Promise<ResultatEnvoiRecuDonateur> {
  const { organisationId, profilParticipantId, annee } = params

  // Expéditeur et modèle d'email dans organisations, clé API Brevo dans organisation_secrets.
  const [{ data: org }, { data: secret }] = await Promise.all([
    adminClient
      .from('organisations')
      .select('nom, brevo_expediteur_nom, brevo_expediteur_email, modele_recu_pdf')
      .eq('id', organisationId)
      .single(),
    adminClient.from('organisation_secrets').select('brevo_api_key').eq('organisation_id', organisationId).maybeSingle(),
  ])

  if (!org) return echec(404, 'Organisation introuvable')

  const { data: participant } = await adminClient
    .from('profils_participant')
    .select('id, organisation_id, email_invalide_at, personnes(nom, prenom, email)')
    .eq('id', profilParticipantId)
    .eq('organisation_id', organisationId)
    .single()

  if (!participant) return echec(404, 'Participant introuvable')

  const profil = participant as unknown as {
    email_invalide_at: string | null
    personnes: { nom: string; prenom: string | null; email: string | null }
  }
  const personne = profil.personnes
  const email = personne.email?.trim() ?? ''
  if (!email) return echec(422, 'Aucune adresse email pour ce participant')
  if (params.refuserEmailInvalide) {
    if (!formatEmailValide(email)) return echec(422, 'Adresse email au format invalide')
    if (profil.email_invalide_at) {
      return echec(422, "Email invalide : un envoi précédent à cette adresse n'a pas pu être délivré")
    }
  }

  const { data: recu } = await adminClient
    .from('recus_fiscaux')
    .select('id, fichier_url, montant_total, email_envoye_at')
    .eq('profil_participant_id', profilParticipantId)
    .eq('organisation_id', organisationId)
    .eq('annee', annee)
    .single()

  if (!recu || !recu.fichier_url) return echec(404, 'Aucun reçu généré pour ce participant et cette année')

  // Dernière version du reçu (docs/regles-recus-fiscaux.md §5) : c'est elle qui est envoyée et
  // marquée comme envoyée. Un reçu sans version enregistrée (antérieur aux versions) envoie son
  // fichier actuel.
  const { data: derniereVersion, error: versionError } = await adminClient
    .from('recus_fiscaux_versions')
    .select('id, fichier_url, montant_total, email_envoye_le')
    .eq('recu_id', recu.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (versionError) {
    console.error('recus_fiscaux_versions read error:', versionError)
    return echec(500, 'Erreur lors de la récupération du reçu')
  }

  const versionId = (derniereVersion?.id as string | undefined) ?? null
  if (params.seulementSiNonEnvoye) {
    const dejaEnvoyeLe = derniereVersion ? derniereVersion.email_envoye_le : recu.email_envoye_at
    if (dejaEnvoyeLe) {
      return {
        ok: true, canal: null, motifSecours: null, recuId: recu.id, versionId,
        envoyeLe: dejaEnvoyeLe as string, dejaEnvoye: true, email,
      }
    }
  }

  let canal: CanalEnvoiRecu
  let motifSecours: string | null = null

  if (adresseNonDelivrable(email)) {
    if (!params.simulerAdressesInvalid) {
      return echec(422, 'Adresse non délivrable (domaine .invalid, réservé aux tests)')
    }
    // Simulation (staging) : aucun appel à Brevo ni à Resend, aucun PDF téléchargé.
    canal = 'simulation'
  } else {
    const fichierEnvoye = (derniereVersion?.fichier_url as string | undefined) ?? recu.fichier_url

    const { data: pdfFile, error: downloadError } = await adminClient.storage
      .from('recus-fiscaux')
      .download(fichierEnvoye)

    if (downloadError || !pdfFile) {
      console.error('Storage download error:', downloadError)
      return echec(500, 'Erreur lors de la récupération du PDF')
    }

    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())
    const donateurNom = personne.prenom ? `${personne.prenom} ${personne.nom}` : personne.nom

    // Modèle personnalisé (Paramètres › Reçus fiscaux), sinon le texte par défaut ; valeurs échappées.
    const modele = (org.modele_recu_pdf ?? {}) as { email_objet?: string | null; email_html?: string | null }
    const montant = Number(derniereVersion?.montant_total ?? recu.montant_total)
    const valeurs = valeursEmailRecu({
      prenom: personne.prenom,
      nom: personne.nom,
      annee,
      organisation: org.nom,
      montant: Number.isFinite(montant) ? montant : null,
    })

    const emailResult = await envoyerEmailRecu(
      {
        destinataire: { email, nom: donateurNom },
        objet: rendreObjetEmailRecu(modele.email_objet, valeurs),
        html: rendreEmailRecu(modele.email_html, valeurs),
        pieceJointe: { nom: `recu-fiscal-${annee}.pdf`, contenuBase64: bytesToBase64(pdfBytes) },
        profilParticipantId,
      },
      {
        apiKey: (secret?.brevo_api_key as string | null | undefined) ?? null,
        expediteurNom: org.brevo_expediteur_nom,
        expediteurEmail: org.brevo_expediteur_email,
      },
      deps,
      { sansSecours: params.sansSecoursResend },
    )

    if (!emailResult.ok) {
      console.error('envoyerRecuDonateur: envoi impossible', emailResult.detail)
      // Envoi incertain (Brevo ou Resend) : message explicite, et aucun marquage (email_envoye_at / _le).
      if (emailResult.incertain) return echec(502, emailResult.detail, true)
      // Lot sans secours : Brevo absent ou expéditeur refusé → échec définitif ; refus Brevo 4xx →
      // erreur ordinaire (nouvelle tentative), avec le détail Brevo.
      if (emailResult.definitif) return echec(422, emailResult.detail)
      if (params.sansSecoursResend) return echec(500, emailResult.detail)
      return echec(500, "Erreur lors de l'envoi de l'email")
    }
    canal = emailResult.canal
    motifSecours = emailResult.motifSecours
  }

  // Trace du canal : journal de la fonction + recus_fiscaux.email_canal.
  console.log('envoyerRecuDonateur: envoyé', canal, motifSecours ?? '')

  const envoyeLe = new Date().toISOString()

  if (derniereVersion) {
    const { error: versionUpdateError } = await adminClient
      .from('recus_fiscaux_versions')
      .update({ email_envoye_le: envoyeLe })
      .eq('id', derniereVersion.id)
    if (versionUpdateError) {
      console.error('Update email_envoye_le error:', versionUpdateError)
      // Non bloquant : l'email est parti
    }
  }

  const { error: updateError } = await adminClient
    .from('recus_fiscaux')
    .update({ email_envoye_at: envoyeLe, email_canal: canal })
    .eq('profil_participant_id', profilParticipantId)
    .eq('organisation_id', organisationId)
    .eq('annee', annee)

  if (updateError) {
    console.error('Update email_envoye_at error:', updateError)
    // Non-blocking: email was sent, return success anyway
  }

  return { ok: true, canal, motifSecours, recuId: recu.id, versionId, envoyeLe, dejaEnvoye: false, email }
}
