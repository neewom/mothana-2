// Spike démo PGlite — bandeau permanent de la démo.
export function DemoBanner() {
  return (
    <div className="fixed bottom-2 left-2 z-[9999] flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-xs text-paper">
      <span>Démo : vos saisies restent dans ce navigateur</span>
      <button type="button" className="underline" onClick={() => window.__demo?.reset()}>
        Remettre à zéro
      </button>
    </div>
  )
}
