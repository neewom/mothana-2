// Monaco est servi depuis notre build (monacoSetup.ts), plus depuis un CDN : la CSP de
// vercel.json n'a ainsi à autoriser aucune origine tierce pour l'éditeur. Le chargement
// est différé à la première ouverture d'un éditeur (import dynamique, chunk séparé).
// Pas de réessai ici : lazy() (CodeEditor) mémorise un échec, le réessai passe par le
// rechargement de la page proposé par LoadErrorBoundary.
export function chargerMonaco(): Promise<void> {
  return import('./monacoSetup').then(() => undefined)
}
