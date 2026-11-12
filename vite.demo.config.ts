// Spike démo PGlite (carte O6ZIN4DZ) — build séparé, l'application normale n'est pas touchée.
//   dev   : npx vite --config vite.demo.config.ts --port 5174
//   build : npx vite build --config vite.demo.config.ts  (sortie dist-demo/)
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), demoSpaFallback()],
  // L'URL et la clé « Supabase » de la démo ne désignent rien sur le réseau : le fetch est
  // intercepté (src/demo/fetchInterceptor.ts). La clé est la clé anon publique de dev de Supabase,
  // que tinbase signe par défaut.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://demo.samakan.invalid'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'),
  },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    outDir: 'dist-demo',
    rollupOptions: { input: path.resolve(__dirname, 'demo.html') },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
