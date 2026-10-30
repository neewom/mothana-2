import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { generatePortefeuilleQrPdf } from '../_shared/portefeuilleQrPdf.ts'
import { hashClientIp, hashValeur } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { traiterDemande } from './handler.ts'

// Logique et ordre des contrôles dans handler.ts (testé par handler.test.ts) ; ce fichier
// ne fait que brancher les vraies dépendances.
Deno.serve((req) => {
  let admin: SupabaseClient | null = null
  const client = () => admin ??= createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  return traiterDemande(req, {
    simulationActive: () => Deno.env.get('SIMULATION_PAIEMENT_ACTIVE') === 'true',
    hashIp: hashClientIp,
    hashEmail: (email) => hashValeur(`email:${email}`),
    rpc: async (fn, args) => await client().rpc(fn, args),
    genererPdf: generatePortefeuilleQrPdf,
    envoyerEmail: sendViaResend,
  })
})
