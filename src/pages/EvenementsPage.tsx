import { useCallback, useEffect, useState } from 'react'
import CreditManuelModal from '../components/CreditManuelModal'
import EvenementAfficheModal from '../components/EvenementAfficheModal'
import EvenementModal from '../components/EvenementModal'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabaseClient'
import type { Evenement, EvenementStatut } from '../types/evenement'

const STATUS_LABELS: Record<EvenementStatut, string> = {
  brouillon: 'Brouillon',
  ouvert: 'Ouvert',
  clos: 'Clos',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v13.5H3.75V6a1.5 1.5 0 011.5-1.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h3v3h-3z" />
    </svg>
  )
}

export default function EvenementsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [organisationSlug, setOrganisationSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Evenement | null>(null)
  const [afficheEvent, setAfficheEvent] = useState<Evenement | null>(null)
  const [creditEvent, setCreditEvent] = useState<Evenement | null>(null)

  const fetchData = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    const [eventsResult, organisationResult] = await Promise.all([
      supabase
        .from('evenements')
        .select('id, organisation_id, slug, nom, date_evenement, statut, montants_credit_centimes, created_at, updated_at')
        .eq('organisation_id', organisationId)
        .order('date_evenement', { ascending: false }),
      supabase.from('organisations').select('slug').eq('id', organisationId).single(),
    ])

    if (eventsResult.error || organisationResult.error) {
      setError(eventsResult.error?.message ?? organisationResult.error?.message ?? 'Erreur de chargement')
      setLoading(false)
      return
    }

    setEvenements((eventsResult.data ?? []) as Evenement[])
    setOrganisationSlug((organisationResult.data as { slug: string }).slug)
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(evenement: Evenement) {
    setEditing(evenement)
    setFormOpen(true)
  }

  async function handleSaved(message: string) {
    showToast(message)
    await fetchData()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Événements</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Préparez les événements du porte-monnaie, leurs montants de crédit et les ventes enregistrées au guichet.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="self-start">Nouvel événement</Button>
      </header>

      {error && (
        <div role="alert" className="rounded-sm border border-stamp/25 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
          <p>Les événements n’ont pas pu être chargés.</p>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void fetchData()}>
            Réessayer
          </Button>
        </div>
      )}

      <section className="overflow-hidden rounded-sm border border-paper-border bg-white">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-ink-faint">Chargement des événements…</div>
        ) : evenements.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="text-ink-faint"><CalendarIcon /></div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Aucun événement pour le moment</h2>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Créez votre premier événement pour configurer les montants proposés et préparer son affiche QR.
            </p>
            <Button type="button" className="mt-5" onClick={openCreate}>Créer un événement</Button>
          </div>
        ) : (
          <ScrollShadowX>
            <Table className="min-w-[820px] border-l border-stamp">
              <TableHeader>
                <TableRow>
                  <TableHead>Événement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montants</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evenements.map((evenement) => (
                  <TableRow key={evenement.id} className="hover:bg-paper/70">
                    <TableCell>
                      <p className="font-medium text-ink">{evenement.nom}</p>
                      <p className="mt-0.5 font-registre-mono text-[11px] text-ink-faint">/{evenement.slug}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-muted">
                      {formatDate(evenement.date_evenement)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={evenement.statut === 'ouvert' ? 'success' : 'neutral'}>
                        {STATUS_LABELS[evenement.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-muted">
                      {evenement.montants_credit_centimes.length} montant{evenement.montants_credit_centimes.length > 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {evenement.statut === 'ouvert' && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => setCreditEvent(evenement)}>
                            Créditer
                          </Button>
                        )}
                        <Button type="button" variant="secondary" size="sm" onClick={() => setAfficheEvent(evenement)}>
                          Affiche
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(evenement)}>
                          Modifier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollShadowX>
        )}
      </section>

      <EvenementModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        organisationId={organisationId}
        evenement={editing}
        onSaved={(message) => void handleSaved(message)}
      />
      <EvenementAfficheModal
        open={afficheEvent !== null}
        onClose={() => setAfficheEvent(null)}
        evenement={afficheEvent}
        organisationSlug={organisationSlug}
      />
      <CreditManuelModal
        open={creditEvent !== null}
        onClose={() => setCreditEvent(null)}
        evenement={creditEvent}
        onCredited={showToast}
      />

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
