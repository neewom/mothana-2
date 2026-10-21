import { supabase } from './supabaseClient'
import type { Adhesion } from '../types'

// Dernière adhésion de chaque adhérent — même ordre que search_adherents (`a_jour` / `expire`) :
// date d'adhésion la plus récente, puis date de fin la plus tardive (vide en premier).

// 100 identifiants par requête : URL bornée, et quelques cycles par adhérent restent bien sous la
// limite PostgREST de 1 000 lignes par appel.
const ADHESIONS_PAR_APPEL = 100

/** Dernière adhésion de chaque adhérent, par paquets d'identifiants. */
export async function chargerDernieresAdhesions(ids: string[]): Promise<Map<string, Adhesion>> {
  const map = new Map<string, Adhesion>()
  for (let i = 0; i < ids.length; i += ADHESIONS_PAR_APPEL) {
    const { data } = await supabase
      .from('adhesions')
      .select('*')
      .in('adherent_id', ids.slice(i, i + ADHESIONS_PAR_APPEL))
      .order('date_debut', { ascending: false })
      .order('date_fin', { ascending: false, nullsFirst: true })
    for (const adhesion of (data ?? []) as Adhesion[]) {
      if (!map.has(adhesion.adherent_id)) map.set(adhesion.adherent_id, adhesion)
    }
  }
  return map
}

export interface AdherentARenouveler {
  adherentId: string
  nom: string
  prenom: string | null
  dateFin: string
}

/**
 * Adhérents dont la **dernière** adhésion se termine entre `today` et `horizon` (inclus), de la
 * plus proche échéance à la plus lointaine. Un adhérent qui a déjà renouvelé (adhésion plus
 * récente) n'y figure pas, même si son ancienne adhésion expire dans la période.
 */
export function adherentsARenouveler(
  adherents: { id: string; nom: string; prenom: string | null }[],
  dernieres: Map<string, Pick<Adhesion, 'date_fin'>>,
  today: string,
  horizon: string,
): AdherentARenouveler[] {
  return adherents
    .flatMap((a) => {
      const dateFin = dernieres.get(a.id)?.date_fin
      return dateFin && dateFin >= today && dateFin <= horizon
        ? [{ adherentId: a.id, nom: a.nom, prenom: a.prenom, dateFin }]
        : []
    })
    .sort((x, y) => x.dateFin.localeCompare(y.dateFin) || x.nom.localeCompare(y.nom, 'fr'))
}
