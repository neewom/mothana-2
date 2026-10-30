// Résultat du réenregistrement global des webhooks Brevo (register-brevo-webhook,
// { toutes_organisations: true }, bouton de /super-admin) : une ligne par organisation
// ayant une clé Brevo.

export interface ResultatWebhookOrganisation {
  organisation_id: string
  nom: string | null
  ok?: true
  already_registered?: boolean
  skipped?: true
  reason?: string
  error?: string
  status?: number
}

export type StatutWebhook = 'cree' | 'mis_a_jour' | 'ignore' | 'erreur'

export interface LigneResultatWebhook {
  organisationId: string
  nom: string
  statut: StatutWebhook
  libelle: string
  detail: string | null
}

const LIBELLES: Record<StatutWebhook, string> = {
  cree: 'Créé',
  mis_a_jour: 'Mis à jour',
  ignore: 'Ignoré (sans clé)',
  erreur: 'Erreur',
}

export function interpreterResultatWebhook(r: ResultatWebhookOrganisation): LigneResultatWebhook {
  let statut: StatutWebhook
  let detail: string | null = null
  if (r.error) {
    statut = 'erreur'
    detail = r.error
  } else if (r.skipped) {
    statut = 'ignore'
  } else if (r.ok) {
    statut = r.already_registered ? 'mis_a_jour' : 'cree'
  } else {
    statut = 'erreur'
    detail = 'Réponse inattendue'
  }
  return {
    organisationId: r.organisation_id,
    nom: r.nom?.trim() || r.organisation_id,
    statut,
    libelle: LIBELLES[statut],
    detail,
  }
}

export function interpreterResultatsWebhooks(resultats: ResultatWebhookOrganisation[]): LigneResultatWebhook[] {
  return resultats
    .map(interpreterResultatWebhook)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
