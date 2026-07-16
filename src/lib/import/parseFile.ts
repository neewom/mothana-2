import ExcelJS from 'exceljs'
import Papa from 'papaparse'

export interface ParsedFile {
  headers: string[]
  rows: unknown[][]
}

// Convertit un index de colonne 1-indexé en lettre(s) façon tableur (1->A, 26->Z, 27->AA...).
function columnLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// En-tête vide (colonne jamais renseignée dans le fichier) : plutôt qu'une
// chaîne vide invisible dans le menu de mapping, un nom lisible basé sur la
// position de la colonne (ex : "Colonne C").
function headerLabel(raw: unknown, columnIndex0: number): string {
  const trimmed = String(raw ?? '').trim()
  return trimmed === '' ? `Colonne ${columnLetter(columnIndex0 + 1)}` : trimmed
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  return isCsv ? parseCsvFile(file) : parseXlsxFile(file)
}

async function parseCsvFile(file: File): Promise<ParsedFile> {
  const text = await file.text()
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  const [headerRow, ...dataRows] = result.data
  return {
    headers: (headerRow ?? []).map((h, i) => headerLabel(h, i)),
    rows: dataRows,
  }
}

// ExcelJS ne renvoie pas toujours une valeur "plate" : les cellules avec lien
// hypertexte (ex : un email auto-converti en lien par Excel), le texte enrichi
// ou les formules sont des objets ({ text, hyperlink }, { richText }, { result }).
// Sans normalisation, ces objets finissent stringifiés en "[object Object]".
function normalizeCellValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('text' in value) return (value as { text: unknown }).text
    if ('richText' in value) {
      const parts = (value as { richText: { text: string }[] }).richText
      return parts.map((p) => p.text).join('')
    }
    if ('result' in value) return (value as { result: unknown }).result
  }
  return value
}

async function parseXlsxFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  // Une seule feuille prise en compte : la première du classeur.
  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [] }

  const rows: unknown[][] = []
  sheet.eachRow((row) => {
    // Une colonne jamais renseignée (ex : en-tête vide) crée un "trou" dans
    // row.values plutôt qu'un simple undefined explicite. Array.from() comble
    // ces trous (undefined explicite) : sans ça, .map() ci-dessous les
    // ignorerait silencieusement, laissant le trou se propager jusqu'à
    // guessMapping où .findIndex() (qui NE saute PAS les trous, contrairement
    // à .map()) finit par appeler normalizeHeader/partialMatch avec undefined.
    const values = Array.from(row.values as unknown[])
    // ExcelJS indexe row.values à partir de 1 ; l'index 0 est toujours vide.
    rows.push(values.slice(1).map(normalizeCellValue))
  })

  const [headerRow, ...dataRows] = rows
  const headers = (headerRow ?? []).map((h, i) => headerLabel(h, i))
  return { headers, rows: dataRows }
}
