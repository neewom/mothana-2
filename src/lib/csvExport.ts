import Papa from 'papaparse'

// Point-virgule + BOM UTF-8 : Excel FR utilise la virgule comme séparateur
// décimal, donc traite le point-virgule comme délimiteur de colonnes par
// défaut à l'ouverture d'un CSV — sans ça les colonnes ne se séparent pas.
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const csv = Papa.unparse(rows, { delimiter: ';' })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
