// `npm run lint:ds` : uniquement les garde-fous du design system (eslint.design-system.js), vert
// sur toute la base, lancé en tête de `npm run build`. Les autres règles restent dans
// `npm run lint` (eslint.config.js), qui compte encore des erreurs préexistantes hors design system.
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { designSystemRules } from './eslint.design-system.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // Commentaires eslint-disable ignorés : ils visent des règles non chargées ici, et un
    // garde-fou du design system ne doit pas pouvoir se contourner en ligne — une exception
    // passe par HEX_EXCEPTIONS (eslint.design-system.js), revue en PR.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
  },
  ...designSystemRules,
])
