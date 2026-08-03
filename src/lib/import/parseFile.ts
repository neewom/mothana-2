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

// Réparation d'un mojibake fréquent sur les exports legacy français : le
// fichier source était correctement encodé en UTF-8, mais a été relu (puis
// re-sauvegardé) quelque part en amont en supposant Windows-1252/Latin-1 —
// chaque octet UTF-8 devient alors un caractère Latin-1 séparé (ex : "é"
// = 0xC3 0xA9 en UTF-8 → "Ã©" une fois relu en Windows-1252). La corruption
// est déjà gravée dans le fichier, donc réversible à l'octet près.
//
// "Ã"/"Â" (U+00C3/U+00C2, décodage Latin-1 des octets de tête UTF-8 0xC3/0xC2
// utilisés pour les lettres accentuées françaises) suivi d'un octet de
// continuation (U+0080-U+00BF) est une signature fiable : ce motif
// n'apparaît essentiellement jamais dans du texte français légitime. Le
// round-trip est en plus validé strictement (fatal: true) : si les octets ne
// forment pas un UTF-8 valide, on garde la valeur d'origine sans y toucher.
const MOJIBAKE_MARKER = /[ÃÂ][-¿]/

function repairMojibake(s: string): string {
  if (!MOJIBAKE_MARKER.test(s)) return s
  const codePoints = Array.from(s, (c) => c.codePointAt(0)!)
  if (!codePoints.every((cp) => cp <= 0xff)) return s
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(codePoints))
  } catch {
    return s
  }
}

function repairMojibakeValue(value: unknown): unknown {
  return typeof value === 'string' ? repairMojibake(value) : value
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
    headers: (headerRow ?? []).map((h, i) => headerLabel(repairMojibakeValue(h), i)),
    rows: dataRows.map((row) => row.map(repairMojibakeValue)),
  }
}

// ExcelJS ne renvoie pas toujours une valeur "plate" : les cellules avec lien
// hypertexte (ex : un email auto-converti en lien par Excel), le texte enrichi
// ou les formules sont des objets ({ text, hyperlink }, { richText }, { result }).
// Sans normalisation, ces objets finissent stringifiés en "[object Object]".
function normalizeCellValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('text' in value) return repairMojibakeValue((value as { text: unknown }).text)
    if ('richText' in value) {
      const parts = (value as { richText: { text: string }[] }).richText
      return repairMojibakeValue(parts.map((p) => p.text).join(''))
    }
    if ('result' in value) return repairMojibakeValue((value as { result: unknown }).result)
  }
  return repairMojibakeValue(value)
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
