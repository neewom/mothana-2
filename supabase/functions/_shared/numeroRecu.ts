// Numérotation des reçus fiscaux (docs/regles-recus-fiscaux.md §4).
// Deux formats, réglés par organisation dans modele_recu_pdf.format_numero_recu :
//   - 'sequence' (défaut, clé absente) : séquence annuelle AAAA-NNN (RPC next_numero_recu) ;
//   - 'donateur' : AAAA-<numéro de donateur> (profils_participant.id_externe, tel quel).

export type FormatNumeroRecu = 'sequence' | 'donateur'

export function formatNumeroRecu(valeur: unknown): FormatNumeroRecu {
  return valeur === 'donateur' ? 'donateur' : 'sequence'
}

// Le numéro sert aussi de nom de fichier dans le Storage : seuls chiffres, lettres, tiret et
// tiret bas sont acceptés.
const NUMERO_DONATEUR_VALIDE = /^[0-9A-Za-z_-]+$/

// Numéro « année + numéro de donateur », ou null si le donateur n'a pas de numéro exploitable.
export function numeroRecuDonateur(annee: number, idExterne: string | null | undefined): string | null {
  const numero = (idExterne ?? '').trim()
  if (!numero || !NUMERO_DONATEUR_VALIDE.test(numero)) return null
  return `${annee}-${numero}`
}
