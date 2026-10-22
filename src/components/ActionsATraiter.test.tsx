import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ActionsATraiter, type ActionATraiter } from './ActionsATraiter'

const action = (key: string, extra: Partial<ActionATraiter> = {}): ActionATraiter => ({
  key, icone: 'M0 0', titre: `Titre ${key}`, detail: `Détail ${key}`, libelle: 'Examiner', to: `/admin/${key}`, ...extra,
})
const rendu = (actions: ActionATraiter[]) => renderToStaticMarkup(<MemoryRouter><ActionsATraiter actions={actions} /></MemoryRouter>)

describe('ActionsATraiter', () => {
  it('n’affiche rien sans action', () => {
    expect(rendu([])).toBe('')
  })

  it('affiche une ligne par action, avec le nombre dans la pastille', () => {
    const html = rendu([action('demandes')])
    expect(html).toContain('À traiter')
    expect((html.match(/<li/g) ?? []).length).toBe(1)
    expect(html).toContain('href="/admin/demandes"')
    expect(html).toMatch(/>1<\/span>/)
  })

  it('rend un bouton pour une action sans destination (ouverture de modale)', () => {
    const html = rendu([action('a'), action('b'), action('emails', { to: undefined, onClick: () => {} })])
    expect((html.match(/<li/g) ?? []).length).toBe(3)
    expect((html.match(/<button type="button"/g) ?? []).length).toBe(1)
    expect(html).toMatch(/>3<\/span>/)
  })
})
