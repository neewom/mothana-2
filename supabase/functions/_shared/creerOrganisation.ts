// Cœur de création d'une organisation (carte https://trello.com/c/3sMxN5w5) : une seule
// fonction SQL `creer_organisation` (service_role), donc tout ou rien — organisation, slug,
// modèles de reçus Cerfa et modèle de carte d'adhérent par défaut.
//
// Appelé aujourd'hui par l'Edge Function creer-organisation (super-admin). Prévu pour être
// réutilisé tel quel par l'inscription publique : slug fourni (rendu unique par l'appelant),
// fonctionnalités et champs du modèle de reçu (RNA, SIREN…) optionnels. Le contrôle du droit
// de l'appelant reste à la charge de l'Edge Function.
import { DEFAULT_CERFA_TEMPLATES } from './defaultCerfaTemplates.ts'
import { CARTE_ADHERENT_CSS, CARTE_ADHERENT_HTML, DEFAULT_CARTE_ADHERENT_NOM } from './defaultCarteAdherentTemplate.ts'
import { slugifyUrl } from './slug.ts'

export const MESSAGE_NOM_INVALIDE = 'Nom invalide pour générer un identifiant'
export const MESSAGE_SLUG_INVALIDE = 'Identifiant d’adresse (slug) invalide'
export const MESSAGE_DOUBLON = 'Une organisation avec un nom équivalent existe déjà'

/**
 * Seuls modules activables à la création (carte hNqpdZXL) : jamais `evenements` ni
 * `credit_manuel`, qui restent à la main du super-admin après coup.
 */
export const FONCTIONNALITES_CREATION = ['dons', 'adherents'] as const

/** Garde des fonctionnalités fournies que les clés autorisées à valeur booléenne ; null si rien. */
export function filtrerFonctionnalitesCreation(
  fonctionnalites: Record<string, unknown> | undefined,
): Record<string, boolean> | null {
  if (!fonctionnalites) return null
  const filtre: Record<string, boolean> = {}
  for (const cle of FONCTIONNALITES_CREATION) {
    if (typeof fonctionnalites[cle] === 'boolean') filtre[cle] = fonctionnalites[cle] as boolean
  }
  return Object.keys(filtre).length > 0 ? filtre : null
}

export interface CreerOrganisationParams {
  nom: string
  /** Slug imposé (ex. rendu unique par l'inscription) ; par défaut slugifyUrl(nom). */
  slug?: string
  /**
   * Fusionné dans `fonctionnalites_activees` ; absent = valeurs par défaut de la colonne.
   * Filtré sur FONCTIONNALITES_CREATION (ici et dans la fonction SQL).
   */
  fonctionnalitesActivees?: Record<string, boolean>
  /** Fusionné dans `modele_recu_pdf` (rna, siren…) ; absent = valeur par défaut. */
  modeleRecuPdf?: Record<string, unknown>
  /** organisations.ville (inscription) ; absente ou vide = NULL. */
  ville?: string
}

export type CreerOrganisationResultat =
  | { ok: true; organisationId: string }
  | { ok: false; code: 'NOM_INVALIDE' | 'SLUG_INVALIDE' | 'DOUBLON' | 'ERREUR'; message: string }

// Sous-ensemble du client supabase-js utilisé ici (client service_role), pour les tests.
export interface ClientRpc {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>
}

/** Arguments de la fonction SQL, ou erreur de validation (sans appel serveur). */
export function argumentsCreation(
  params: CreerOrganisationParams,
): { ok: true; args: Record<string, unknown> } | { ok: false; code: 'NOM_INVALIDE'; message: string } {
  const nom = typeof params.nom === 'string' ? params.nom : ''
  const slug = params.slug ?? slugifyUrl(nom)
  if (!nom.trim() || !slug) return { ok: false, code: 'NOM_INVALIDE', message: MESSAGE_NOM_INVALIDE }
  return {
    ok: true,
    args: {
      p_nom: nom,
      p_slug: slug,
      p_templates_recu: DEFAULT_CERFA_TEMPLATES.map((t) => ({
        nom: t.nom,
        type_cerfa: t.type_cerfa,
        html_template: t.html_template,
        css: t.css,
      })),
      p_template_carte: { nom: DEFAULT_CARTE_ADHERENT_NOM, html_template: CARTE_ADHERENT_HTML, css: CARTE_ADHERENT_CSS },
      p_fonctionnalites_activees: filtrerFonctionnalitesCreation(params.fonctionnalitesActivees),
      p_modele_recu_pdf: params.modeleRecuPdf ?? null,
      p_ville: params.ville?.trim() || null,
    },
  }
}

export async function creerOrganisation(
  client: ClientRpc,
  params: CreerOrganisationParams,
): Promise<CreerOrganisationResultat> {
  const prep = argumentsCreation(params)
  if (!prep.ok) return prep
  const { data, error } = await client.rpc('creer_organisation', prep.args)
  if (error) {
    // Seule contrainte d'unicité atteignable avec les modèles par défaut : le slug.
    if (error.code === '23505' && error.message.includes('organisations_slug_unique')) return { ok: false, code: 'DOUBLON', message: MESSAGE_DOUBLON }
    if (error.message.includes('SLUG_INVALIDE')) return { ok: false, code: 'SLUG_INVALIDE', message: MESSAGE_SLUG_INVALIDE }
    if (error.message.includes('NOM_INVALIDE')) return { ok: false, code: 'NOM_INVALIDE', message: MESSAGE_NOM_INVALIDE }
    return { ok: false, code: 'ERREUR', message: error.message }
  }
  if (typeof data !== 'string') return { ok: false, code: 'ERREUR', message: 'Réponse inattendue du serveur' }
  return { ok: true, organisationId: data }
}
