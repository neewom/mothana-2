import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MONACO_CDN_BASE } from './monacoLoader'

interface RegleEntetes {
  source: string
  headers: { key: string; value: string }[]
}

const regles = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: RegleEntetes[] }).headers
const csps = regles.flatMap((r) => r.headers.filter((h) => h.key === 'Content-Security-Policy').map((h) => h.value))

function directive(csp: string, nom: string): string[] {
  const d = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${nom} `))
  return d ? d.split(/\s+/).slice(1) : []
}

describe('CSP de vercel.json', () => {
  it('existe pour chaque environnement', () => {
    expect(csps.length).toBeGreaterThanOrEqual(3)
  })

  it.each(['script-src', 'style-src', 'font-src'])('autorise le Monaco épinglé dans %s', (nom) => {
    for (const csp of csps) expect(directive(csp, nom)).toContain(MONACO_CDN_BASE)
  })

  it("n'autorise jamais de script inline ni eval", () => {
    for (const csp of csps) {
      expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'")
      expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'")
    }
  })

  it("interdit l'affichage dans une iframe tierce", () => {
    for (const csp of csps) expect(directive(csp, 'frame-ancestors')).toEqual(["'self'"])
  })
})
