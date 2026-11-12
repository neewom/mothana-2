// deno test --no-lock supabase/functions/_shared/inscriptionEmails.test.ts
import {
  emailAccuseCompteExistant,
  emailAccuseDemandeEnCours,
  emailAccuseNouvelleDemande,
  emailNotificationSuperAdmin,
} from './inscriptionEmails.ts'
import { emailInvitation } from './inviterAdmin.ts'
import { slugDisponible } from './slug.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const XSS = '<script>alert(1)</script>'

Deno.test('accusés : contenu saisi échappé, rappel des spams, tutoiement', () => {
  for (const email of [
    emailAccuseNouvelleDemande({ prenom: XSS, nomAssociation: XSS }),
    emailAccuseCompteExistant({ prenom: XSS, siteUrl: 'https://samakan.fr' }),
    emailAccuseDemandeEnCours({ prenom: XSS }),
  ]) {
    vrai(!email.html.includes('<script>'), `échappé : ${email.sujet}`)
    vrai(email.html.includes('spams'), `spams : ${email.sujet}`)
  }
  vrai(emailAccuseNouvelleDemande({ prenom: 'A', nomAssociation: 'B' }).html.includes('sous 48 h'), '3 étapes')
})

Deno.test('notification super-admin : champs échappés, sujet sans retour à la ligne, valeurs absentes en tiret', () => {
  const email = emailNotificationSuperAdmin({
    nom_association: `Asso\n${XSS}`,
    ville: 'Lyon',
    rna: null,
    siren: '123456789',
    prenom: 'Camille',
    nom: 'Martin',
    email: 'c@exemple.fr',
    message: 'Ligne 1\nLigne 2',
  }, 'https://samakan.fr/super-admin')
  vrai(!email.sujet.includes('\n'), 'sujet sur une ligne')
  vrai(!email.html.includes('<script>'), 'échappé')
  vrai(email.html.includes('Ligne 1<br>Ligne 2'), 'retours à la ligne du message')
  vrai(email.html.includes('—'), 'RNA absent')
})

Deno.test('invitation : modèle dédié à l’inscription, modèle habituel inchangé pour create-admin', () => {
  const dediee = emailInvitation({ type: 'inscription', prenom: 'Camille' }, {
    nom: 'Camille Martin', organisationNom: 'Les Amis', actionLink: 'https://x/lien', role: 'admin',
  })
  vrai(dediee.sujet === 'Ton espace Samakan est prêt', 'sujet dédié')
  vrai(dediee.html.includes('https://x/lien') && dediee.html.includes('import de ton tableur'), 'contenu dédié')
  const habituelle = emailInvitation({ type: 'standard' }, {
    nom: 'Camille Martin', organisationNom: 'Les Amis', actionLink: 'https://x/lien', role: 'admin',
  })
  vrai(habituelle.sujet === 'Votre accès Samakan', 'sujet habituel')
  vrai(habituelle.html.includes('Un compte administrateur'), 'contenu habituel')
})

Deno.test('slug disponible : base libre, puis suffixes', () => {
  vrai(slugDisponible('asso', []) === 'asso', 'libre')
  vrai(slugDisponible('asso', ['asso']) === 'asso-2', 'suffixe 2')
  vrai(slugDisponible('asso', ['asso', 'asso-2', 'asso-3', 'asso-lyon']) === 'asso-4', 'suffixe 4')
})
