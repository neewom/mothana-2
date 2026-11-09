import * as React from 'react'
import { cn } from '@/lib/utils'
import { optionsDeTri, repartirParRole, type ModeListe, type RoleCarte } from '@/lib/listeDonnees'
import type { SortDirection } from '@/lib/tableSort'
import SortableTableHead from '../SortableTableHead'
import ScrollShadowX from '../ScrollShadowX'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'
import { Select } from './select'
import { Button } from './button'

/*
 * Liste commune des pages de liste (DESIGN.md › Tables, Page de liste) : un tableau, ou des cartes
 * en mobile, décrits une seule fois par leurs colonnes.
 *
 * Utilisation :
 *   const { mode, selecteur } = useModeListe('dons')          // hooks/useModeListe
 *   <ListeConteneur>                                          // carte bordée, liseré, bord à bord en mobile
 *     <ListToolbar … mode={selecteur} />                      // sélecteur tableau / cartes sous 768 px
 *     <ListeDonnees rows={…} rowKey={(d) => d.id} columns={COLONNES} mode={mode}
 *       sort={{ field, direction, onSort: toggleSort }}       // état de useTableSort
 *       onRowClick={ouvrirPanneau} activeKey={selection?.id} rowLabel={(d) => nom(d)} />
 *     <TablePagination … />
 *   </ListeConteneur>
 *
 * Colonne (`ColonneListe`) :
 *   - `key` unique, `label` (en-tête du tableau et option de « Trier par ») ;
 *   - `cell(row)` : contenu de la cellule ; `carte(row)` : contenu en carte s'il diffère
 *     (`null`, `undefined`, `false` ou `''` = rien dans la carte pour cette ligne) ;
 *   - `role` : place dans la carte — `titre`, `montant`, `secondaire`, `pastille` ou `masquee`
 *     (voir `RoleCarte`, lib/listeDonnees) ;
 *   - `sortField` : clé de tri (en-tête cliquable en tableau, option de « Trier par » en cartes) ;
 *   - `align`, `headClassName`, `cellClassName` : alignement et classes du tableau (colonnes
 *     masquées par palier `hidden md:table-cell`, marges…), sans effet sur les cartes.
 *
 * Comportement :
 *   - tableau : `ScrollShadowX` + en-têtes triables ; cartes : liste à séparateurs, barre « Trier
 *     par » (même état de tri que les en-têtes) ; la pagination reste celle de la page ;
 *   - `onRowClick` : ligne ou carte cliquable et atteignable au clavier (Tab, puis Entrée ou
 *     Espace), chevron final (`chevronClassName` pour le masquer à certains paliers) ;
 *   - `rowClassName(row)` : classes d'une ligne et de sa carte (ex. fond d'alerte d'une ligne
 *     à signaler) ;
 *   - `selection` : cases par ligne ou par carte ; « Tout sélectionner » en tête du tableau, ou
 *     dans la barre du mode cartes ; `tableClassName` masque la colonne des cases à certains
 *     paliers, `showInCards` affiche les cases des cartes.
 */

export interface ColonneListe<T, F extends string = string> {
  key: string
  label: string
  cell: (row: T) => React.ReactNode
  carte?: (row: T) => React.ReactNode
  role: RoleCarte
  sortField?: F
  align?: 'left' | 'right'
  headClassName?: string
  cellClassName?: string
}

export interface ListeSelection {
  selected: ReadonlySet<string>
  onToggle: (key: string) => void
  onToggleAll: () => void
  tableClassName?: string
  showInCards: boolean
}

export interface ListeDonneesProps<T, F extends string> {
  rows: readonly T[]
  rowKey: (row: T) => string
  columns: readonly ColonneListe<T, F>[]
  mode: ModeListe
  sort?: { field: F; direction: SortDirection; onSort: (field: F) => void }
  onRowClick?: (row: T) => void
  /** Clé de la ligne ouverte dans le panneau (surlignée). */
  activeKey?: string | null
  /** Nom de la ligne pour les lecteurs d'écran (case « Sélectionner … »). */
  rowLabel?: (row: T) => string
  chevronClassName?: string
  /** Classes propres à une ligne (tableau) et à sa carte, ex. fond d'alerte. */
  rowClassName?: (row: T) => string | undefined
  selection?: ListeSelection
}

