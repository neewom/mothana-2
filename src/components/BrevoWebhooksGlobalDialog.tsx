import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  interpreterResultatsWebhooks,
  type LigneResultatWebhook,
  type ResultatWebhookOrganisation,
  type StatutWebhook,
} from '../lib/brevoWebhooksGlobal'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

// Super-admin : réenregistre le webhook de rebonds Brevo de toutes les organisations ayant une
// clé (register-brevo-webhook, { toutes_organisations: true }), avec le résultat par organisation.

const VARIANTE_BADGE: Record<StatutWebhook, 'success' | 'neutral' | 'warning'> = {
  cree: 'success',
  mis_a_jour: 'success',
  ignore: 'neutral',
  erreur: 'warning',
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function BrevoWebhooksGlobalDialog({ open, onClose }: Props) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [lignes, setLignes] = useState<LigneResultatWebhook[] | null>(null)

  function fermer() {
    if (enCours) return
    setErreur(null)
    setLignes(null)
    onClose()
  }

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setErreur('Session expirée : reconnectez-vous.')
      setEnCours(false)
      return
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/register-brevo-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ toutes_organisations: true }),
      })
      const json = (await res.json().catch(() => ({}))) as { resultats?: ResultatWebhookOrganisation[]; error?: string }
      if (!res.ok || !Array.isArray(json.resultats)) {
        setErreur(json.error ?? `Erreur ${res.status}`)
      } else {
        setLignes(interpreterResultatsWebhooks(json.resultats))
      }
    } catch {
      setErreur('Impossible de joindre le serveur.')
    }
    setEnCours(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) fermer() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="pr-8">Réenregistrer les webhooks Brevo</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {lignes === null ? (
            <p className="text-sm text-ink-muted">
              Le webhook de rebonds de chaque organisation ayant une clé API Brevo sera créé ou mis à jour sur son compte
              Brevo (URL avec secret, événements suivis). Sans effet sur les envois ni sur les clés.
            </p>
          ) : lignes.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune organisation n'a de clé API Brevo configurée.</p>
          ) : (
            <ul className="divide-y divide-paper-border rounded-sm border border-paper-border bg-white">
              {lignes.map((ligne) => (
                <li key={ligne.organisationId} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium text-ink">{ligne.nom}</div>
                    {ligne.detail && <div className="mt-0.5 break-words text-xs text-ink-muted">{ligne.detail}</div>}
                  </div>
                  <Badge variant={VARIANTE_BADGE[ligne.statut]}>{ligne.libelle}</Badge>
                </li>
              ))}
            </ul>
          )}
          {erreur && (
            <div role="alert" className="mt-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{erreur}</div>
          )}
          <div className="mt-5 flex justify-end gap-3">
            {lignes === null ? (
              <>
                <Button type="button" variant="secondary" onClick={fermer} disabled={enCours}>
                  Annuler
                </Button>
                <Button type="button" onClick={lancer} disabled={enCours}>
                  {enCours ? 'Réenregistrement…' : 'Réenregistrer'}
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={fermer}>
                Fermer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
