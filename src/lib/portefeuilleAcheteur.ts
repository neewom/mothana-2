import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { MouvementPortefeuilleType } from '../types/portefeuilleAcheteur'

export function extractPortefeuilleSecret(fragment: string): string | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment
  if (!raw) return null

  try {
    const decoded = decodeURIComponent(raw)
    return decoded.length >= 32 && decoded.length <= 256 ? decoded : null
  } catch {
    return null
  }
}
export async function hashPortefeuilleSecret(secret: string): Promise<string> {
  return bytesToHex(sha256(new TextEncoder().encode(secret)))
}

export function formatCentimes(montantCentimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(montantCentimes / 100)
}

export function libelleMouvement(type: MouvementPortefeuilleType): string {
  switch (type) {
    case 'credit_initial':
      return 'Crédit initial'
    case 'credit_recharge':
      return 'Recharge'
    case 'debit':
      return 'Paiement'
  }
}

export function formatPeriodeEvenement(dateDebut: string, dateFin: string): string {
  const format = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const start = new Date(`${dateDebut}T12:00:00`)
  const end = new Date(`${dateFin}T12:00:00`)
  if (dateDebut === dateFin) return format.format(start)
  return `Du ${format.format(start)} au ${format.format(end)}`
}

export function formatDateMouvement(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
