import { cn } from '@/lib/utils'
import { Button } from './button'
import { Select } from './select'

// Pied de carte des pages de liste (DESIGN.md › Tables, Page de liste) : « Lignes par page »,
// compteur « 1–50 sur 120 » et navigation « « ‹ Page x / y › » ». Purement présentationnel :
// la page appelante garde l'état (page, taille) et la logique (pagination client ou serveur).
// Sous `sm`, les boutons Précédent/Suivant perdent leur libellé texte (flèches seules, nom
// accessible via `aria-label`) pour que la navigation tienne sur une seule ligne à 375 px.
export const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

export interface TablePaginationProps {
  /** Page affichée (1-indexée), déjà bornée à `pageCount` par l'appelant. */
  page: number
  /** Nombre total de pages (au moins 1). */
  pageCount: number
  /** Nombre total d'éléments (après filtres), pour le compteur. */
  totalCount: number
  pageSize: number
  /** Appelé avec la page cible (déjà bornée entre 1 et `pageCount`). */
  onPageChange: (page: number) => void
  /** Appelé avec la nouvelle taille ; le composant enchaîne `onPageChange(1)`. */
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  className?: string
}

export function TablePagination({
  page,
  pageCount,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: TablePaginationProps) {
  const isFirst = page <= 1
  const isLast = page >= pageCount
  const goTo = (target: number) => onPageChange(Math.min(pageCount, Math.max(1, target)))

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-paper-border px-4 py-3 md:px-6', className)}>
      <div className="flex items-center gap-2 whitespace-nowrap font-registre-mono text-xs text-ink-faint">
        <span>Lignes par page</span>
        <Select
          aria-label="Lignes par page"
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
          className="py-1 pl-2 pr-7 text-xs"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>
        <span>
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} sur {totalCount}
        </span>
      </div>

      <nav aria-label="Pagination" className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <Button variant="secondary" size="sm" onClick={() => goTo(1)} disabled={isFirst} aria-label="Première page">«</Button>
        <Button variant="secondary" size="sm" onClick={() => goTo(page - 1)} disabled={isFirst} aria-label="Page précédente">
          <span className="sm:hidden">‹</span><span className="hidden sm:inline">‹ Précédent</span>
        </Button>
        <span className="whitespace-nowrap font-registre-mono text-xs text-ink-faint">Page {page} / {pageCount}</span>
        <Button variant="secondary" size="sm" onClick={() => goTo(page + 1)} disabled={isLast} aria-label="Page suivante">
          <span className="sm:hidden">›</span><span className="hidden sm:inline">Suivant ›</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => goTo(pageCount)} disabled={isLast} aria-label="Dernière page">»</Button>
      </nav>
    </div>
  )
}
