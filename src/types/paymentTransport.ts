export type TransportMode = 'polling' | 'broadcast'
export type SyncReason = 'initial' | 'poll' | 'broadcast' | 'reconnect' | 'resume' | 'mutation'
export interface TransportSnapshot {
  revision: number
}
export interface TransportEvent {
  at: string
  event: string
  durationMs?: number
  revision?: number
}
export interface SpikeSnapshot extends TransportSnapshot {
  topic: string
  role: 'seller' | 'buyer'
  status: 'idle' | 'pending' | 'accepted' | 'refused' | 'expired'
  requestId: string | null
  changedAt: string
  expiresAt: string | null
  sessionExpiresAt: string
  serverNow: string
}
