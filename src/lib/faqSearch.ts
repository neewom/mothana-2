// Recherche du centre d'aide (/aide) : insensible à la casse, aux accents et à la ponctuation
// (apostrophes droites ou typographiques, guillemets, tirets), mots cherchés dans n'importe quel
// ordre, dans la question, la réponse et les étapes. Constaté le 2026-11-09 : « demande
// d'adhésion » (apostrophe droite) ne trouvait pas « demande d’adhésion » (apostrophe typographique).

const DIACRITICS_PATTERN = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
const PONCTUATION_PATTERN = /[’‘ʼ'`´"“”«»‹›\-–—_.,;:!?()[\]/\\›>]+/g

export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .toLowerCase()
    .replace(PONCTUATION_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ElementRecherchable {
  question: string
  answer: string
  steps?: string[]
}

/** Vrai si chaque mot de la recherche figure dans la question, la réponse ou les étapes. */
export function correspondRecherche(element: ElementRecherchable, recherche: string): boolean {
  const mots = normaliserRecherche(recherche).split(' ').filter(Boolean)
  if (mots.length === 0) return true
  const texte = normaliserRecherche([element.question, element.answer, ...(element.steps ?? [])].join(' '))
  return mots.every((mot) => texte.includes(mot))
}
