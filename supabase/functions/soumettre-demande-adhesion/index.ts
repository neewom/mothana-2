// Soumission du formulaire public d'adhésion (/adhesion/<slug>) — RETIRÉE le 2026-11-04 (carte
// Trello « Adhésion 2/3 : retirer le formulaire d'adhésion public ») : les nouvelles adhésions
// sont saisies dans l'espace bénévole ou par l'équipe. Toute soumission est refusée par un
// 410 Gone, sans lecture du corps ni écriture ; les demandes déjà en attente restent
// traitables dans « Demandes d'adhésion ».
//
// La fonction reste déployée pour répondre clairement à une ancienne page encore ouverte.
// Les modules voisins (validation.ts, notificationAdmins.ts, prevenirComptes.ts) sont
// toujours utilisés par soumettre-renouvellement-adhesion et lire-renouvellement-adhesion.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function reponseFormulaireRetire(req: Request): Response {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(
    JSON.stringify({
      error: 'FORMULAIRE_RETIRE',
      message: "Le formulaire d'adhésion en ligne n'est plus disponible : les adhésions se font directement auprès de l'association.",
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  )
}

if (import.meta.main) Deno.serve(reponseFormulaireRetire)