/** Carte bordée qui porte la liste (liseré du contenu principal) ; bord à bord sous 768 px. */
export function ListeConteneur({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        '-mx-4 min-w-0 flex-1 border-y border-l-[3px] border-paper-border border-l-stamp bg-white md:mx-0 md:rounded-sm md:border-r',
        className,
      )}
    >
      {children}
    </div>
  )
}

const CHECKBOX_CLASS = 'h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70'

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function estVide(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === false || value === ''
}

function contenuCarte<T>(colonne: ColonneListe<T>, row: T): React.ReactNode {
  return colonne.carte ? colonne.carte(row) : colonne.cell(row)
}

export function ListeDonnees<T, F extends string>(props: ListeDonneesProps<T, F>) {
  return props.mode === 'cartes' ? <ListeCartes {...props} /> : <ListeTableau {...props} />
}

function ListeTableau<T, F extends string>({
  rows, rowKey, columns, sort, onRowClick, activeKey, rowLabel, chevronClassName, rowClassName, selection,
}: ListeDonneesProps<T, F>) {
  const toutCoche = !!selection && selection.selected.size > 0 && selection.selected.size === rows.length

  return (
    <ScrollShadowX>
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className={selection.tableClassName}>
                <input type="checkbox" checked={toutCoche} onChange={selection.onToggleAll} className={CHECKBOX_CLASS} aria-label="Tout sélectionner" />
              </TableHead>
            )}
            {columns.map((c) =>
              c.sortField && sort ? (
                <SortableTableHead
                  key={c.key}
                  field={c.sortField}
                  label={c.label}
                  sortField={sort.field}
                  sortDirection={sort.direction}
                  onSort={sort.onSort}
                  align={c.align}
                  className={c.headClassName}
                />
              ) : (
                <TableHead key={c.key} className={cn(c.align === 'right' && 'text-right', c.headClassName)}>
                  {c.label}
                </TableHead>
              ),
            )}
            {onRowClick && <TableHead className={chevronClassName}><span className="sr-only">Ouvrir</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = rowKey(row)
            const active = key === activeKey
            return (
              <TableRow
                key={key}
                tabIndex={onRowClick ? 0 : undefined}
                aria-current={active ? 'true' : undefined}
                onClick={onRowClick && (() => onRowClick(row))}
                onKeyDown={onRowClick && ((event) => {
                  // Seulement la ligne elle-même (pas la case à cocher qu'elle contient).
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(row)
                  }
                })}
                className={cn(
                  onRowClick && 'cursor-pointer hover:bg-paper-border/20 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stamp/70',
                  rowClassName?.(row),
                  active && 'bg-stamp/[0.05] hover:bg-stamp/[0.05]',
                )}
              >
                {selection && (
                  <TableCell className={selection.tableClassName} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selection.selected.has(key)}
                      onChange={() => selection.onToggle(key)}
                      className={CHECKBOX_CLASS}
                      aria-label={`Sélectionner ${rowLabel ? rowLabel(row) : key}`}
                    />
                  </TableCell>
                )}
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === 'right' && 'text-right', c.cellClassName)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
                {onRowClick && (
                  <TableCell className={cn('text-right text-ink-faint', chevronClassName)}>
                    <Chevron />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollShadowX>
  )
}

