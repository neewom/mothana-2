import { describe, expect, it } from 'vitest'
import { escapeHtml, validerDemandeAdhesion } from '../../supabase/functions/soumettre-demande-adhesion/validation'

const today = new Date('2026-10-17T12:00:00Z')
const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=='
const valide = {
  slug: 'demo',
  site_web: '',
  civilite: 2,
  nom: 'VONGSA',
  prenom: 'Amphone',
  date_naissance: '1980-03-07',
  adresse: '3 rue des Lilas',
  code_postal: '77000',
  ville: 'Melun',
  pays: 'France',
  telephone: '0601020304',
  courriel: 'amphone@exemple.fr',
  signature_data_url: signature,
  accepte_statuts: true,
  consent_rgpd: true,
}

describe('validerDemandeAdhesion', () => {
  it('accepte une demande conforme au formulaire', () => {
    const r = validerDemandeAdhesion(valide, true, today)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.piege).toBe(false)
      expect(r.demande).toMatchObject({ nom: 'VONGSA', code_postal: '77000', accepte_statuts: true, consent_rgpd: true })
    }
  })

  it('refuse les champs obligatoires manquants ou mal formés', () => {
    const refus = [
      { nom: '  ' },
      { code_postal: '7700' },
      { civilite: 5 },
      { courriel: 'pas-un-email' },
      { date_naissance: '2026-01-01' },
      { date_naissance: '1980-02-31' },
      { telephone: '06<script>' },
      { consent_rgpd: false },
      { signature_data_url: 'data:text/html;base64,PGgxPg==' },
      { signature_data_url: 'data:image/png;base64,"><img src=x>' },
      { nom: 'x'.repeat(101) },
      { prenom: 42 },
    ]
    for (const champ of refus) {
      expect(validerDemandeAdhesion({ ...valide, ...champ }, true, today).ok, JSON.stringify(champ)).toBe(false)
    }
    expect(validerDemandeAdhesion(null, true, today).ok).toBe(false)
    expect(validerDemandeAdhesion([valide], true, today).ok).toBe(false)
  })

  it('exige la case des statuts seulement si l’organisation en publie', () => {
    expect(validerDemandeAdhesion({ ...valide, accepte_statuts: false }, true, today).ok).toBe(false)
    const sansStatuts = validerDemandeAdhesion({ ...valide, accepte_statuts: false }, false, today)
    expect(sansStatuts.ok && sansStatuts.demande.accepte_statuts).toBe(true)
  })

  it('signale le champ piège rempli', () => {
    const r = validerDemandeAdhesion({ ...valide, site_web: 'http://spam.example' }, true, today)
    expect(r.ok && r.piege).toBe(true)
  })

  it('transforme les champs optionnels vides en null', () => {
    const r = validerDemandeAdhesion({ ...valide, prenom: '', courriel: null, telephone: undefined }, true, today)
    expect(r.ok && [r.demande.prenom, r.demande.courriel, r.demande.telephone]).toEqual([null, null, null])
  })
})

describe('escapeHtml', () => {
  it('rend un lien saisi dans le prénom en texte', () => {
    expect(escapeHtml('<a href="https://evil.example">Cliquez</a> & co')).toBe(
      '&lt;a href=&quot;https://evil.example&quot;&gt;Cliquez&lt;/a&gt; &amp; co',
    )
  })
})
