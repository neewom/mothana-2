// Monaco est servi depuis notre build (monacoSetup.ts), plus depuis un CDN : la CSP de
// vercel.json n'a ainsi à autoriser aucune origine tierce pour l'éditeur. Le chargement
// est différé à la première ouverture d'un éditeur (import dynamique, chunk séparé).
let chargement: Promise<void> | null = null

export function chargerMonaco(): Promise<void> {
  chargement ??= import('./monacoSetup').then(
    () => undefined,
    (erreur: unknown) => {
      chargement = null // permet de réessayer à la prochaine ouverture
      throw erreur
    },
  )
  return chargement
}
