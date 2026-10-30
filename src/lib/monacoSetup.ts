// Monaco servi depuis notre build (plus de CDN tiers dans la CSP). Ce module n'est jamais
// importé statiquement : `chargerMonaco()` (monacoLoader.ts) le charge à la première
// ouverture d'un éditeur, pour garder monaco-editor hors du chunk principal.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
// Fonctionnalités de l'éditeur (suggestions, recherche, repli…) sans les ~80 langages
// d'editor.main : les éditeurs de l'application n'utilisent que HTML et CSS.
import 'monaco-editor/esm/vs/editor/edcore.main.js'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js'
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/css/monaco.contribution.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    return new EditorWorker()
  },
}

loader.config({ monaco })
