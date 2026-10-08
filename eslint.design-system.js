// Garde-fous du design system (épique DS, carte 4) — définis une seule fois, utilisés par :
//   - eslint.config.js      (`npm run lint`, avec toutes les autres règles)
//   - eslint.ds.config.js   (`npm run lint:ds`, uniquement ces règles, lancé en tête de `npm run build`)
// Un manquement fait donc échouer le build Vercel. Réparer plutôt qu'ignorer : utiliser les
// composants `src/components/ui/*` et les tokens (paper / ink / stamp / warning / success).
// Voir DESIGN.md § « Garde-fous lint » pour ajouter une exception hex justifiée.

// Palette Tailwind brute (hors tokens du projet) et rayons de l'ancien système.
const LEGACY_PALETTE = 'indigo|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|violet|purple|fuchsia|pink|rose'
const LEGACY_CLASS = new RegExp(`(?:^|[\\s:"'\`])(?:[a-z0-9-]+:)*-?[a-z-]+-(?:${LEGACY_PALETTE})-\\d{2,3}(?:/\\d+)?\\b|\\brounded-(?:lg|xl|2xl|3xl)\\b`).source
const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.source

const LEGACY_CLASS_MESSAGE =
  "Classe hors design system (palette Tailwind brute ou rounded-lg/xl/2xl) : utiliser les tokens paper/ink/stamp/warning/success, rounded-sm et les composants ui/* (DESIGN.md)."
const HEX_MESSAGE =
  'Couleur hex en dur : utiliser un token Tailwind (bg-paper, text-ink, border-stamp…). Exception justifiée seulement pour un rendu hors DOM (impression, canvas, dataviz) : voir DESIGN.md § « Garde-fous lint ».'

const legacyClassSelectors = [
  { selector: `Literal[value=/${LEGACY_CLASS}/]`, message: LEGACY_CLASS_MESSAGE },
  { selector: `TemplateElement[value.raw=/${LEGACY_CLASS}/]`, message: LEGACY_CLASS_MESSAGE },
]
const hexSelectors = [
  { selector: `Literal[value=/${HEX_COLOR}/]`, message: HEX_MESSAGE },
  { selector: `TemplateElement[value.raw=/${HEX_COLOR}/]`, message: HEX_MESSAGE },
]

// Exceptions hex : rendus hors DOM de l'app, où une classe Tailwind ne s'applique pas.
// Une ligne par fichier, avec sa raison. Toute nouvelle entrée se justifie en revue.
export const HEX_EXCEPTIONS = [
  'src/components/EvenementAfficheModal.tsx', // affiche imprimable (HTML autonome) + couleurs du QR code (canvas)
  'src/pages/PortefeuillePage.tsx', // couleurs du QR code acheteur (canvas qrcode)
  'src/components/SignaturePad.tsx', // trait de signature (canvas 2D)
  'src/pages/ComptabilitePage.tsx', // palettes et traits Recharts (SVG piloté en props, pas en classes)
]

export const designSystemRules = [
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)Modal$',
          message: "L'ancien wrapper Modal.tsx a été supprimé : utiliser Dialog / DialogContent de components/ui/dialog.",
        }],
      }],
      'no-restricted-syntax': ['error', ...legacyClassSelectors],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    ignores: HEX_EXCEPTIONS,
    rules: {
      // Redéclare les sélecteurs legacy : une config plus spécifique remplace la liste entière.
      'no-restricted-syntax': ['error', ...legacyClassSelectors, ...hexSelectors],
    },
  },
]
