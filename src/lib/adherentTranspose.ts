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

// adherents.civilite : 0=non défini, 1=M., 2=Mme — enum réduit, distinct de
// personnes.civilite (7 valeurs). Pas d'ambiguïté : adherents n'a pas les
// valeurs personne morale/famille de personnes.
function mapCivilite(civilite?: number | null): Civilite | null {
  if (civilite === 1) return 1
  if (civilite === 2) return 2
  return null
}

export async function creerParticipantDepuisAdherent(
  adherent: AdherentPourTransposition,
  organisationId: string
): Promise<{ participant: ProfilParticipant } | { error: string }> {
  // Id générés côté client (même pattern que ParticipantModal.tsx) : évite de
  // dépendre d'un INSERT ... RETURNING, qui exigerait que la ligne soit
  // visible via la policy SELECT (pas garanti pour un bénévole).
  const personneId = generateUUID()
  const profilId = generateUUID()
  const civilite = mapCivilite(adherent.civilite)

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

  if (personneErr) return { error: personneErr.message }

  const { error: profilErr } = await supabase.from('profils_participant').insert({
    id: profilId,
    personne_id: personneId,
    organisation_id: organisationId,
  })

  if (profilErr) return { error: profilErr.message }

  return {
    participant: {
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
    },
  }
}
