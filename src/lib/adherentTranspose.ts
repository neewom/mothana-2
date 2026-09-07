import { supabase } from './supabaseClient'
import { generateUUID } from './uuid'
import type { ProfilParticipant, Civilite } from '../types'

// Champs disponibles selon le rôle qui déclenche la transposition — un bénévole
// n'a accès qu'à un sous-ensemble restreint via search_adherents_verification
// (nom/prénom/statut/date_fin), un admin à la fiche complète via search_adherents.
// Tous les champs au-delà de nom/prenom sont donc optionnels ici.
export interface AdherentPourTransposition {
  nom: string
  prenom: string | null
  civilite?: number | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  courriel?: string | null
}

export interface ParticipantEnAttente {
  // Objet ProfilParticipant complet, utilisable immédiatement côté UI
  // (autocomplete, sélection) — mais rien n'a encore été écrit en base.
  participant: ProfilParticipant
  // Écrit réellement personnes + profils_participant en base, avec les ids
  // déjà réservés dans `participant.id`/`personne_id` — appelé seulement à la
  // validation de la saisie du don, pas au moment de la confirmation de
  // l'adhérent (cf. cadrage : le doublonnement ne doit être effectif qu'à la
  // validation du don, pas avant — sinon un don annulé laisserait un donateur
  // fantôme en base).
  persist: () => Promise<string | null>
}

// adherents.civilite : 0=non défini, 1=M., 2=Mme — enum réduit, distinct de
// personnes.civilite (7 valeurs). Pas d'ambiguïté : adherents n'a pas les
// valeurs personne morale/famille de personnes.
function mapCivilite(civilite?: number | null): Civilite | null {
  if (civilite === 1) return 1
  if (civilite === 2) return 2
  return null
}

export function preparerParticipantDepuisAdherent(
  adherent: AdherentPourTransposition,
  organisationId: string
): ParticipantEnAttente {
  // Ids générés côté client dès la préparation (même pattern que
  // ParticipantModal.tsx) — réservés tout de suite pour que l'UI (autocomplete,
  // profilParticipantId) puisse les référencer avant même que les lignes
  // existent en base.
  const personneId = generateUUID()
  const profilId = generateUUID()
  const civilite = mapCivilite(adherent.civilite)

  const participant: ProfilParticipant = {
    id: profilId,
    personne_id: personneId,
    organisation_id: organisationId,
    notes: null,
    id_externe: null,
    created_at: new Date().toISOString(),
    personnes: {
      id: personneId,
      nom: adherent.nom,
      prenom: adherent.prenom,
      email: adherent.courriel ?? null,
      telephone: adherent.telephone ?? null,
      civilite,
      adresse: adherent.adresse ?? null,
      code_postal: adherent.code_postal ?? null,
      ville: adherent.ville ?? null,
      pays: null,
      nom2: null,
      prenom2: null,
    },
  }

  async function persist(): Promise<string | null> {
    const { error: personneErr } = await supabase.from('personnes').insert({
      id: personneId,
      nom: adherent.nom,
      prenom: adherent.prenom,
      civilite,
      adresse: adherent.adresse ?? null,
      code_postal: adherent.code_postal ?? null,
      ville: adherent.ville ?? null,
      telephone: adherent.telephone ?? null,
      email: adherent.courriel ?? null,
    })

    if (personneErr) return personneErr.message

    const { error: profilErr } = await supabase.from('profils_participant').insert({
      id: profilId,
      personne_id: personneId,
      organisation_id: organisationId,
    })

    return profilErr ? profilErr.message : null
  }

  return { participant, persist }
}
