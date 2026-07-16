import { supabase } from '../supabaseClient'
import { fetchAllRows } from '../fetchAllRows'

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

interface DonRow {
  id: string
  id_externe: string | null
  montant: number
  date: string
  mode_paiement: string
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
