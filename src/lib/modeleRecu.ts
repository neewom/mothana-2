import type { ModeleRecu } from '../types'

export const MENTION_LEGALE_DEFAUT = "Organisme d'intérêt général éligible au mécénat – article 200 du CGI"

export const DEFAULT_MODELE: ModeleRecu = {
  rna: '',
  siren: '',
  objet_social: '',
  mention_legale: MENTION_LEGALE_DEFAUT,
  numero_recu_depart: 1,
  taux_reduction: 66,
  president_nom: '',
  president_titre: '',
}