function ListeCartes<T, F extends string>({
  rows, rowKey, columns, sort, onRowClick, activeKey, rowLabel, rowClassName, selection,
}: ListeDonneesProps<T, F>) {
  const roles = repartirParRole(columns)
  const options = optionsDeTri<F, ColonneListe<T, F>>(columns)
  const triId = React.useId()
  const casesVisibles = !!selection?.showInCards
  const toutCoche = !!selection && selection.selected.size > 0 && selection.selected.size === rows.length
  const croissant = sort?.direction === 'asc'

  return (
    <div>
      {((sort && options.length > 0) || casesVisibles) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-paper-border px-4 py-2">
          {selection && casesVisibles && (
            <label className="inline-flex min-h-9 items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={toutCoche} onChange={selection.onToggleAll} className={CHECKBOX_CLASS} />
              Tout sélectionner
            </label>
          )}
          {sort && options.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {/* À côté de « Tout sélectionner », le libellé reste pour les lecteurs d'écran : la barre tient sur une ligne à 375 px. */}
              <label htmlFor={triId} className={cn('whitespace-nowrap font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint', casesVisibles && 'sr-only')}>
                Trier par
              </label>
              <Select
                id={triId}
                value={sort.field}
                onChange={(e) => { if (e.target.value !== sort.field) sort.onSort(e.target.value as F) }}
                className="py-1.5"
              >
                {!options.some((o) => o.field === sort.field) && <option value={sort.field} hidden>—</option>}
                {options.map((o) => <option key={o.field} value={o.field}>{o.label}</option>)}
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => sort.onSort(sort.field)}
                aria-label={croissant ? 'Ordre croissant, inverser' : 'Ordre décroissant, inverser'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  {croissant
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" />}
                </svg>
              </Button>
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-paper-border-muted">
        {rows.map((row) => {
          const key = rowKey(row)
          const active = key === activeKey
          const titres = roles.titre.map((c) => [c.key, contenuCarte(c, row)] as const).filter(([, v]) => !estVide(v))
          const montants = roles.montant.map((c) => [c.key, contenuCarte(c, row)] as const).filter(([, v]) => !estVide(v))
          const secondaires = roles.secondaire.map((c) => [c.key, contenuCarte(c, row)] as const).filter(([, v]) => !estVide(v))
          const pastilles = roles.pastille.map((c) => [c.key, contenuCarte(c, row)] as const).filter(([, v]) => !estVide(v))

          const corps = (
            <>
              <span className="block min-w-0 flex-1 space-y-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words font-medium text-ink">
                    {titres.map(([k, v], i) => <React.Fragment key={k}>{i > 0 && ' '}{v}</React.Fragment>)}
                  </span>
                  {montants.length > 0 && (
                    <span className="shrink-0 whitespace-nowrap font-registre-mono font-medium text-ink">
                      {montants.map(([k, v], i) => <React.Fragment key={k}>{i > 0 && ' · '}{v}</React.Fragment>)}
                    </span>
                  )}
                </span>
                {secondaires.length > 0 && (
                  <span className="block break-words text-xs text-ink-muted">
                    {secondaires.map(([k, v], i) => (
                      <React.Fragment key={k}>{i > 0 && <span aria-hidden className="text-ink-faint"> · </span>}{v}</React.Fragment>
                    ))}
                  </span>
                )}
                {pastilles.length > 0 && (
                  <span className="flex flex-wrap gap-1 pt-0.5">
                    {pastilles.map(([k, v]) => <React.Fragment key={k}>{v}</React.Fragment>)}
                  </span>
                )}
              </span>
              {onRowClick && <span className="text-ink-faint"><Chevron /></span>}
            </>
          )

          return (
            <li key={key} className={cn('flex items-stretch', rowClassName?.(row), active && 'bg-stamp/[0.05]')}>
              {selection && casesVisibles && (
                <label className="flex shrink-0 items-center pl-4 pr-1">
                  <input
                    type="checkbox"
                    checked={selection.selected.has(key)}
                    onChange={() => selection.onToggle(key)}
                    className={CHECKBOX_CLASS}
                    aria-label={`Sélectionner ${rowLabel ? rowLabel(row) : key}`}
                  />
                </label>
              )}
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left font-registre text-sm transition-colors hover:bg-paper-border/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stamp/70',
                    casesVisibles ? 'pl-2' : 'pl-4',
                    active && 'hover:bg-transparent',
                  )}
                >
                  {corps}
                </button>
              ) : (
                <div className={cn('flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-sm', casesVisibles ? 'pl-2' : 'pl-4')}>{corps}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
