// Libellés de la page « Renouvellements » (ex-« Demandes d'adhésion ») : depuis le retrait du
// formulaire public (PR #327), elle reçoit les renouvellements envoyés par lien personnel. Les
// anciennes demandes d'adhésion encore en attente restent traitables jusqu'à épuisement : elles
// sont comptées à part. Le statut stocké reste « ratifiee » ; seul l'affichage dit « validée ».

function pluriel(n: number, singulier: string, plurielForme: string): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`
}

/** « 3 renouvellements à valider », « 1 renouvellement à valider · 4 anciennes demandes d'adhésion ». */
export function libelleAValider(renouvellements: number, anciennesAdhesions: number): string {
  const anciennes = pluriel(anciennesAdhesions, "ancienne demande d'adhésion", "anciennes demandes d'adhésion")
  if (renouvellements === 0 && anciennesAdhesions > 0) return `${anciennes} à valider`
  const principal = `${pluriel(renouvellements, 'renouvellement', 'renouvellements')} à valider`
  return anciennesAdhesions === 0 ? principal : `${principal} · ${anciennes}`
}

/** Sous-titre des onglets décidés : « 2 demandes validées », « 1 demande refusée ». */
export function libelleDecidees(n: number, statut: 'ratifiee' | 'refusee'): string {
  const s = n > 1 ? 's' : ''
  return `${n} demande${s} ${statut === 'ratifiee' ? 'validée' : 'refusée'}${s}`
}
