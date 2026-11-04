// Email d'envoi d'un reçu fiscal (send-recu-email) : modèle par défaut, champs disponibles et rendu.
// Module pur (aucune API Deno) : importé par l'Edge Function et par le front (aperçu dans
// Paramètres › Reçus fiscaux), pour que l'aperçu soit exactement l'email envoyé.
// Le modèle personnalisé est stocké dans organisations.modele_recu_pdf (email_objet, email_html).
// Toute valeur insérée est échappée (renderTemplate) ; le message lui-même est du HTML saisi par un
// administrateur de l'organisation dans l'éditeur riche.
import { escapeHtml, renderTemplate } from './echappementHtml.ts'

export const CHAMPS_EMAIL_RECU = [
  { cle: 'prenom', libelle: 'Prénom' },
  { cle: 'nom', libelle: 'Nom' },
  { cle: 'annee', libelle: 'Année' },
  { cle: 'organisation', libelle: 'Organisation' },
  { cle: 'montant', libelle: 'Montant' },
] as const

export type CleChampEmailRecu = (typeof CHAMPS_EMAIL_RECU)[number]['cle']
export type ValeursEmailRecu = Record<CleChampEmailRecu, string>

// Texte de l'email d'avant la personnalisation (2026-11-04), repris tel quel.
export const EMAIL_RECU_OBJET_DEFAUT = 'Votre reçu fiscal {{annee}} — {{organisation}}'
export const EMAIL_RECU_MESSAGE_DEFAUT =
  '<p>Bonjour {{prenom}} {{nom}},</p>' +
  '<p>Veuillez trouver ci-joint votre reçu fiscal {{annee}} pour vos dons à {{organisation}}, à conserver pour votre déclaration de revenus.</p>'

const LONGUEUR_MAX_OBJET = 200

export function formaterMontantEmail(montant: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)
}

export function valeursEmailRecu(donnees: {
  prenom: string | null
  nom: string
  annee: number
  organisation: string
  montant: number | null
}): ValeursEmailRecu {
  return {
    prenom: donnees.prenom ?? '',
    nom: donnees.nom,
    annee: String(donnees.annee),
    organisation: donnees.organisation,
    montant: donnees.montant === null ? '' : formaterMontantEmail(donnees.montant),
  }
}

// Un message dont le texte est vide (éditeur vidé, `<p></p>`) retombe sur le modèle par défaut.
export function messageEstVide(html: string | null | undefined): boolean {
  return !html || html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

export function objetEffectif(objet: string | null | undefined): string {
  return objet && objet.trim() !== '' ? objet : EMAIL_RECU_OBJET_DEFAUT
}

export function messageEffectif(html: string | null | undefined): string {
  return messageEstVide(html) ? EMAIL_RECU_MESSAGE_DEFAUT : (html as string)
}

// Objet d'email : texte brut (pas de HTML, donc pas d'échappement), sur une seule ligne.
export function rendreObjetEmailRecu(objet: string | null | undefined, valeurs: ValeursEmailRecu): string {
  const rendu = objetEffectif(objet)
    .replace(/\{\{(\w+)\}\}/g, (_, cle: string) => (Object.hasOwn(valeurs, cle) ? valeurs[cle as CleChampEmailRecu] : ''))
    .replace(/\s+/g, ' ')
    .trim()
  return rendu.slice(0, LONGUEUR_MAX_OBJET)
}

// Document complet : mise en page aux couleurs de DESIGN.md (papier, encre, cachet pour les liens),
// titre et pied fixes, message personnalisable au centre.
export function rendreEmailRecu(message: string | null | undefined, valeurs: ValeursEmailRecu): string {
  const corps = renderTemplate(messageEffectif(message), valeurs)
  const annee = escapeHtml(valeurs.annee)
  const organisation = escapeHtml(valeurs.organisation)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  .recu-message p { margin: 0 0 12px; }
  .recu-message a { color: #a8281f; }
</style></head><body style="margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #fdfcfa; padding: 32px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 2px; padding: 32px; border: 1px solid #e8e4dc;">
    <h1 style="color: #241f19; font-size: 20px; line-height: 1.3; margin: 0 0 16px;">Votre reçu fiscal ${annee}</h1>
    <div class="recu-message" style="color: #5c5347; font-size: 14px; line-height: 1.5;">${corps}</div>
    <p style="color: #726860; font-size: 12px; margin: 24px 0 0;">Cet email vous a été envoyé par ${organisation} via Samakan.</p>
  </div>
</body></html>`
}
