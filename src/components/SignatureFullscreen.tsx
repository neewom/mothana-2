import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Stroke } from '@/lib/signatureStrokes'

interface SignatureFullscreenProps {
  open: boolean
  /** Annuler (bouton, croix, Échap) : rien n'est modifié dans la petite zone. */
  onCancel: () => void
  /** Valider : tracés en pixels CSS de la grande zone, rejoués par `SignaturePad`. */
  onValidate: (strokes: Stroke[]) => void
}

const INK = '#241f19'
const LINE_WIDTH = 3

/** Grande zone de signature, au-dessus de tout (`ui/dialog` plein écran : focus piégé,
 * Échap = Annuler, défilement de la page bloqué). Les tracés sont gardés en mémoire pour
 * être redessinés si l'écran tourne et rejoués à la validation. */
export default function SignatureFullscreen({ open, onCancel, onValidate }: SignatureFullscreenProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent fullScreen aria-describedby="signature-plein-ecran-aide">
        {open && <SignatureSurface onCancel={onCancel} onValidate={onValidate} />}
      </DialogContent>
    </Dialog>
  )
}

function SignatureSurface({ onCancel, onValidate }: Omit<SignatureFullscreenProps, 'open'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = LINE_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = INK
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }, [])

  // Canvas à la taille réelle de sa zone (densité d'écran comprise), recalculé à la rotation.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [redraw])

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    strokesRef.current.push([pointFromEvent(e)])
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const stroke = strokesRef.current[strokesRef.current.length - 1]
    const prev = stroke[stroke.length - 1]
    const p = pointFromEvent(e)
    stroke.push(p)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineWidth = LINE_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = INK
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    if (isEmpty) setIsEmpty(false)
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  function handleClear() {
    strokesRef.current = []
    setIsEmpty(true)
    redraw()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-paper-border px-4 py-3 pr-12">
        <DialogTitle className="text-base">Signature</DialogTitle>
        <DialogDescription id="signature-plein-ecran-aide" className="text-xs text-ink-faint">
          Signez dans le cadre avec le doigt ou un stylet.
          <span className="landscape:hidden"> Tournez votre téléphone pour plus de place.</span>
        </DialogDescription>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <canvas
          ref={canvasRef}
          aria-label="Zone de signature"
          className="h-full w-full touch-none select-none rounded-sm border border-paper-border bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-paper-border px-4 py-3">
        <Button type="button" variant="ghost" onClick={handleClear} disabled={isEmpty}>
          Effacer
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="button" onClick={() => onValidate(strokesRef.current)} disabled={isEmpty}>
            Valider
          </Button>
        </div>
      </div>
    </div>
  )
}
