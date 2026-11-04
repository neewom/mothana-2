// deno test --no-lock supabase/functions/_shared/recuEmail.test.ts
import {
  EMAIL_RECU_MESSAGE_DEFAUT,
  rendreEmailRecu,
  rendreObjetEmailRecu,
  valeursEmailRecu,
} from './recuEmail.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const valeurs = valeursEmailRecu({ prenom: 'Léa <b>', nom: 'Martin & Fils', annee: 2025, organisation: 'Pagode <Wat>', montant: 1234.5 })

Deno.test('les valeurs insérées dans le message sont échappées', () => {
  const html = rendreEmailRecu('<p>Bonjour {{prenom}} {{nom}}, merci pour {{montant}}.</p>', valeurs)
  vrai(html.includes('Bonjour Léa &lt;b&gt; Martin &amp; Fils'), html)
  vrai(!html.includes('<b>'), 'balise injectée conservée')
  vrai(html.includes('Pagode &lt;Wat&gt; via Samakan'), 'organisation non échappée dans le pied')
  vrai(/1\s234,50\s€/.test(html), 'montant non formaté')
})

Deno.test('message vide : retour au modèle par défaut', () => {
  const html = rendreEmailRecu('<p></p>', valeurs)
  vrai(html.includes('Veuillez trouver ci-joint votre reçu fiscal 2025 pour vos dons à Pagode &lt;Wat&gt;'), html)
  vrai(rendreEmailRecu(null, valeurs) === rendreEmailRecu(EMAIL_RECU_MESSAGE_DEFAUT, valeurs), 'défaut différent')
})

Deno.test("l'objet est du texte brut sur une ligne, défaut si vide", () => {
  vrai(rendreObjetEmailRecu(null, valeurs) === 'Votre reçu fiscal 2025 — Pagode <Wat>', rendreObjetEmailRecu(null, valeurs))
  vrai(rendreObjetEmailRecu('  ', valeurs) === 'Votre reçu fiscal 2025 — Pagode <Wat>', 'objet vide')
  vrai(rendreObjetEmailRecu('Reçu {{annee}}\n{{inconnu}} pour {{prenom}}', valeurs) === 'Reçu 2025 pour Léa <b>', 'objet multiligne')
})

Deno.test('prénom absent : pas de valeur « null »', () => {
  const v = valeursEmailRecu({ prenom: null, nom: 'Durand', annee: 2025, organisation: 'Asso', montant: null })
  vrai(!rendreEmailRecu(null, v).includes('null'), 'null affiché')
  vrai(v.montant === '', 'montant inconnu')
})
