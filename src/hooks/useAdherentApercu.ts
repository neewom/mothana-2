import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { chargerDernieresAdhesions } from '../lib/dernieresAdhesions'
import type { Adherent, Adhesion } from '../types'

/** Fiche affichée dans l'aperçu : colonnes de search_adherents + motif du rejet d'email. */
export type AdherentFiche = Adherent & {
  email_invalide_evenement?: string | null
  email_invalide_raison?: string | null
}

/**
 * Fiche et dernière adhésion de l'adhérent ouvert, relues à l'ouverture et à chaque `refreshKey`
 * (enregistrement, renouvellement, archivage) : le panneau reste juste même pour une fiche hors de
 * la page affichée (lien ⌘K), et la lecture directe de la fiche apporte le motif du rejet d'email,
 * absent de search_adherents. En attendant, la ligne du tableau sert d'affichage provisoire.
 */
export function useAdherentApercu(initial: Adherent | null, refreshKey: number, organisationId: string) {
  const [fiche, setFiche] = useState<AdherentFiche | null>(initial)
  const [adhesion, setAdhesion] = useState<Adhesion | null | undefined>(undefined)
  const [introuvable, setIntrouvable] = useState(false)
  // Relecture en échec : le panneau le dit au lieu de rester sur « Chargement… ».
  const [erreur, setErreur] = useState(false)
  const id = initial?.id ?? null

  // Nouvelle fiche ouverte : affichage provisoire depuis la ligne, avant la relecture.
  const [idAffiche, setIdAffiche] = useState(id)
  if (idAffiche !== id) {
    setIdAffiche(id)
    setFiche(initial)
    setAdhesion(undefined)
    setIntrouvable(false)
    setErreur(false)
  }

  useEffect(() => {
    if (!id || !organisationId) return
    let cancelled = false
    void Promise.all([
      supabase.from('adherents').select('*').eq('id', id).eq('organisation_id', organisationId).maybeSingle(),
      chargerDernieresAdhesions([id]),
    ]).then(([{ data, error }, adhesions]) => {
      if (cancelled) return
      // Erreur de lecture : on garde l'affichage provisoire, signalé ; aucune ligne : fiche supprimée.
      if (error) {
        setErreur(true)
        return
      }
      if (!data) {
        setIntrouvable(true)
        return
      }
      setErreur(false)
      setFiche(data as AdherentFiche)
      setAdhesion(adhesions.get(id) ?? null)
    }, () => {
      if (!cancelled) setErreur(true)
    })
    return () => { cancelled = true }
  }, [id, refreshKey, organisationId])

  return { fiche, adhesion, introuvable, erreur }
}
