import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListeDonnees, type ColonneListe } from './liste-donnees'
import { ecrireModeListe, lireModeListe, optionsDeTri, repartirParRole } from '../../lib/listeDonnees'

interface Ligne {
  id: string
  nom: string
  montant: number
  date: string
  activite: string | null
  mode: string
}

type Champ = 'nom' | 'montant' | 'date'

const LIGNES: Ligne[] = [
  { id: 'a', nom: 'Alice Martin', montant: 50, date: '2026-01-02', activite: 'Fête', mode: 'Chèque' },
  { id: 'b', nom: 'Bruno Dupont', montant: 120, date: '2026-02-03', activite: null, mode: 'Espèces' },
]

const COLONNES: ColonneListe<Ligne, Champ>[] = [
  { key: 'date', label: 'Date', sortField: 'date', role: 'secondaire', cell: (l) => l.date },
  { key: 'montant-mobile', label: 'Montant', sortField: 'montant', role: 'masquee', cell: (l) => `M${l.montant}` },
  { key: 'nom', label: 'Donateur', sortField: 'nom', role: 'titre', cell: (l) => l.nom },
  { key: 'activite', label: 'Activité', role: 'secondaire', cell: (l) => l.activite ?? '—', carte: (l) => l.activite },
  { key: 'montant', label: 'Montant', sortField: 'montant', role: 'montant', align: 'right', cell: (l) => `${l.montant} €` },
  { key: 'mode', label: 'Mode', role: 'pastille', cell: (l) => <span className="pastille">{l.mode}</span> },
]

const sort = { field: 'date' as Champ, direction: 'desc' as const, onSort: () => {} }

describe('repartirParRole', () => {
  it('range les colonnes par rôle, dans l’ordre, sans les colonnes masquées', () => {
    const roles = repartirParRole(COLONNES)
    expect(roles.titre.map((c) => c.key)).toEqual(['nom'])
    expect(roles.montant.map((c) => c.key)).toEqual(['montant'])
    expect(roles.secondaire.map((c) => c.key)).toEqual(['date', 'activite'])
    expect(roles.pastille.map((c) => c.key)).toEqual(['mode'])
  })
})

describe('optionsDeTri', () => {
  it('donne une option par clé de tri, dans l’ordre des colonnes, sans doublon', () => {
    expect(optionsDeTri(COLONNES)).toEqual([
      { field: 'date', label: 'Date' },
      { field: 'montant', label: 'Montant' },
      { field: 'nom', label: 'Donateur' },
    ])
  })
})

describe('préférence tableau / cartes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('vaut « cartes » par défaut et relit le choix enregistré, par liste', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
    })
    expect(lireModeListe('dons')).toBe('cartes')
    ecrireModeListe('dons', 'tableau')
    expect(lireModeListe('dons')).toBe('tableau')
    expect(lireModeListe('adherents')).toBe('cartes')
  })

  it('ignore une valeur inconnue et tient sans stockage', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'grille', setItem: () => {} })
    expect(lireModeListe('dons')).toBe('cartes')
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqué') },
      setItem: () => { throw new Error('bloqué') },
    })
    expect(lireModeListe('dons')).toBe('cartes')
    expect(() => ecrireModeListe('dons', 'tableau')).not.toThrow()
  })
})

describe('ListeDonnees — tableau', () => {
  const html = renderToStaticMarkup(
    <ListeDonnees rows={LIGNES} rowKey={(l) => l.id} columns={COLONNES} mode="tableau" sort={sort} onRowClick={() => {}} activeKey="b" />,
  )

  it('rend une ligne par élément, toutes les colonnes et le chevron', () => {
    expect((html.match(/<tr/g) ?? []).length).toBe(3)
    expect((html.match(/<th[ >]/g) ?? []).length).toBe(COLONNES.length + 1)
    expect(html).toContain('M50')
  })

  it('rend les en-têtes triables avec le sens de la colonne active', () => {
    expect(html).toContain('aria-sort="descending"')
    expect((html.match(/aria-sort="none"/g) ?? []).length).toBe(3)
  })

  it('rend les lignes cliquables atteignables au clavier et marque la ligne ouverte', () => {
    expect((html.match(/<tr[^>]*tabindex="0"/g) ?? []).length).toBe(2)
    expect(html).toMatch(/<tr[^>]*aria-current="true"/)
  })
})

describe('ListeDonnees — cartes', () => {
  const html = renderToStaticMarkup(
    <ListeDonnees rows={LIGNES} rowKey={(l) => l.id} columns={COLONNES} mode="cartes" sort={sort} onRowClick={() => {}} />,
  )

  it('rend une carte bouton par élément, sans colonne masquée', () => {
    expect((html.match(/<li/g) ?? []).length).toBe(2)
    expect((html.match(/<button[^>]*type="button"/g) ?? []).length).toBe(3) // 2 cartes + sens du tri
    expect(html).not.toContain('M50')
    expect(html).not.toContain('<table')
  })

  it('place titre, montant, méta et pastille, sans valeur vide', () => {
    expect(html).toContain('Alice Martin')
    expect(html).toContain('50 €')
    expect(html).toContain('2026-01-02')
    expect(html).toContain('Fête')
    expect(html).toContain('class="pastille"')
    // Bruno n'a pas d'activité : pas de séparateur ni de tiret orphelin.
    expect(html).not.toContain('—')
  })

  it('propose « Trier par » avec les clés de tri et le tri courant sélectionné', () => {
    expect(html).toContain('Trier par')
    expect(html).toMatch(/<option value="date" selected="">Date<\/option>/)
    expect((html.match(/<option value=/g) ?? []).length).toBe(3)
    expect(html).toContain('Ordre décroissant, inverser')
  })

  it('affiche les cases et « Tout sélectionner » seulement si demandé', () => {
    const sansCases = renderToStaticMarkup(
      <ListeDonnees rows={LIGNES} rowKey={(l) => l.id} columns={COLONNES} mode="cartes"
        selection={{ selected: new Set(), onToggle: () => {}, onToggleAll: () => {}, showInCards: false }} />,
    )
    expect(sansCases).not.toContain('checkbox')
    const avecCases = renderToStaticMarkup(
      <ListeDonnees rows={LIGNES} rowKey={(l) => l.id} columns={COLONNES} mode="cartes" rowLabel={(l) => l.nom}
        selection={{ selected: new Set(['a']), onToggle: () => {}, onToggleAll: () => {}, showInCards: true }} />,
    )
    expect((avecCases.match(/type="checkbox"/g) ?? []).length).toBe(3)
    expect(avecCases).toContain('Tout sélectionner')
    expect(avecCases).toContain('aria-label="Sélectionner Alice Martin"')
  })
})

describe('ListeDonnees — rowClassName', () => {
  const signaler = (l: Ligne) => (l.id === 'b' ? 'ligne-signalee' : undefined)

  it('applique les classes propres à une ligne, en tableau comme en cartes', () => {
    for (const mode of ['tableau', 'cartes'] as const) {
      const html = renderToStaticMarkup(
        <ListeDonnees rows={LIGNES} rowKey={(l) => l.id} columns={COLONNES} mode={mode} onRowClick={() => {}} rowClassName={signaler} />,
      )
      expect((html.match(/ligne-signalee/g) ?? []).length).toBe(1)
    }
  })
})
