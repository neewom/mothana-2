import { supabase } from '../supabaseClient'
import { fetchAllRows } from '../fetchAllRows'
import type { ModePaiement } from '../../types'

export interface ExistingRef {
  id: string
  personneId?: string
  /** Valeurs actuelles, clés alignées sur les FieldDef.key de l'entité, pour comparaison avec les valeurs importées. */
  values: Record<string, unknown>
}

interface ParticipantRow {
  id: string
  personne_id: string
  id_externe: string | null
  notes: string | null
  personnes: {
    nom: string
    prenom: string | null
    civilite: number | null
    email: string | null
    telephone: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
    pays: string | null
    nom2: string | null
    prenom2: string | null
  } | null
}

export async function fetchExistingParticipants(organisationId: string): Promise<Map<string, ExistingRef>> {
  const { data } = await fetchAllRows<ParticipantRow>((from, to) =>
    supabase
      .from('profils_participant')
      .select(
        'id, personne_id, id_externe, notes, personnes(nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2)'
      )
      .eq('organisation_id', organisationId)
      .not('id_externe', 'is', null)
      .range(from, to) as unknown as PromiseLike<{ data: ParticipantRow[] | null; error: { message: string } | null }>
  )

  const map = new Map<string, ExistingRef>()
  for (const row of data) {
    if (!row.id_externe) continue
    const p = row.personnes
    map.set(row.id_externe, {
      id: row.id,
      personneId: row.personne_id,
      values: {
        nom: p?.nom ?? null,
        prenom: p?.prenom ?? null,
        civilite: p?.civilite ?? null,
        email: p?.email ?? null,
        telephone: p?.telephone ?? null,
        adresse: p?.adresse ?? null,
        code_postal: p?.code_postal ?? null,
        ville: p?.ville ?? null,
        pays: p?.pays ?? null,
        nom2: p?.nom2 ?? null,
        prenom2: p?.prenom2 ?? null,
        notes: row.notes ?? null,
      },
    })
  }
  return map
}

interface ActiviteRow {
  id: string
  id_externe: string | null
  nom: string
  date_debut: string | null
  date_fin: string | null
}

export async function fetchExistingActivites(organisationId: string): Promise<Map<string, ExistingRef>> {
  const { data } = await fetchAllRows<ActiviteRow>((from, to) =>
    supabase
      .from('activites')
      .select('id, id_externe, nom, date_debut, date_fin')
      .eq('organisation_id', organisationId)
      .not('id_externe', 'is', null)
      .range(from, to) as unknown as PromiseLike<{ data: ActiviteRow[] | null; error: { message: string } | null }>
  )

  const map = new Map<string, ExistingRef>()
  for (const row of data) {
    if (!row.id_externe) continue
    map.set(row.id_externe, {
      id: row.id,
      values: { nom: row.nom, date_debut: row.date_debut, date_fin: row.date_fin },
    })
  }
  return map
}

interface AdherentRow {
  id: string
  id_externe: string | null
  civilite: number
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  telephone: string | null
  courriel: string | null
}

interface LatestAdhesionRow {
  adherent_id: string
  date_debut: string
  montant_cotisation: number | null
  date_paiement_cotisation: string | null
  mode_paiement: number | null
  droit_vote_ag: boolean
  bulletin_signe: boolean
}

export interface ExistingAdherentRef extends ExistingRef {
  /** Champs de la dernière adhésion (historisation) — null si l'adhérent n'en a encore aucune. */
  latestAdhesion: Record<string, unknown> | null
}

export async function fetchExistingAdherents(organisationId: string): Promise<Map<string, ExistingAdherentRef>> {
  const { data } = await fetchAllRows<AdherentRow>((from, to) =>
    supabase
      .from('adherents')
      .select('id, id_externe, civilite, nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel')
      .eq('organisation_id', organisationId)
      .not('id_externe', 'is', null)
      .range(from, to) as unknown as PromiseLike<{ data: AdherentRow[] | null; error: { message: string } | null }>
  )

  const map = new Map<string, ExistingAdherentRef>()
  const idExterneByAdherentId = new Map<string, string>()

  for (const row of data) {
    if (!row.id_externe) continue
    map.set(row.id_externe, {
      id: row.id,
      values: {
        civilite: row.civilite,
        nom: row.nom,
        prenom: row.prenom,
        date_naissance: row.date_naissance,
        adresse: row.adresse,
        code_postal: row.code_postal,
        ville: row.ville,
        telephone: row.telephone,
        courriel: row.courriel,
      },
      latestAdhesion: null,
    })
    idExterneByAdherentId.set(row.id, row.id_externe)
  }

  if (idExterneByAdherentId.size > 0) {
    // Filtré par organisation via la jointure adherents!inner plutôt que par
    // .in(adherent_id, [...]) — évite une clause IN potentiellement énorme
    // sur les organisations à plusieurs milliers d'adhérents.
    const { data: adhesionsData } = await fetchAllRows<LatestAdhesionRow>((from, to) =>
      supabase
        .from('adhesions')
        .select('adherent_id, date_debut, montant_cotisation, date_paiement_cotisation, mode_paiement, droit_vote_ag, bulletin_signe, adherents!inner(organisation_id)')
        .eq('adherents.organisation_id', organisationId)
        .order('date_debut', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: LatestAdhesionRow[] | null; error: { message: string } | null }>
    )

    const seen = new Set<string>()
    for (const row of adhesionsData) {
      if (seen.has(row.adherent_id)) continue
      seen.add(row.adherent_id)
      const idExterne = idExterneByAdherentId.get(row.adherent_id)
      if (!idExterne) continue
      const ref = map.get(idExterne)
      if (!ref) continue
      ref.latestAdhesion = {
        date_debut: row.date_debut,
        montant_cotisation: row.montant_cotisation,
        date_paiement_cotisation: row.date_paiement_cotisation,
        mode_paiement: row.mode_paiement,
        droit_vote_ag: row.droit_vote_ag,
        bulletin_signe: row.bulletin_signe,
      }
    }
  }

  return map
}

interface DonRow {
  id: string
  id_externe: string | null
  montant: number
  date: string
  mode_paiement: ModePaiement
  profil_participant_id: string
  activite_id: string | null
}

export async function fetchExistingDons(organisationId: string): Promise<Map<string, ExistingRef>> {
  const { data } = await fetchAllRows<DonRow>((from, to) =>
    supabase
      .from('dons')
      .select('id, id_externe, montant, date, mode_paiement, profil_participant_id, activite_id')
      .eq('organisation_id', organisationId)
      .not('id_externe', 'is', null)
      .range(from, to) as unknown as PromiseLike<{ data: DonRow[] | null; error: { message: string } | null }>
  )

  const map = new Map<string, ExistingRef>()
  for (const row of data) {
    if (!row.id_externe) continue
    map.set(row.id_externe, {
      id: row.id,
      values: {
        montant: row.montant,
        date: row.date,
        mode_paiement: row.mode_paiement,
        profil_participant_id: row.profil_participant_id,
        activite_id: row.activite_id,
      },
    })
  }
  return map
}
