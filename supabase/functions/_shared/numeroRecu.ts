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

// Numéro de donateur tel qu'il figure sur le reçu (placeholder numero_donateur) : même valeur
// nettoyée que celle qui sert au numéro du reçu.
export function numeroDonateurAffiche(idExterne: string | null | undefined): string {
  return (idExterne ?? '').trim()
}

// Message renvoyé (409) quand un numéro nouvellement attribué est déjà porté par un autre reçu
// de l'organisation (garde applicative, objet Storage existant ou index unique en base).
export function messageNumeroDejaPris(format: FormatNumeroRecu, numero: string): string {
  if (format === 'donateur') {
    return `Le numéro de reçu ${numero} est déjà porté par un autre reçu de cette année (cela arrive notamment quand les deux formats de numérotation ont été utilisés dans la même année). Aucun reçu n'a été créé : contactez le support.`
  }
  return `Le numéro de reçu ${numero} est déjà porté par un autre reçu de l'organisation. Aucun reçu n'a été créé : un nouvel essai attribuera le numéro suivant.`
}

// Refus du Storage quand l'objet existe déjà (upload avec upsert: false).
export function estConflitStorage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown }
  return (
    String(e.status) === '409' ||
    String(e.statusCode) === '409' ||
    (typeof e.message === 'string' && /already exists/i.test(e.message))
  )
}

// ---------------------------------------------------------------------------
// Versions d'un reçu (docs/regles-recus-fiscaux.md §5) : chaque génération crée une version et un
// nouveau fichier, jamais écrasé. La version 1 garde le nom historique <numéro>.pdf (fichiers déjà
// émis, repris tels quels comme version 1), les suivantes sont suffixées : <numéro>-v<N>.pdf.
// ---------------------------------------------------------------------------

export function cheminFichierRecu(organisationId: string, annee: number, numero: string, version: number): string {
  const suffixe = version > 1 ? `-v${version}` : ''
  return `${organisationId}/${annee}/${numero}${suffixe}.pdf`
}

// Version créée par la prochaine génération, calculée comme enregistrer_version_recu : après la
// dernière version enregistrée ; sans version enregistrée, un reçu dont le fichier actuel existe
// (antérieur aux versions) a implicitement une version 1, que la fonction SQL crée avant la 2 ; sans
// fichier ni version (nouveau reçu, ou fiche sans fichier_url), la génération crée la version 1.
export function prochaineVersionRecu(fichierAnterieur: boolean, derniereVersion: number | null | undefined): number {
  if (derniereVersion != null) return derniereVersion + 1
  return fichierAnterieur ? 2 : 1
}

// Message renvoyé (409) quand une autre génération du même reçu a eu lieu en même temps.
export const MESSAGE_GENERATION_SIMULTANEE =
  "Une autre génération de ce reçu vient d'avoir lieu en même temps : aucune nouvelle version n'a été créée. Rechargez la page puis réessayez si besoin."
