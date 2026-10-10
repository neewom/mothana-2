import { cn } from '../lib/utils'
import { TableHead } from './ui/table'

interface SortableTableHeadProps<F extends string> {
  field: F
  label: string
  sortField: F
  sortDirection: 'asc' | 'desc'
  onSort: (field: F) => void
  align?: 'left' | 'right'
  className?: string
}

/** En-tête de colonne triable : un bouton (clavier, lecteur d'écran) avec flèche ▲/▼ sur la colonne active. */
export default function SortableTableHead<F extends string>({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  align = 'left',
  className,
}: SortableTableHeadProps<F>) {
  const active = sortField === field
  return (
    <TableHead
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(align === 'right' && 'text-right', className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex select-none items-center gap-1 rounded-sm uppercase hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
          active && 'text-ink'
        )}
      >
        {label}
        {active && <span aria-hidden>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </TableHead>
  )
}
