import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EvenementModal from '../components/EvenementModal'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/page-header'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabaseClient'
import type { Activite } from '../types'
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

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} → ${formatDate(end)}`
}

function postmarkParts(value: string): { day: string; month: string } {
  const date = new Date(`${value}T12:00:00`)
  return {
    day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }),
  }
}

function EventPostmark({ evenement }: { evenement: Evenement }) {
  if (evenement.statut === 'brouillon') {
    return (
      <div
        className="h-[52px] w-[52px] shrink-0 rounded-full border-[1.5px] border-dashed border-paper-border"
        aria-hidden
      />
    )
  }

  const isOpen = evenement.statut === 'ouvert'
  const { day, month } = postmarkParts(isOpen ? evenement.date_evenement : evenement.date_fin)

  return (
    <div
      className={cn(
        'flex shrink-0 -rotate-3 flex-col items-center justify-center rounded-full border-stamp font-registre-mono text-stamp',
        isOpen
          ? 'h-[52px] w-[52px] border-[2.5px] shadow-[0_0_0_3px_rgba(168,40,31,0.06)]'
          : 'h-10 w-10 border-[1.5px] opacity-50'
      )}
      aria-hidden
    >
      <span className={cn('font-bold leading-none', isOpen ? 'text-[13px]' : 'text-[11px]')}>{day}</span>
      <span className="text-[8px] uppercase leading-tight tracking-wide">{month}</span>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v13.5H3.75V6a1.5 1.5 0 011.5-1.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h3v3h-3z" />
    </svg>
  )
}

function EvenementRow({ evenement }: { evenement: Evenement }) {
  const isClosed = evenement.statut === 'clos'
  const amountsLabel = `${evenement.montants_credit_centimes.length} montant${evenement.montants_credit_centimes.length > 1 ? 's' : ''} proposé${evenement.montants_credit_centimes.length > 1 ? 's' : ''}`

  // Carte entière cliquable (vrai lien, focus visible) : les actions vivent sur la page détail.
  return (
    <li className="border-t border-paper-border-muted first:border-t-0">
      <Link
        to={`/admin/activites/porte-monnaie/${evenement.id}`}
        className={cn(
          'flex items-center gap-3 px-4 py-4 transition-colors hover:bg-paper-border/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stamp/70 md:px-6',
          isClosed && 'py-3'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <EventPostmark evenement={evenement} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn(
                'font-registre font-semibold',
                isClosed ? 'text-sm text-ink-muted' : 'text-base text-ink md:text-lg'
              )}>
                {evenement.nom}
              </p>
              <Badge variant={evenement.statut === 'ouvert' ? 'success' : 'neutral'}>
                {STATUS_LABELS[evenement.statut]}
              </Badge>
            </div>
            <p className="mt-0.5 font-registre text-sm text-ink-muted">
              {formatDateRange(evenement.date_evenement, evenement.date_fin)}
            </p>
            <p className={cn(
              'mt-1 font-registre-mono text-xs',
              evenement.statut === 'ouvert' ? 'font-medium text-stamp' : 'text-ink-faint'
            )}>
              {amountsLabel}
            </p>
            <p className="mt-0.5 font-registre-mono text-[11px] text-ink-faint">/{evenement.slug}</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  )
}

export default function EvenementsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    const [eventsResult, activitesResult] = await Promise.all([
      supabase
        .from('evenements')
        .select('id, organisation_id, activite_id, slug, nom, date_evenement, date_fin, statut, montants_credit_centimes, created_at, updated_at')
        .eq('organisation_id', organisationId)
        .order('date_evenement', { ascending: false }),
      supabase.from('activites').select('id, nom, organisation_id, date_debut, date_fin').eq('organisation_id', organisationId),
    ])

    if (eventsResult.error || activitesResult.error) {
      setError(eventsResult.error?.message ?? activitesResult.error?.message ?? 'Erreur de chargement')
      setLoading(false)
      return
    }

    setEvenements((eventsResult.data ?? []) as Evenement[])
    setActivites((activitesResult.data as unknown as Activite[]) ?? [])
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  function openCreate() {
    setFormOpen(true)
  }

  async function handleSaved(message: string) {
    showToast(message)
    await fetchData()
  }

  const activeEvents = evenements.filter((evenement) => evenement.statut !== 'clos')
  const closedEvents = evenements.filter((evenement) => evenement.statut === 'clos')

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <PageHeader
        title="Porte-monnaie"
        subtitle={
          loading
            ? 'Chargement…'
            : `${evenements.length} événement${evenements.length !== 1 ? 's' : ''} · ${evenements.filter((e) => e.statut === 'ouvert').length} ouvert${evenements.filter((e) => e.statut === 'ouvert').length > 1 ? 's' : ''}`
        }
        actions={
          <Button type="button" onClick={openCreate}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvel événement
          </Button>
        }
      />

      {error && (
        <div role="alert" className="rounded-sm border border-stamp/25 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
          <p>Les événements n’ont pas pu être chargés.</p>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void fetchData()}>
            Réessayer
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-sm border border-paper-border bg-white py-16 text-sm text-ink-faint">
          Chargement…
        </div>
      ) : evenements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-paper-border bg-white py-16 text-center">
          <div className="mb-3 text-paper-border"><CalendarIcon /></div>
          <p className="text-sm font-medium text-ink-muted">Aucun événement</p>
          <p className="mt-1 text-xs text-ink-faint">Créez votre premier événement pour commencer.</p>
        </div>
      ) : (
        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="mb-6 min-w-0 lg:mb-0 lg:flex-1">
            {activeEvents.length > 0 ? (
              <ul className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
                {activeEvents.map((evenement) => (
                  <EvenementRow
                    key={evenement.id}
                    evenement={evenement}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-sm border border-paper-border bg-white px-6 py-8 text-center text-sm text-ink-faint">
                Aucun événement en préparation ou ouvert.
              </p>
            )}
          </div>

          {closedEvents.length > 0 && (
            <div className="min-w-0 lg:flex-1">
              <p className="mb-2 px-1 font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">
                Clos
              </p>
              <ul className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
                {closedEvents.map((evenement) => (
                  <EvenementRow
                    key={evenement.id}
                    evenement={evenement}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <EvenementModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        organisationId={organisationId}
        activites={activites}
        evenement={null}
        onSaved={(message) => void handleSaved(message)}
      />

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
