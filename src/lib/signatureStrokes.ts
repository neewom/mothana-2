// Tracés d'une signature saisie dans la grande zone (plein écran), rejoués dans la petite
// zone de `SignaturePad` pour produire la même image qu'aujourd'hui (PNG 500 × 160) :
// la taille de l'image envoyée ne dépend donc pas de la taille de l'écran.

export interface Point {
  x: number
  y: number
}

export type Stroke = Point[]

export interface FitTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/** Mise à l'échelle qui fait tenir le cadre englobant des tracés dans une zone
 * `width` × `height` (marge `padding` incluse), centré, sans déformation. Un tracé plus
 * petit que la zone n'est pas agrandi au-delà de `maxScale`. `null` sans aucun point. */
export function fitStrokes(
  strokes: Stroke[],
  width: number,
  height: number,
  padding = 8,
  maxScale = 1,
): FitTransform | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const p of stroke) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  if (minX === Infinity) return null
  const boxW = Math.max(maxX - minX, 1)
  const boxH = Math.max(maxY - minY, 1)
  const scale = Math.min((width - 2 * padding) / boxW, (height - 2 * padding) / boxH, maxScale)
  return {
    scale,
    offsetX: (width - boxW * scale) / 2 - minX * scale,
    offsetY: (height - boxH * scale) / 2 - minY * scale,
  }
}
