import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { preparerParticipantDepuisAdherent, type ParticipantEnAttente } from '../lib/adherentTranspose'
import type { ProfilParticipant } from '../types'
import { Button } from './ui/button'

// Deux formes de résultat selon le rôle : search_adherents (admin, fiche
// complète) vs search_adherents_verification (bénévole, champs restreints
// nom/prénom/statut/date_fin — même limite de confidentialité que la
// vérification carte adhérent existante, pas d'élargissement pour ce besoin).
interface AdherentMatchAdmin {
  nom: string
  prenom: string | null
  civilite: number | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  telephone: string | null
  courriel: string | null
}

interface AdherentMatchBenevole {
  nom: string
  prenom: string | null
  statut: string
  date_fin: string | null
}

type AdherentMatch = AdherentMatchAdmin | AdherentMatchBenevole

function isAdminMatch(m: AdherentMatch): m is AdherentMatchAdmin {
  return 'adresse' in m
}

function nomComplet(m: AdherentMatch): string {
  return m.prenom ? `${m.prenom} ${m.nom}` : m.nom
}

interface AdherentFallbackSuggestionsProps {
  organisationId: string
  search: string
  role: 'admin' | 'benevole'
  // Le composant se démonte dès qu'un participant est sélectionné (cf.
  // showAdherentFallback dans DonModal/BenevolePage) — l'état "en attente"
  // ne peut donc pas vivre ici, il doit remonter au parent, qui seul
  // survit jusqu'à la validation du don. onCreated fournit l'objet
  // ProfilParticipant virtuel pour l'UI (autocomplete) ET la fonction qui
  // écrira réellement personnes/profils_participant en base, à appeler par
  // le parent à la validation du don, jamais avant.
  onCreated: (participant: ProfilParticipant, persist: ParticipantEnAttente['persist']) => void
}

export default function AdherentFallbackSuggestions({
  organisationId,
  search,
  role,
  onCreated,
}: AdherentFallbackSuggestionsProps) {
  const [matches, setMatches] = useState<AdherentMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState<AdherentMatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setVerifying(null)
    setError(null)

    const trimmed = search.trim()
    if (trimmed.length < 2) {
      setMatches([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timeout = setTimeout(async () => {
      const { data, error: rpcErr } = role === 'admin'
        ? await supabase.rpc('search_adherents', {
            p_organisation_id: organisationId,
            p_search: trimmed,
            p_statut: 'actif',
            p_limit: 5,
          })
        : await supabase.rpc('search_adherents_verification', {
            p_organisation_id: organisationId,
            p_search: trimmed,
            p_limit: 5,
          })

      if (!rpcErr) setMatches((data ?? []) as AdherentMatch[])
      setLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, organisationId, role])

  function handleConfirm(m: AdherentMatch) {
    setError(null)

    // Rien n'est écrit en base ici — seulement préparé (ids réservés,
    // objet prêt pour l'UI). L'écriture réelle attend la validation de la
    // saisie du don (persist, appelé par le parent), pour qu'un don annulé
    // ne laisse jamais de donateur fantôme en base.
    const prepared = preparerParticipantDepuisAdherent(
      isAdminMatch(m)
        ? {
            nom: m.nom,
            prenom: m.prenom,
            civilite: m.civilite,
            adresse: m.adresse,
            code_postal: m.code_postal,
            ville: m.ville,
            telephone: m.telephone,
            courriel: m.courriel,
          }
        : { nom: m.nom, prenom: m.prenom },
      organisationId
    )

    onCreated(prepared.participant, prepared.persist)
    setVerifying(null)
    setMatches([])
  }

  if (loading && matches.length === 0) {
    return <p className="mt-2 font-registre-mono text-[11px] text-ink-faint">Recherche parmi les adhérents…</p>
  }

  if (matches.length === 0) return null

  return (
    <div className="mt-2 space-y-2 rounded-sm border border-paper-border bg-paper p-3">
      <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Trouvé{matches.length > 1 ? 's' : ''} parmi les adhérents
      </p>

      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 text-xs text-stamp">
          {error}
        </div>
      )}

      {verifying ? (
        <div className="space-y-2 rounded-sm border border-paper-border bg-white p-3">
          <p className="font-semibold text-ink">{nomComplet(verifying)}</p>
          {isAdminMatch(verifying) ? (
            <div className="space-y-0.5 text-xs text-ink-muted">
              {verifying.adresse && <p>{verifying.adresse}{verifying.code_postal ? `, ${verifying.code_postal}` : ''} {verifying.ville ?? ''}</p>}
              {verifying.telephone && <p>{verifying.telephone}</p>}
              {verifying.courriel && <p>{verifying.courriel}</p>}
            </div>
          ) : (
            <div className="space-y-0.5 text-xs text-ink-muted">
              <p>Statut : {verifying.statut === 'actif' ? 'Actif' : verifying.statut}</p>
              {verifying.date_fin && <p>Fin d'adhésion : {verifying.date_fin}</p>}
            </div>
          )}
          <p className="font-registre-mono text-[11px] text-ink-faint">
            Vérifiez qu'il s'agit bien de la personne qui fait ce don avant de confirmer. Le donateur ne sera
            réellement créé qu'à l'enregistrement du don.
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => handleConfirm(verifying)}>
              Confirmer et créer le donateur
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setVerifying(null)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {matches.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setVerifying(m)}
              className="flex w-full items-center justify-between rounded-sm border border-paper-border bg-white px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <span className="font-medium text-ink">{nomComplet(m)}</span>
              <span className="font-registre-mono text-[10px] uppercase tracking-wide text-ink-faint">Adhérent</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
