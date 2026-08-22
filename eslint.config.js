import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Faux positifs connus sur le pattern fetch-au-montage
      // (useEffect(() => { fetchX() }, [...]) avec setLoading(true) synchrone
      // en tête de fetchX) — pattern recommandé par la doc React elle-même.
      // Cf. https://github.com/react/react/issues/34743
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
