// Templates HTML/CSS par défaut des reçus fiscaux Cerfa, seedés automatiquement
// à la création de chaque organisation (docs/brief-cerfa.md §3).
// Placeholders {{variable}} injectés par l'Edge Function generate-recu (§2.2/§2.3, à venir).

export const CERFA_TEMPLATE_CSS = `
@page { size: A4; margin: 20mm; }
* { box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 12px; }
.recu { max-width: 210mm; margin: 0 auto; }
.recu-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4338ca; padding-bottom: 12px; margin-bottom: 24px; }
.recu-organisme-nom { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.recu-organisme p { margin: 2px 0; }
.recu-numero { text-align: right; }
.recu-numero-label { font-size: 11px; color: #64748b; margin: 0; }
.recu-numero-valeur { font-size: 20px; font-weight: 700; color: #4338ca; margin: 2px 0; }
.recu-numero-annee { font-size: 11px; color: #64748b; margin: 0; }
.recu-title { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 4px; }
.recu-subtitle { font-size: 11px; text-align: center; color: #64748b; margin: 0 0 24px; }
.recu-section { margin-bottom: 18px; }
.recu-section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: #4338ca; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px; }
.recu-section p { margin: 2px 0; }
.recu-donateur-nom { font-weight: 700; font-size: 13px; }
.recu-table { width: 100%; border-collapse: collapse; }
.recu-table td { padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
.recu-table-valeur { text-align: right; font-weight: 700; }
.recu-declaration { font-size: 11px; font-style: italic; color: #475569; }
.recu-footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
.recu-signature { width: 220px; height: 70px; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #94a3b8; }
`.trim()

export const CERFA_11580_HTML = `
<div class="recu">
  <header class="recu-header">
    <div class="recu-organisme">
      <p class="recu-organisme-nom">{{organisation_nom}}</p>
      <p>{{organisation_adresse}}</p>
      <p>{{organisation_code_postal}} {{organisation_ville}}</p>
      <p>RNA : {{organisation_rna}}</p>
      <p>SIREN : {{organisation_siren}}</p>
    </div>
    <div class="recu-numero">
      <p class="recu-numero-label">Reçu n°</p>
      <p class="recu-numero-valeur">{{recu_numero_ordre}}</p>
      <p class="recu-numero-annee">Année {{don_annee}}</p>
    </div>
  </header>

  <h1 class="recu-title">Reçu au titre des dons à certains organismes d'intérêt général</h1>
  <p class="recu-subtitle">Articles 200 et 200 bis du Code Général des Impôts</p>

  <section class="recu-section">
    <h2>Bénéficiaire des versements</h2>
    <p>{{organisation_nom}}, dont l'objet social est : {{organisation_objet_social}}</p>
    <p>{{organisation_mention_legale}}</p>
  </section>

  <section class="recu-section recu-donateur">
    <h2>Donateur</h2>
    <p class="recu-donateur-nom">{{donateur_civilite}} {{donateur_nom_complet}}</p>
    <p>{{donateur_adresse}}</p>
    <p>{{donateur_code_postal}} {{donateur_ville}}</p>
  </section>

  <section class="recu-section recu-don">
    <h2>Montant et forme du don</h2>
    <table class="recu-table">
      <tbody>
        <tr>
          <td>Somme reçue en {{don_annee}}</td>
          <td class="recu-table-valeur">{{don_montant_chiffres}}</td>
        </tr>
        <tr>
          <td colspan="2">Soit en toutes lettres : <strong>{{don_montant_lettres}}</strong></td>
        </tr>
        <tr>
          <td>Forme du don</td>
          <td class="recu-table-valeur">Don en numéraire</td>
        </tr>
        <tr>
          <td>Taux de réduction d'impôt applicable</td>
          <td class="recu-table-valeur">{{type_reduction}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="recu-section recu-declaration">
    <p>
      Je soussigné(e), représentant(e) de {{organisation_nom}}, certifie sur l'honneur que le don ci-dessus
      décrit n'a donné lieu à aucune contrepartie, directe ou indirecte, au bénéfice du donateur.
    </p>
  </section>

  <footer class="recu-footer">
    <p>Fait le {{recu_date_generation}}</p>
    <div class="recu-signature">
      <p>Signature et cachet de l'organisme</p>
    </div>
  </footer>
</div>
`.trim()

export const CERFA_16216_HTML = `
<div class="recu">
  <header class="recu-header">
    <div class="recu-organisme">
      <p class="recu-organisme-nom">{{organisation_nom}}</p>
      <p>{{organisation_adresse}}</p>
      <p>{{organisation_code_postal}} {{organisation_ville}}</p>
      <p>RNA : {{organisation_rna}}</p>
      <p>SIREN : {{organisation_siren}}</p>
    </div>
    <div class="recu-numero">
      <p class="recu-numero-label">Reçu n°</p>
      <p class="recu-numero-valeur">{{recu_numero_ordre}}</p>
      <p class="recu-numero-annee">Année {{don_annee}}</p>
    </div>
  </header>

  <h1 class="recu-title">Reçu au titre des dons — versements effectués par les entreprises</h1>
  <p class="recu-subtitle">Article 238 bis du Code Général des Impôts</p>

  <section class="recu-section">
    <h2>Bénéficiaire des versements</h2>
    <p>{{organisation_nom}}, dont l'objet social est : {{organisation_objet_social}}</p>
    <p>{{organisation_mention_legale}}</p>
  </section>

  <section class="recu-section recu-donateur">
    <h2>Personne morale donatrice</h2>
    <p class="recu-donateur-nom">{{donateur_nom_complet}}</p>
    <p>{{donateur_adresse}}</p>
    <p>{{donateur_code_postal}} {{donateur_ville}}</p>
  </section>

  <section class="recu-section recu-don">
    <h2>Montant et forme du don</h2>
    <table class="recu-table">
      <tbody>
        <tr>
          <td>Somme reçue en {{don_annee}}</td>
          <td class="recu-table-valeur">{{don_montant_chiffres}}</td>
        </tr>
        <tr>
          <td colspan="2">Soit en toutes lettres : <strong>{{don_montant_lettres}}</strong></td>
        </tr>
        <tr>
          <td>Forme du don</td>
          <td class="recu-table-valeur">Don en numéraire</td>
        </tr>
        <tr>
          <td>Taux de réduction d'impôt sur les sociétés applicable</td>
          <td class="recu-table-valeur">{{type_reduction}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="recu-section recu-declaration">
    <p>
      Je soussigné(e), représentant(e) de {{organisation_nom}}, certifie sur l'honneur que le don ci-dessus
      décrit n'a donné lieu à aucune contrepartie, directe ou indirecte, au bénéfice de l'entreprise donatrice.
    </p>
  </section>

  <footer class="recu-footer">
    <p>Fait le {{recu_date_generation}}</p>
    <div class="recu-signature">
      <p>Signature et cachet de l'organisme</p>
    </div>
  </footer>
</div>
`.trim()

export interface DefaultCerfaTemplate {
  nom: string
  type_cerfa: '11580' | '16216'
  html_template: string
  css: string
}

export const DEFAULT_CERFA_TEMPLATES: DefaultCerfaTemplate[] = [
  {
    nom: 'Cerfa 11580 — Particuliers (défaut)',
    type_cerfa: '11580',
    html_template: CERFA_11580_HTML,
    css: CERFA_TEMPLATE_CSS,
  },
  {
    nom: 'Cerfa 16216 — Entreprises (défaut)',
    type_cerfa: '16216',
    html_template: CERFA_16216_HTML,
    css: CERFA_TEMPLATE_CSS,
  },
]
