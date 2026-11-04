import { useRef, useState, type PointerEvent } from 'react'
import SignatureFullscreen from './SignatureFullscreen'
import { Button } from '@/components/ui/button'
import { fitStrokes, type Stroke } from '@/lib/signatureStrokes'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 160
// Un tracé plein écran plus petit que la zone peut être agrandi jusqu'à ×1,5 (la petite
// zone fait ~340 px CSS de large sur téléphone pour 500 unités de canvas).
const MAX_UPSCALE = 1.5

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  function getContext() {
    return canvasRef.current?.getContext('2d') ?? null
  }

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext()
    if (!ctx) return
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const { x, y } = pointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = getContext()
    if (!ctx) return
    const { x, y } = pointFromEvent(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#241f19'
    ctx.lineTo(x, y)
    ctx.stroke()
    if (isEmpty) setIsEmpty(false)
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (canvas && !isEmpty) onChange(canvas.toDataURL('image/png'))
  }

  // Valider dans la grande zone remplace la signature de la petite zone : tracés rejoués à
  // l'échelle dans le canvas 500 × 160, donc même format (PNG) et même ordre de taille.
  function handleFullscreenValidate(strokes: Stroke[]) {
    setFullscreenOpen(false)
    const canvas = canvasRef.current
    const ctx = getContext()
    const fit = fitStrokes(strokes, CANVAS_WIDTH, CANVAS_HEIGHT, 8, MAX_UPSCALE)
    if (!canvas || !ctx || !fit) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#241f19'
    for (const stroke of strokes) {
      if (stroke.length === 0) continue
      const pts = stroke.map((p) => ({ x: p.x * fit.scale + fit.offsetX, y: p.y * fit.scale + fit.offsetY }))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      // Point isolé : segment nul, rendu en point grâce au lineCap rond.
      if (pts.length === 1) ctx.lineTo(pts[0].x, pts[0].y)
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    setIsEmpty(false)
    onChange(canvas.toDataURL('image/png'))
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full touch-none rounded-sm border border-paper-border bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-registre text-xs text-ink-faint">Signez avec la souris ou le doigt</p>
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="shrink-0 font-registre text-xs font-medium text-ink-faint hover:text-ink-muted disabled:opacity-40"
        >
          Effacer
        </button>
      </div>
      <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setFullscreenOpen(true)}>
        Signer en plein écran
      </Button>
      <SignatureFullscreen
        open={fullscreenOpen}
        onCancel={() => setFullscreenOpen(false)}
        onValidate={handleFullscreenValidate}
      />
    </div>
  )
}
