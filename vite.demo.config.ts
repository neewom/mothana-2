// Démo publique (demo.samakan.fr) : l'application réelle tourne dans le navigateur sur une base
// PGlite locale. Build séparé de celui de l'application : rien de PGlite ni de tinbase n'entre dans
// les fichiers chargés par index.html.
//   dev   : npx vite --config vite.demo.config.ts --port 5174   (puis /admin)
//   build : lancé par `npm run build`, après le build normal, dans le même dist/ :
//           dist/demo.html + dist/demo-assets/* (servis sur demo.samakan.fr, cf. vercel.json)
//
// Aucun fichier de l'application n'est modifié pour la démo : les rares différences passent par
// des substitutions de modules faites ici, au build de la démo seulement (le build normal reste
// identique octet pour octet).
import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss, { type Config as TailwindConfig } from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Même configuration Tailwind que l'application, sans l'exclusion de src/demo/ (ses classes
// n'entrent pas dans la feuille de style du build normal, cf. tailwind.config.cjs).
const baseTailwind = createRequire(import.meta.url)('./tailwind.config.cjs') as TailwindConfig
const demoTailwind: TailwindConfig = {
  ...baseTailwind,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
}

// En dev, toute navigation HTML (ex. /admin/dons) sert demo.html, jamais index.html.
function demoSpaFallback(): Plugin {
  return {
    name: 'demo-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method === 'GET' && req.headers.accept?.includes('text/html')) req.url = '/demo.html'
        next()
      })
    },
  }
}

// tinbase embarque son « Studio » (interface d'administration, ~1,3 Mo non compressé) et le sert
// sous /_/ : inutile dans la démo, il est remplacé par une page vide.
const STUDIO_STUB = '\0tinbase-studio-stub'
function stripTinbaseStudio(): Plugin {
  return {
    name: 'strip-tinbase-studio',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './admin/ui.js' && importer?.replace(/\\/g, '/').includes('/tinbase/dist/')) return STUDIO_STUB
      return null
    },
    load(id) {
      if (id === STUDIO_STUB) return "export const ADMIN_HTML = '<!doctype html><title>Indisponible dans la démo</title>'"
      return null
    },
  }
}

// Le bandeau « Environnement de test » (affiché hors des domaines de prod, donc aussi sur
// demo.samakan.fr) est remplacé, à sa place en tête de chaque écran, par le bandeau de la démo.
const RECETTE_BANNER = path.resolve(__dirname, 'src/components/RecetteBanner.tsx')
const DEMO_BANNER_SLOT = path.resolve(__dirname, 'src/demo/RecetteBannerSlot.tsx')
function swapRecetteBanner(): Plugin {
  return {
    name: 'swap-recette-banner',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.includes('RecetteBanner') || importer === DEMO_BANNER_SLOT) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === RECETTE_BANNER ? DEMO_BANNER_SLOT : null
    },
  }
}

export default defineConfig({
  plugins: [react(), demoSpaFallback(), stripTinbaseStudio(), swapRecetteBanner()],
  // L'URL et la clé « Supabase » de la démo ne désignent rien sur le réseau : tout appel vers cette
  // URL est servi dans l'onglet (src/demo/fetchInterceptor.ts). La clé est la clé anon publique de
  // développement de Supabase, celle que tinbase signe par défaut : elle ne donne accès à rien.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://demo.samakan.invalid'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'),
  },
  css: { postcss: { plugins: [tailwindcss(demoTailwind), autoprefixer()] } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    outDir: 'dist',
    // Le build normal vient d'écrire dist/ : ne pas l'effacer, ni recopier public/.
    emptyOutDir: false,
    copyPublicDir: false,
    assetsDir: 'demo-assets',
    rollupOptions: { input: path.resolve(__dirname, 'demo.html') },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
