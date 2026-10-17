// Complétude de l'adresse postale d'un adhérent pour une campagne courrier : adresse, code postal
// et ville renseignés (un champ fait d'espaces compte comme vide) ; le pays n'est pas exigé.

export interface AdressePostale {
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

const CHAMPS: { key: keyof AdressePostale; label: string }[] = [
  { key: 'adresse', label: 'Adresse' },
  { key: 'code_postal', label: 'Code postal' },
  { key: 'ville', label: 'Ville' },
]

/** Libellés des champs manquants, dans l'ordre d'une adresse. Vide = adresse complète. */
export function champsAdresseManquants(a: AdressePostale): string[] {
  return CHAMPS.filter(({ key }) => !a[key]?.trim()).map(({ label }) => label)
}

/** « Code postal manquant », « Adresse, Code postal manquants »… */
export function libelleChampsManquants(champs: string[]): string {
  return `${champs.join(', ')} manquant${champs.length > 1 ? 's' : ''}`
}
