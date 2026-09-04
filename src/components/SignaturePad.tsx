import { useRef, useState, type PointerEvent } from 'react'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 160

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

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
      <div className="mt-2 flex items-center justify-between">
        <p className="font-registre text-xs text-ink-faint">Signez avec la souris ou le doigt</p>
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="font-registre text-xs font-medium text-ink-faint hover:text-ink-muted disabled:opacity-40"
        >
          Effacer
        </button>
      </div>
    </div>
  )
}
