import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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

  it("n'autorise plus jsDelivr (Monaco est servi par notre build)", () => {
    expect(readFileSync('vercel.json', 'utf8')).not.toContain('jsdelivr')
  })

  it.each(['script-src', 'style-src', 'font-src', 'worker-src'])("n'autorise aucun CDN tiers pour Monaco dans %s", (nom) => {
    for (const csp of csps) expect(directive(csp, nom).some((source) => source.includes('monaco'))).toBe(false)
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

describe('chargement de Monaco', () => {
  it.each(['src/lib/monacoLoader.ts', 'src/lib/monacoSetup.ts'])('%s ne référence aucun CDN', (fichier) => {
    const source = readFileSync(fichier, 'utf8')
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toContain('jsdelivr')
  })

  it("n'est importé statiquement par aucun point d'entrée", () => {
    expect(readFileSync('src/main.tsx', 'utf8')).not.toContain('monaco')
    for (const fichier of ['src/components/CodeEditor.tsx', 'src/lib/monacoLoader.ts']) {
      expect(readFileSync(fichier, 'utf8')).not.toMatch(/from '(monaco-editor|\.\/monacoSetup)/)
    }
  })
})
