import { loader } from '@monaco-editor/react'

// Monaco est chargé depuis jsDelivr par @monaco-editor/react. La version est épinglée ici
// parce que la Content-Security-Policy (vercel.json) n'autorise que ce chemin précis :
// changer de version = changer aussi la CSP (le test monacoLoader.test.ts le vérifie).
export const MONACO_CDN_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/'

export function configurerMonaco(): void {
  loader.config({ paths: { vs: `${MONACO_CDN_BASE}min/vs` } })
}
