// Téléchargement suivi du moteur Postgres (PGlite) : les trois fichiers partent dès l'ouverture de
// la page, en parallèle du code de l'application, et chaque octet reçu fait avancer la barre de
// l'écran d'attente. Les fichiers .wasm sont compilés pendant leur téléchargement.
import { ENGINE_FILES, type EngineFile } from './engineFiles'

/** Fichiers du moteur prêts à être passés à PGlite (options du même nom). */
export interface EngineAssets {
  pgliteWasmModule: WebAssembly.Module
  initdbWasmModule: WebAssembly.Module
  fsBundle: Blob
}

/** État d'un fichier pendant son téléchargement. */
export interface FileProgress {
  /** Octets attendus une fois décompressés (ce que lit le navigateur). */
  decodedTotal: number
  /** Octets décompressés déjà reçus. */
  decodedLoaded: number
  /**
   * Octets à transférer sur le réseau : en-tête Content-Length (taille compressée si le serveur
   * compresse). `null` : inconnu (réponse sans Content-Length). `undefined` : en-têtes pas encore reçus.
   */
  transferTotal: number | null | undefined
}

export interface DownloadProgress {
  /** Avancement de 0 à 1. */
  fraction: number
  /** Octets transférés (estimation proportionnelle), `null` tant que le total réseau est inconnu. */
  loadedBytes: number | null
  /** Total à transférer sur le réseau, `null` s'il est inconnu. */
  totalBytes: number | null
}

/** Résume l'état des fichiers en un avancement global et, si possible, en octets transférés. */
export function summarizeDownload(files: FileProgress[]): DownloadProgress {
  const decodedTotal = files.reduce((s, f) => s + f.decodedTotal, 0)
  const decodedLoaded = files.reduce((s, f) => s + Math.min(f.decodedLoaded, f.decodedTotal), 0)
  const fraction = decodedTotal > 0 ? decodedLoaded / decodedTotal : 0
  if (files.some((f) => f.transferTotal == null)) return { fraction, loadedBytes: null, totalBytes: null }
  let loadedBytes = 0
  let totalBytes = 0
  for (const f of files) {
    const total = f.transferTotal as number
    totalBytes += total
    loadedBytes += f.decodedTotal > 0 ? total * Math.min(1, f.decodedLoaded / f.decodedTotal) : 0
  }
  return { fraction, loadedBytes, totalBytes }
}

/** Taille en mégaoctets, à la française (« 1,2 »). */
export function formatMegabytes(bytes: number): string {
  return (bytes / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

async function fetchFile(file: EngineFile, state: FileProgress, onChange: () => void): Promise<WebAssembly.Module | Blob> {
  const response = await fetch(file.url)
  if (!response.ok) throw new Error(`Téléchargement du moteur impossible (${response.status})`)
  const length = Number(response.headers.get('Content-Length')) || null
  const encoded = !!response.headers.get('Content-Encoding')
  // Sans compression, la taille réseau est aussi la taille lue.
  if (!encoded && length) state.decodedTotal = length
  state.transferTotal = length
  onChange()

  const count = (chunk: Uint8Array) => {
    state.decodedLoaded += chunk.byteLength
    onChange()
  }

  if (file.key !== 'pgliteData' && typeof WebAssembly.compileStreaming === 'function' && response.body) {
    // La réponse d'origine va telle quelle à la compilation (le navigateur garde alors le code
    // compilé en cache pour les visites suivantes) ; une copie sert à compter les octets.
    readCounting(response.clone(), count, false).catch(() => undefined)
    return WebAssembly.compileStreaming(response)
  }
  const buffer = await readCounting(response, count)
  if (file.key === 'pgliteData') return new Blob([buffer])
  return WebAssembly.compile(buffer)
}

/** Lit une réponse en entier en signalant chaque bloc reçu (`keep` : en garder le contenu). */
async function readCounting(response: Response, onChunk: (chunk: Uint8Array) => void, keep = true): Promise<ArrayBuffer> {
  if (!response.body) {
    // Navigateur sans flux de lecture : avancement d'un bloc à la fin du fichier.
    const buffer = await response.arrayBuffer()
    onChunk(new Uint8Array(buffer))
    return buffer
  }
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (keep) chunks.push(value)
    onChunk(value)
  }
  return new Blob(chunks as BlobPart[]).arrayBuffer()
}

/** Télécharge les fichiers du moteur ; `onProgress` est appelé à chaque bloc reçu. */
export async function downloadEngine(onProgress: (progress: DownloadProgress) => void): Promise<EngineAssets> {
  const states: FileProgress[] = ENGINE_FILES.map((f) => ({ decodedTotal: f.bytes, decodedLoaded: 0, transferTotal: undefined }))
  // Un rafraîchissement par image au plus : les blocs arrivent par dizaines par seconde.
  let scheduled = false
  const report = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      onProgress(summarizeDownload(states))
    })
  }
  const results = await Promise.all(ENGINE_FILES.map((f, i) => fetchFile(f, states[i], report)))
  onProgress(summarizeDownload(states))
  const byKey = Object.fromEntries(ENGINE_FILES.map((f, i) => [f.key, results[i]]))
  return {
    pgliteWasmModule: byKey.pgliteWasm as WebAssembly.Module,
    initdbWasmModule: byKey.initdbWasm as WebAssembly.Module,
    fsBundle: byKey.pgliteData as Blob,
  }
}
