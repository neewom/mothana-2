import { describe, expect, it, vi } from 'vitest'
import { disposeQrScanner, type QrScannerLike } from './qrScannerLifecycle'

describe('cycle de vie du scanner QR', () => {
  it('attend la fin du démarrage avant d’arrêter et nettoyer la caméra', async () => {
    let resolveStart!: () => void
    const startPromise = new Promise<void>((resolve) => { resolveStart = resolve })
    const scanner: QrScannerLike = {
      isScanning: false,
      stop: vi.fn(async () => undefined),
      clear: vi.fn(),
    }

    const disposing = disposeQrScanner(scanner, startPromise)
    await Promise.resolve()
    expect(scanner.stop).not.toHaveBeenCalled()
    expect(scanner.clear).not.toHaveBeenCalled()

    scanner.isScanning = true
    resolveStart()
    await disposing

    expect(scanner.stop).toHaveBeenCalledOnce()
    expect(scanner.clear).toHaveBeenCalledOnce()
  })

  it('nettoie aussi le conteneur lorsque l’autorisation caméra est refusée', async () => {
    const scanner: QrScannerLike = {
      isScanning: false,
      stop: vi.fn(async () => undefined),
      clear: vi.fn(),
    }

    await disposeQrScanner(scanner, Promise.reject(new Error('permission refusée')))

    expect(scanner.stop).not.toHaveBeenCalled()
    expect(scanner.clear).toHaveBeenCalledOnce()
  })
})
