import Papa from 'papaparse'

// Une cellule texte qui commence par =, +, -, @, une tabulation ou un retour chariot peut être
// interprétée comme une formule à l'ouverture dans un tableur (injection CSV) : elle est préfixée
// d'une apostrophe et reste du texte. Exceptions : les nombres (type number) et les montants
// négatifs déjà formatés en chaîne (« -50,00 », « -1 234,50 ») — inoffensifs, ils doivent rester
// lisibles comme des nombres.
const DEBUT_DANGEREUX = /^[=+\-@\t\r]/
const NOMBRE_NEGATIF = /^-\d[\d\s\u00a0\u202f]*([.,]\d+)?$/

export function neutraliserCellule(value: string | number): string | number {
  if (typeof value !== 'string' || !DEBUT_DANGEREUX.test(value) || NOMBRE_NEGATIF.test(value)) return value
  return `'${value}`
}

// Point-virgule + BOM UTF-8 : Excel FR utilise la virgule comme séparateur
// décimal, donc traite le point-virgule comme délimiteur de colonnes par
// défaut à l'ouverture d'un CSV — sans ça les colonnes ne se séparent pas.
export function toCsv(rows: Record<string, string | number>[]): string {
  const neutralisees = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutraliserCellule(value)])),
  )
  return Papa.unparse(neutralisees, { delimiter: ';' })
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
