-- Corrige le template 11580 déjà seedé/backfillé : la ligne donateur
-- concaténait {{donateur_civilite}} et {{donateur_nom_complet}}, qui inclut
-- déjà le titre de civilité (M./Mme/Mlle) dans son propre formatage
-- (brief-cerfa.md §4) -- résultat observé : "Monsieur M. Nicolas BOULOM".
update templates_recu
set html_template = '<div class="recu">
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

  <h1 class="recu-title">Reçu au titre des dons à certains organismes d''intérêt général</h1>
  <p class="recu-subtitle">Articles 200 et 200 bis du Code Général des Impôts</p>

  <section class="recu-section">
    <h2>Bénéficiaire des versements</h2>
    <p>{{organisation_nom}}, dont l''objet social est : {{organisation_objet_social}}</p>
    <p>{{organisation_mention_legale}}</p>
  </section>

  <section class="recu-section recu-donateur">
    <h2>Donateur</h2>
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
          <td>Taux de réduction d''impôt applicable</td>
          <td class="recu-table-valeur">{{type_reduction}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="recu-section recu-declaration">
    <p>
      Je soussigné(e), représentant(e) de {{organisation_nom}}, certifie sur l''honneur que le don ci-dessus
      décrit n''a donné lieu à aucune contrepartie, directe ou indirecte, au bénéfice du donateur.
    </p>
  </section>

  <footer class="recu-footer">
    <p>Fait le {{recu_date_generation}}</p>
    <div class="recu-signature">
      <p>Signature et cachet de l''organisme</p>
    </div>
  </footer>
</div>'
where type_cerfa = '11580'
  and html_template like '%{{donateur_civilite}} {{donateur_nom_complet}}%';
