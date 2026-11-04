import { useMemo, useState } from 'react'
import type { TablePaginationProps } from '../components/ui/table-pagination'

/**
 * Pagination navigateur d'une liste déjà chargée en entier (filtrée et triée par la page) :
 * page courante bornée, tranche affichée et props prêtes pour `TablePagination`.
 * La page appelle `setCurrentPage(1)` quand la recherche, l'onglet ou le tri change.
 */
export function useClientPagination<T>(rows: readonly T[], initialPageSize = 50) {
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(currentPage, pageCount)
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize])

  const paginationProps: Omit<TablePaginationProps, 'pageSizeOptions' | 'className'> = {
    page,
    pageCount,
    totalCount: rows.length,
    pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: setPageSize,
  }

  return { pageRows, setCurrentPage, paginationProps }
}
