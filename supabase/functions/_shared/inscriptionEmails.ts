// Emails du parcours d'inscription (carte https://trello.com/c/hNqpdZXL) : un email par cas de
// soumission (confirmation de l'adresse, compte existant, demande déjà en cours ; l'écran public
// reste identique pour tous), notification du super-admin à la confirmation, et invitation
// dédiée à la validation. Tout contenu saisi est échappé. Module pur (aucune API Deno).
import { escapeHtml, escapeHtmlTexte } from './echappementHtml.ts'

export interface EmailInscription {
  sujet: string
  html: string
}

const P = 'color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 12px;'
const PETIT = 'color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 16px 0 0;'
const BOUTON = 'background: #a8281f; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;'
const LIEN = 'color: #a8281f; font-weight: 600;'

function gabarit(titre: string, corps: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #fdfcfa; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 6px; padding: 32px; border: 1px solid #e8e4dc;">
    <h1 style="color: #241f19; font-size: 20px; margin: 0 0 16px;">${titre}</h1>
    ${corps}
  </div>
</body></html>`
}

/** Sujet d'email (texte brut) : retours à la ligne retirés, longueur bornée. */
function sujetSur(valeur: string): string {
  return valeur.replace(/[\r\n]+/g, ' ').trim().slice(0, 120)
}

function etapes(etapeCourante: 1 | 2): string {
  const libelles = [
    'Tu confirmes ton adresse email.',
    'On vérifie ton association, sous 48 h.',
    'Tu reçois ton invitation pour choisir ton mot de passe.',
  ]
  const items = libelles
    .map((l, i) => `<li style="margin: 0 0 6px;${i + 1 <= etapeCourante ? ' color: #241f19;' : ''}">${l}</li>`)
    .join('')
  return `<ol style="${P} padding-left: 20px;">${items}</ol>`
}

const RAPPEL_SPAMS = `<p style="${P}">Pense à vérifier tes courriers indésirables (spams) : nos emails y arrivent parfois.</p>`
const PAS_TOI = `<p style="${PETIT}">Tu n'es pas à l'origine de cette demande ? Ignore simplement cet email.</p>`

/** Lien de confirmation : `<origine>/inscription/confirmer?jeton=<jeton>`. */
export function lienConfirmationInscription(siteUrl: string, jeton: string): string {
  return `${siteUrl}/inscription/confirmer?jeton=${encodeURIComponent(jeton)}`
}

export function emailConfirmationDemande(p: { prenom: string; nomAssociation: string; lien: string }): EmailInscription {
  return {
    sujet: 'Confirme ta demande d’espace Samakan',
    html: gabarit(
      'Confirme ta demande',
      `<p style="${P}">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="${P}">Pour transmettre ta demande d'espace Samakan pour <strong>${escapeHtml(p.nomAssociation)}</strong>, confirme d'abord ton adresse email.</p>
    <p style="margin: 20px 0;"><a href="${escapeHtml(p.lien)}" style="${BOUTON}">Confirmer ma demande</a></p>
    <p style="${P}">Ce lien est valable 48 h. Ensuite, on vérifie ton association avant d'ouvrir son espace : c'est ce qui garantit des reçus fiscaux fiables.</p>
    ${etapes(1)}
    <p style="${PETIT}">Le bouton ne marche pas ? Copie ce lien dans ton navigateur : <span style="word-break: break-all;">${escapeHtml(p.lien)}</span></p>
    <p style="${PETIT}">Tu n'es pas à l'origine de cette demande ? Ignore simplement cet email : sans confirmation, elle est supprimée.</p>`,
    ),
  }
}

export function emailAccuseCompteExistant(p: { prenom: string; siteUrl: string }): EmailInscription {
  const connexion = `${p.siteUrl}/login`
  const oubli = `${p.siteUrl}/login?mot-de-passe-oublie`
  return {
    sujet: 'Tu as déjà un espace Samakan',
    html: gabarit(
      'Tu as déjà un espace Samakan',
      `<p style="${P}">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="${P}">Une demande d'espace vient d'être faite avec cette adresse, mais elle est déjà rattachée à un compte Samakan. Pas besoin d'en créer un autre : connecte-toi directement.</p>
    <p style="margin: 20px 0;"><a href="${escapeHtml(connexion)}" style="${BOUTON}">Me connecter</a></p>
    <p style="${P}">Mot de passe oublié ? <a href="${escapeHtml(oubli)}" style="${LIEN}">Choisis-en un nouveau</a>.</p>
    ${RAPPEL_SPAMS}
    ${PAS_TOI}`,
    ),
  }
}

export function emailAccuseDemandeEnCours(p: { prenom: string }): EmailInscription {
  return {
    sujet: 'Ta demande d’espace Samakan est en cours',
    html: gabarit(
      'Ta demande est déjà en cours',
      `<p style="${P}">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="${P}">On a déjà une demande d'espace en cours pour cette adresse : pas besoin de la refaire. On la vérifie et on revient vers toi sous 48 h.</p>
    ${etapes(2)}
    ${RAPPEL_SPAMS}
    ${PAS_TOI}`,
    ),
  }
}

export interface DemandePourNotification {
  nom_association: string
  ville: string
  rna: string | null
  siren: string | null
  prenom: string
  nom: string
  email: string
  message: string | null
}

export function emailNotificationSuperAdmin(d: DemandePourNotification, lienSuperAdmin: string): EmailInscription {
  const ligne = (libelle: string, valeur: string | null) =>
    `<tr><td style="padding: 4px 12px 4px 0; color: #726860; font-size: 13px; vertical-align: top; white-space: nowrap;">${libelle}</td><td style="padding: 4px 0; color: #241f19; font-size: 13px;">${valeur ? escapeHtmlTexte(valeur) : '—'}</td></tr>`
  return {
    sujet: sujetSur(`Nouvelle demande d’inscription : ${d.nom_association}`),
    html: gabarit(
      'Nouvelle demande d’inscription',
      `<table style="border-collapse: collapse; margin: 0 0 16px;">
      ${ligne('Association', d.nom_association)}
      ${ligne('Ville', d.ville)}
      ${ligne('RNA', d.rna)}
      ${ligne('SIREN', d.siren)}
      ${ligne('Demandeur', `${d.prenom} ${d.nom}`)}
      ${ligne('Email', d.email)}
      ${ligne('Message', d.message)}
    </table>
    <p style="margin: 20px 0;"><a href="${escapeHtml(lienSuperAdmin)}" style="${BOUTON}">Traiter la demande</a></p>`,
    ),
  }
}

export function emailInvitationInscription(p: { prenom: string; nomAssociation: string; actionLink: string }): EmailInscription {
  return {
    sujet: 'Ton espace Samakan est prêt',
    html: gabarit(
      'Ton espace Samakan est prêt',
      `<p style="${P}">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="${P}">Suite à ta demande, l'espace de <strong>${escapeHtml(p.nomAssociation)}</strong> est ouvert. Tu en es l'administrateur. Il ne reste qu'à choisir ton mot de passe.</p>
    <p style="margin: 20px 0;"><a href="${escapeHtml(p.actionLink)}" style="${BOUTON}">Choisir mon mot de passe</a></p>
    <p style="${P}">Tu y trouveras :</p>
    <ul style="${P} padding-left: 20px;">
      <li style="margin: 0 0 6px;">les dons et les reçus fiscaux ;</li>
      <li style="margin: 0 0 6px;">les adhérents et leurs adhésions ;</li>
      <li style="margin: 0 0 6px;">l'import de ton tableur pour reprendre tes listes existantes.</li>
    </ul>
    <p style="${P}">Pour émettre des reçus fiscaux, complète d'abord les informations de l'association dans Paramètres › Organisation (adresse, RNA ou SIREN, objet social).</p>
    <p style="${PETIT}">Ce lien est personnel. Tu n'es pas à l'origine de cette demande ? Ignore simplement cet email.</p>`,
    ),
  }
}
