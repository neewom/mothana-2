// Gabarit HTML/CSS par défaut de la carte adhérent, seedé automatiquement à
// la création de chaque organisation (même principe que defaultCerfaTemplates.ts
// pour les reçus fiscaux) — un fragment `.carte` de taille fixe (ISO/IEC 7810,
// 85,6 × 54 mm), pas un document complet : la mise en page en planche A4 est
// assemblée par l'edge function generate-cartes-adherents, pas par ce gabarit.

export const CARTE_ADHERENT_CSS = `
.carte {
  width: 85.6mm;
  height: 54mm;
  box-sizing: border-box;
  padding: 4mm;
  border: 1px solid #cbd5e1;
  border-radius: 3mm;
  font-family: 'Helvetica Neue', Arial, sans-serif;
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
.carte-signature { max-height: 8mm; max-width: 24mm; object-fit: contain; }
`.trim()

export const CARTE_ADHERENT_HTML = `
<div class="carte">
  <div class="carte-header">
    <img class="carte-logo" src="{{asset_logo}}" alt="" />
    <span class="carte-orga">{{organisation_nom}}</span>
  </div>
  <div>
    <p class="carte-titre">Carte d'adhérent</p>
    <p class="carte-nom">{{adherent_civilite}} {{adherent_nom_complet}}</p>
  </div>
  <div class="carte-footer">
    <p class="carte-validite">Valable du {{adhesion_date_debut}} au {{adhesion_date_fin}}</p>
    <img class="carte-signature" src="{{asset_signature}}" alt="" />
  </div>
</div>
`.trim()

export const DEFAULT_CARTE_ADHERENT_NOM = 'Carte adhérent (défaut)'
