import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { lotActif, messageErreurLot } from '../lib/recusLot'
import type { RecuLot, RecuLotEchec } from '../types/recusLot'

// Rafraîchissement de la progression pendant un lot en cours (page visible seulement).
const INTERVALLE_POLLING_MS = 5_000

interface UseRecusLot {
  /** Dernier lot de génération de l'organisation pour l'année (en cours ou terminé), null si aucun. */
  lot: RecuLot | null
  /** Lignes en échec du dernier lot terminé ou arrêté (bilan). */
  echecs: RecuLotEchec[]
  /** Erreur de lecture de la liste des échecs (bilan). */
  erreurEchecs: string | null
  loading: boolean
  error: string | null
  /** nbTotal : reçus retenus par le serveur pour le lot lancé (null si la relecture a échoué). */
  lancer: () => Promise<{ ok: true; nbTotal: number | null } | { ok: false; message: string }>
  arreter: () => Promise<{ ok: true } | { ok: false; message: string }>
  actionEnCours: boolean
  /** En cours, ou arrêté avec un reçu encore en génération (la progression est encore relue). */
  actif: boolean
  /** Heure de la dernière lecture (estimation du temps restant). */
  luLe: number
}

/**
 * Lot de génération de reçus (recus_lots, carte 1) : lecture du dernier lot de l'année, polling
 * léger tant qu'il est en cours (reprise de l'affichage à la réouverture de la page, arrêt quand
 * l'onglet est caché), lancement et arrêt par les RPC lancer_lot_recus / arreter_lot_recus.
 * `onLotFini` est appelé quand un lot observé en cours se termine ou est arrêté (rechargement de
 * la liste des reçus).
 */
export function useRecusLot(organisationId: string, annee: number, onLotFini: () => void): UseRecusLot {
  const [lot, setLot] = useState<RecuLot | null>(null)
  const [echecs, setEchecs] = useState<RecuLotEchec[]>([])
  const [erreurEchecs, setErreurEchecs] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionEnCours, setActionEnCours] = useState(false)
  const [luLe, setLuLe] = useState(0)
  const [actif, setActif] = useState(false)

  const onLotFiniRef = useRef(onLotFini)
  useEffect(() => { onLotFiniRef.current = onLotFini }, [onLotFini])
  // Lot à la lecture précédente : détecte le passage d'actif à terminé / arrêté.
  const statutPrecedentRef = useRef<{ id: string; actif: boolean } | null>(null)
  // Clé de la requête courante : une réponse arrivée après un changement d'année est ignorée.
  const cleRef = useRef('')

  // Renvoie le lot lu (null si aucun), undefined si la lecture a échoué ou est périmée.
  const charger = useCallback(async (): Promise<RecuLot | null | undefined> => {
    if (!organisationId) return undefined
    const cle = `${organisationId}|${annee}`
    cleRef.current = cle
    const { data, error: err } = await supabase
      .from('recus_lots')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('annee', annee)
      .eq('type', 'generation')
      .order('cree_le', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cleRef.current !== cle) return undefined
    if (err) {
      setError('Impossible de lire l’état du lot de reçus')
      setLoading(false)
      return undefined
    }
    const courant = (data as RecuLot | null) ?? null
    const maintenant = Date.now()
    const actifCourant = courant ? lotActif(courant, maintenant) : false
    setError(null)
    setLuLe(maintenant)
    setLot(courant)
    setActif(actifCourant)
    setLoading(false)

    const precedent = statutPrecedentRef.current
    statutPrecedentRef.current = courant ? { id: courant.id, actif: actifCourant } : null
    if (precedent && courant && precedent.id === courant.id && precedent.actif && !actifCourant) {
      onLotFiniRef.current()
    }

    if (courant && courant.statut !== 'en_cours' && courant.nb_echecs > 0) {
      const { data: lignes, error: errLignes } = await supabase
        .from('recus_lot_lignes')
        .select('id, profil_participant_id, rang, erreur, profils_participant(personnes(nom, prenom))')
        .eq('lot_id', courant.id)
        .eq('statut', 'echec')
        .order('rang', { ascending: true })
      if (cleRef.current !== cle) return undefined
      if (errLignes) {
        setErreurEchecs('Impossible de charger la liste des échecs')
      } else {
        setErreurEchecs(null)
        setEchecs((lignes ?? []) as unknown as RecuLotEchec[])
      }
    } else {
      setErreurEchecs(null)
      setEchecs([])
    }
    return courant
  }, [organisationId, annee])

  // Lecture initiale (et à chaque changement d'année) : reprend l'affichage d'un lot en cours.
  useEffect(() => {
    statutPrecedentRef.current = null
    setLot(null)
    setActif(false)
    setEchecs([])
    setErreurEchecs(null)
    setLoading(true)
    charger()
  }, [charger])

  // Polling tant que le lot est actif et que la page est visible ; relecture immédiate au retour.
  useEffect(() => {
    if (!actif) return
    const tick = () => { if (document.visibilityState === 'visible') charger() }
    const intervalle = window.setInterval(tick, INTERVALLE_POLLING_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(intervalle)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [actif, charger])

  const lancer = useCallback(async () => {
    setActionEnCours(true)
    const { data: lotId, error: err } = await supabase.rpc('lancer_lot_recus', { p_organisation_id: organisationId, p_annee: annee })
    // Succès comme refus (lot déjà en cours lancé ailleurs, plus rien à générer) : l'état affiché
    // est relu.
    const lu = await charger()
    setActionEnCours(false)
    if (err) return { ok: false as const, message: messageErreurLot(err.message) }
    // Nombre de reçus retenu par le serveur (peut différer de la liste affichée si elle est périmée).
    return { ok: true as const, nbTotal: lu && lu.id === lotId ? lu.nb_total : null }
  }, [organisationId, annee, charger])

  const arreter = useCallback(async () => {
    if (!lot) return { ok: false as const, message: 'Aucun lot en cours' }
    setActionEnCours(true)
    const { error: err } = await supabase.rpc('arreter_lot_recus', { p_lot_id: lot.id })
    await charger()
    setActionEnCours(false)
    return err ? { ok: false as const, message: messageErreurLot(err.message) } : { ok: true as const }
  }, [lot, charger])

  return { lot, echecs, erreurEchecs, loading, error, lancer, arreter, actionEnCours, actif, luLe }
}
