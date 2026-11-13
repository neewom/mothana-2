// Démo publique : sert un build de la démo comme Vercel le fait sur demo.samakan.fr (vercel.json) :
// redirections, réécriture vers demo.html, en-têtes (dont la CSP de la démo), brotli, ETag.
// Utilisé par le test de fumée (scripts/demo-smoke.py) ; écoute sur 127.0.0.1 uniquement.
//   node scripts/serve-demo.mjs <dossier du build> [port]   (port 0 : choisi par le système)
// Écrit « ok <port> » sur la sortie standard une fois prêt.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const [distArg, portArg = '0'] = process.argv.slice(2)
if (!distArg) {
  console.error('usage : node scripts/serve-demo.mjs <dossier du build> [port]')
  process.exit(1)
}
const dist = path.resolve(distArg)
const vercelJson = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json')
const v = JSON.parse(fs.readFileSync(vercelJson, 'utf8'))
const HOST = 'demo.samakan.fr'
const hostOk = (r) => (r.has ?? []).every((h) => h.value === HOST) && !(r.missing ?? []).some((h) => h.value === HOST)
const srcRe = (s) => new RegExp('^' + s + '$')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gz': 'application/gzip',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}
const brotliCache = new Map()

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const redirect = v.redirects.find((r) => r.source === url.pathname && hostOk(r))
  if (redirect) {
    res.writeHead(307, { Location: redirect.destination })
    return res.end()
  }
  const h = { 'Cache-Control': 'public, max-age=0, must-revalidate' }
  for (const rule of v.headers) if (hostOk(rule) && srcRe(rule.source).test(url.pathname)) for (const x of rule.headers) h[x.key] = x.value

  // Fichier existant du build, sinon réécriture vers demo.html (comme le rewrite de vercel.json).
  let file = path.join(dist, decodeURIComponent(url.pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'demo.html')
  const ext = path.extname(file)
  const body = fs.readFileSync(file)
  const etag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"'
  h['Content-Type'] = TYPES[ext] ?? 'application/octet-stream'
  h.ETag = etag
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, h)
    return res.end()
  }
  if ((req.headers['accept-encoding'] ?? '').includes('br') && !['.gz', '.webp', '.png'].includes(ext)) {
    if (!brotliCache.has(etag)) brotliCache.set(etag, zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }))
    const br = brotliCache.get(etag)
    h['Content-Encoding'] = 'br'
    h['Content-Length'] = br.length
    res.writeHead(200, h)
    return res.end(br)
  }
  res.writeHead(200, h)
  res.end(body)
})

server.listen(Number(portArg), '127.0.0.1', () => console.log('ok', server.address().port))
