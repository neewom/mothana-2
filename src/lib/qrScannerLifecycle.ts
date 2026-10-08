export interface QrScannerLike {
  isScanning: boolean
  stop: () => Promise<void>
  clear: () => void
}

/**
 * Attend la fin d'un éventuel démarrage avant de libérer la caméra.
 * `html5-qrcode` ne peut pas arrêter un scanner tant que `start()` n'a pas
 * abouti ; ignorer cette attente laisserait un flux vidéo orphelin.
 */
export async function disposeQrScanner(
  scanner: QrScannerLike,
  startPromise: Promise<unknown> | null = null,
): Promise<void> {
  if (startPromise) {
    try {
      await startPromise
    } catch {
      // Un démarrage refusé doit tout de même nettoyer le conteneur.
    }
  }

  try {
    if (scanner.isScanning) await scanner.stop()
  } catch {
    // Le navigateur peut avoir déjà arrêté le flux (changement d'onglet, retrait de permission).
  }

  try {
    scanner.clear()
  } catch {
    // Le conteneur React peut déjà être démonté.
  }
}
