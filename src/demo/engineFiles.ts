// Fichiers du moteur Postgres (PGlite) que la démo télécharge elle-même, pour suivre leur
// progression et les passer à PGlite déjà prêts (sans quoi PGlite les chargerait sans aucun
// suivi possible). Ce sont les mêmes fichiers que ceux que PGlite référence : le build n'en
// produit qu'un exemplaire chacun (même contenu, même nom haché).
//
// Les tailles sont celles des fichiers non compressés (version de PGlite figée dans
// package.json) : elles servent à calculer l'avancement quand le serveur compresse à la volée
// (on lit alors des octets décompressés). Vérifiées par engineFiles.test.ts.
import pgliteWasmUrl from '../../node_modules/@electric-sql/pglite/dist/pglite.wasm?url'
import pgliteDataUrl from '../../node_modules/@electric-sql/pglite/dist/pglite.data?url'
import initdbWasmUrl from '../../node_modules/@electric-sql/pglite/dist/initdb.wasm?url'

export interface EngineFile {
  key: 'pgliteWasm' | 'pgliteData' | 'initdbWasm'
  url: string
  /** Taille du fichier non compressé, en octets. */
  bytes: number
  /** Chemin du fichier dans node_modules (pour le test de cohérence des tailles). */
  source: string
}

export const ENGINE_FILES: EngineFile[] = [
  { key: 'pgliteWasm', url: pgliteWasmUrl, bytes: 9086480, source: '@electric-sql/pglite/dist/pglite.wasm' },
  { key: 'pgliteData', url: pgliteDataUrl, bytes: 6242272, source: '@electric-sql/pglite/dist/pglite.data' },
  { key: 'initdbWasm', url: initdbWasmUrl, bytes: 298788, source: '@electric-sql/pglite/dist/initdb.wasm' },
]
