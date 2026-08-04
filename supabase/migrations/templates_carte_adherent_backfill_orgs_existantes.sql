-- Backfill templates_carte_adherent pour les 3 organisations existantes
-- (Wat Strasbourg, Wat Choisy, Wat Velouvanaram), créées avant l'étape 5 :
-- le seed automatique n'existait pas encore. Sans ce backfill,
-- generate-cartes-adherents ne trouve aucun template actif pour elles.
insert into templates_carte_adherent (organisation_id, nom, html_template, css, is_active, is_archived)
values
('c12b8c16-daf2-40be-a37f-95bd072da1a6', 'Carte adhérent (défaut)', '<div class="carte">
  <div class="carte-header">
    <img class="carte-logo" src="{{asset_logo}}" alt="" />
    <span class="carte-orga">{{organisation_nom}}</span>
  </div>
  <div>
    <p class="carte-titre">Carte d''adhérent</p>
    <p class="carte-nom">{{adherent_civilite}} {{adherent_nom_complet}}</p>
  </div>
  <div class="carte-footer">
    <p class="carte-validite">Valable du {{adhesion_date_debut}} au {{adhesion_date_fin}}</p>
    <img class="carte-signature" src="{{asset_signature}}" alt="" />
  </div>
</div>', '.carte {
  width: 85.6mm;
  height: 54mm;
  box-sizing: border-box;
  padding: 4mm;
  border: 1px solid #cbd5e1;
  border-radius: 3mm;
  font-family: ''Helvetica Neue'', Arial, sans-serif;
  color: #1e293b;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.carte-header { display: flex; align-items: center; justify-content: space-between; gap: 2mm; }
.carte-logo { max-height: 8mm; max-width: 24mm; object-fit: contain; }
.carte-orga { font-size: 8px; font-weight: 700; color: #4338ca; text-align: right; }
.carte-titre { font-size: 7px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0; }
.carte-nom { font-size: 13px; font-weight: 700; margin: 2mm 0 0; }
.carte-footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 2mm; }
.carte-validite { font-size: 7px; color: #64748b; margin: 0; }
.carte-signature { max-height: 8mm; max-width: 24mm; object-fit: contain; }', true, false),
('51602383-a55c-448a-855d-f35058ba6aa0', 'Carte adhérent (défaut)', '<div class="carte">
  <div class="carte-header">
    <img class="carte-logo" src="{{asset_logo}}" alt="" />
    <span class="carte-orga">{{organisation_nom}}</span>
  </div>
  <div>
    <p class="carte-titre">Carte d''adhérent</p>
    <p class="carte-nom">{{adherent_civilite}} {{adherent_nom_complet}}</p>
  </div>
  <div class="carte-footer">
    <p class="carte-validite">Valable du {{adhesion_date_debut}} au {{adhesion_date_fin}}</p>
    <img class="carte-signature" src="{{asset_signature}}" alt="" />
  </div>
</div>', '.carte {
  width: 85.6mm;
  height: 54mm;
  box-sizing: border-box;
  padding: 4mm;
  border: 1px solid #cbd5e1;
  border-radius: 3mm;
  font-family: ''Helvetica Neue'', Arial, sans-serif;
  color: #1e293b;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.carte-header { display: flex; align-items: center; justify-content: space-between; gap: 2mm; }
.carte-logo { max-height: 8mm; max-width: 24mm; object-fit: contain; }
.carte-orga { font-size: 8px; font-weight: 700; color: #4338ca; text-align: right; }
.carte-titre { font-size: 7px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0; }
.carte-nom { font-size: 13px; font-weight: 700; margin: 2mm 0 0; }
.carte-footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 2mm; }
.carte-validite { font-size: 7px; color: #64748b; margin: 0; }
.carte-signature { max-height: 8mm; max-width: 24mm; object-fit: contain; }', true, false),
('00000000-0000-0000-0000-000000000001', 'Carte adhérent (défaut)', '<div class="carte">
  <div class="carte-header">
    <img class="carte-logo" src="{{asset_logo}}" alt="" />
    <span class="carte-orga">{{organisation_nom}}</span>
  </div>
  <div>
    <p class="carte-titre">Carte d''adhérent</p>
    <p class="carte-nom">{{adherent_civilite}} {{adherent_nom_complet}}</p>
  </div>
  <div class="carte-footer">
    <p class="carte-validite">Valable du {{adhesion_date_debut}} au {{adhesion_date_fin}}</p>
    <img class="carte-signature" src="{{asset_signature}}" alt="" />
  </div>
</div>', '.carte {
  width: 85.6mm;
  height: 54mm;
  box-sizing: border-box;
  padding: 4mm;
  border: 1px solid #cbd5e1;
  border-radius: 3mm;
  font-family: ''Helvetica Neue'', Arial, sans-serif;
  color: #1e293b;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.carte-header { display: flex; align-items: center; justify-content: space-between; gap: 2mm; }
.carte-logo { max-height: 8mm; max-width: 24mm; object-fit: contain; }
.carte-orga { font-size: 8px; font-weight: 700; color: #4338ca; text-align: right; }
.carte-titre { font-size: 7px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0; }
.carte-nom { font-size: 13px; font-weight: 700; margin: 2mm 0 0; }
.carte-footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 2mm; }
.carte-validite { font-size: 7px; color: #64748b; margin: 0; }
.carte-signature { max-height: 8mm; max-width: 24mm; object-fit: contain; }', true, false);
