import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'

/**
 * Demande confirmation avant de quitter une page de Paramètres modifiée et non enregistrée.
 *
 * L'app utilise <BrowserRouter> (pas de data router) : `useBlocker` n'est pas disponible. On
 * couvre donc :
 *  - la fermeture de l'onglet et le rechargement (`beforeunload`, dialogue natif du navigateur) ;
 *  - les clics sur les liens internes (menu, menu compte, liens de la page), interceptés en
 *    phase de capture avant React Router, puis confirmés dans un dialogue ui/dialog.
 * Limite assumée : le bouton « retour » du navigateur n'est pas intercepté.
 *
 * Renvoie l'élément de dialogue à placer dans la page.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigate = useNavigate()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      // Requis par certains navigateurs pour afficher le dialogue natif.
      event.returnValue = ''
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const next = `${url.pathname}${url.search}${url.hash}`
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return

      event.preventDefault()
      event.stopPropagation()
      setPendingHref(next)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [isDirty])

  return (
    <Dialog open={pendingHref !== null} onOpenChange={(next) => { if (!next) setPendingHref(null) }}>
      <DialogContent className="max-w-md" aria-describedby="unsaved-changes-description">
        <div className="p-6">
          <DialogTitle>Modifications non enregistrées</DialogTitle>
          <p id="unsaved-changes-description" className="mt-2 text-sm text-ink-muted">
            Vous avez modifié cette page sans enregistrer. Si vous la quittez maintenant, ces modifications seront perdues.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setPendingHref(null)}>
              Rester sur la page
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const target = pendingHref
                setPendingHref(null)
                if (target) navigate(target)
              }}
            >
              Quitter sans enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
