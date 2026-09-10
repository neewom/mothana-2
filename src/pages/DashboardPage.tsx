import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { moisManquants, anneeMoisDeDate } from '../lib/donsReguliers'
import { cn } from '../lib/utils'
import type { Adherent } from '../types'
import AdherentModal from '../components/AdherentModal'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent } from '../components/ui/dialog'

interface RecentDon {
  id: string
  montant: number
  date: string
  profils_participant: { personnes: { nom: string; prenom: string | null } } | null
}

interface RecentActivite {
  id: string
  nom: string
  date_debut: string | null
  date_fin: string | null
}

interface AdherentProcheExpiration {
  id: string
  date_fin: string
  adherents: { nom: string; prenom: string | null } | null
}

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-paper-border bg-white">
      <div className="flex items-center justify-between border-b border-paper-border px-5 py-3">
        <h2 className="font-registre text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function DashboardPage() {
  const organisationId = useOrganisationId()
  const { fonctionnalitesActivees } = useAdminOutletContext()
  const donsActifs = fonctionnalitesActivees?.dons ?? true
  const adherentsActifs = fonctionnalitesActivees?.adherents ?? true

  const [loading, setLoading] = useState(true)
  const [montantMois, setMontantMois] = useState(0)
  const [nombreDonsMois, setNombreDonsMois] = useState(0)
  const [recentDons, setRecentDons] = useState<RecentDon[]>([])
  const [recentActivites, setRecentActivites] = useState<RecentActivite[]>([])
  const [adherentsExpiration, setAdherentsExpiration] = useState<AdherentProcheExpiration[]>([])
  const [demandesEnAttente, setDemandesEnAttente] = useState(0)
  const [donsReguliersAConfirmer, setDonsReguliersAConfirmer] = useState(0)
  const [adherentsEmailInvalideList, setAdherentsEmailInvalideList] = useState<Adherent[]>([])
  const [emailInvalideModalOpen, setEmailInvalideModalOpen] = useState(false)
  const [editingAdherent, setEditingAdherent] = useState<Adherent | undefined>(undefined)
  const [adherentModalOpen, setAdherentModalOpen] = useState(false)

  const fetchAdherentsEmailInvalide = useCallback(async () => {
    if (!organisationId) return
    const { data } = await supabase
      .from('adherents')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('statut', 'actif')
      .not('email_invalide_at', 'is', null)
      .order('nom')
    setAdherentsEmailInvalideList((data ?? []) as Adherent[])
  }, [organisationId])

  useEffect(() => {
    fetchAdherentsEmailInvalide()
  }, [fetchAdherentsEmailInvalide])

  useEffect(() => {
    if (!organisationId) return

    async function fetchDashboard() {
      setLoading(true)

      const now = new Date()
      const debutMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const aujourdhui = now.toISOString().split('T')[0]
      const dans30Jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [donsMoisRes, recentDonsRes, recentActivitesRes, adherentsExpirationRes, demandesRes, engagementsRes, donsGeneresRes] = await Promise.all([
        supabase
          .from('dons')
          .select('montant')
          .eq('organisation_id', organisationId)
          .gte('date', debutMois)
          .lte('date', aujourdhui),
        supabase
          .from('dons')
          .select('id, montant, date, profils_participant(personnes(nom, prenom))')
          .eq('organisation_id', organisationId)
          .order('date', { ascending: false })
          .limit(5),
        supabase
          .from('activites')
          .select('id, nom, date_debut, date_fin')
          .eq('organisation_id', organisationId)
          .order('date_debut', { ascending: false })
          .limit(5),
        supabase
          .from('adhesions')
          .select('id, date_fin, adherents!inner(nom, prenom, organisation_id)')
          .eq('adherents.organisation_id', organisationId)
          .gte('date_fin', aujourdhui)
          .lte('date_fin', dans30Jours)
          .order('date_fin', { ascending: true })
          .limit(5),
        supabase
          .from('demandes_adhesion')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisationId)
          .eq('statut', 'en_attente'),
        supabase
          .from('dons_reguliers')
          .select('id, jour_prelevement, date_debut, date_fin')
          .eq('organisation_id', organisationId)
          .eq('statut', 'actif'),
        supabase
          .from('dons')
          .select('don_regulier_id, date')
          .eq('organisation_id', organisationId)
          .not('don_regulier_id', 'is', null),
      ])

      const donsMois = (donsMoisRes.data ?? []) as { montant: number }[]
      setMontantMois(donsMois.reduce((sum, d) => sum + Number(d.montant), 0))
      setNombreDonsMois(donsMois.length)
      setRecentDons((recentDonsRes.data ?? []) as unknown as RecentDon[])
      setRecentActivites((recentActivitesRes.data ?? []) as RecentActivite[])
      setAdherentsExpiration((adherentsExpirationRes.data ?? []) as unknown as AdherentProcheExpiration[])
      setDemandesEnAttente(demandesRes.count ?? 0)

      const engagements = (engagementsRes.data ?? []) as { id: string; jour_prelevement: number; date_debut: string; date_fin: string | null }[]
      const donsGeneres = (donsGeneresRes.data ?? []) as { don_regulier_id: string; date: string }[]
      const moisDejaGeneresParEngagement = new Map<string, Set<string>>()
      for (const d of donsGeneres) {
        if (!d.don_regulier_id) continue
        if (!moisDejaGeneresParEngagement.has(d.don_regulier_id)) moisDejaGeneresParEngagement.set(d.don_regulier_id, new Set())
        moisDejaGeneresParEngagement.get(d.don_regulier_id)!.add(anneeMoisDeDate(d.date))
      }
      const totalAConfirmer = engagements.reduce(
        (sum, e) => sum + moisManquants(e, moisDejaGeneresParEngagement.get(e.id) ?? new Set()).length,
        0
      )
      setDonsReguliersAConfirmer(totalAConfirmer)

      setLoading(false)
    }

    fetchDashboard()
  }, [organisationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 font-registre text-sm text-ink-faint">
        Chargement…
      </div>
    )
  }

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-muted">Vue d'ensemble de votre organisation.</p>
      </div>

      {adherentsActifs && demandesEnAttente > 0 && (
        <Link
          to="/admin/adherents/demandes"
          className="flex flex-col gap-4 rounded-sm border-2 border-warning-border bg-warning-tint px-6 py-5 transition-colors hover:bg-warning-tint/70 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3h.008v.008h-.008V12.75z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-warning">
                {demandesEnAttente} demande{demandesEnAttente > 1 ? 's' : ''} d'adhésion en attente de ratification
              </p>
              <p className="mt-0.5 text-sm text-warning">
                Soumises via le formulaire public, à examiner par le conseil d'administration.
              </p>
            </div>
          </div>
          <span className="w-full shrink-0 rounded-sm bg-warning px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">
            Examiner →
          </span>
        </Link>
      )}

      {donsActifs && donsReguliersAConfirmer > 0 && (
        <Link
          to="/admin/dons-reguliers"
          className="flex flex-col gap-4 rounded-sm border-2 border-warning-border bg-warning-tint px-6 py-5 transition-colors hover:bg-warning-tint/70 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-warning">
                {donsReguliersAConfirmer} don{donsReguliersAConfirmer > 1 ? 's' : ''} régulier{donsReguliersAConfirmer > 1 ? 's' : ''} en attente de confirmation
              </p>
              <p className="mt-0.5 text-sm text-warning">
                Prélèvements mensuels à valider avant enregistrement définitif.
              </p>
            </div>
          </div>
          <span className="w-full shrink-0 rounded-sm bg-warning px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">
            Confirmer →
          </span>
        </Link>
      )}

      {adherentsActifs && adherentsEmailInvalideList.length > 0 && (
        <button
          type="button"
          onClick={() => setEmailInvalideModalOpen(true)}
          className="flex w-full flex-col gap-4 rounded-sm border-2 border-warning-border bg-warning-tint px-6 py-5 text-left transition-colors hover:bg-warning-tint/70 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-warning">
                {adherentsEmailInvalideList.length} adresse{adherentsEmailInvalideList.length > 1 ? 's' : ''} email d'adhérent{adherentsEmailInvalideList.length > 1 ? 's' : ''} invalide{adherentsEmailInvalideList.length > 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-sm text-warning">
                Un envoi précédent n'a pas pu être délivré — à corriger sur la fiche de l'adhérent.
              </p>
            </div>
          </div>
          <span className="w-full shrink-0 rounded-sm bg-warning px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">
            Voir les adhérents →
          </span>
        </button>
      )}

      {/* Stats */}
      {(donsActifs || adherentsActifs) && (
        <div className={cn('grid grid-cols-1 gap-4', donsActifs && adherentsActifs && 'sm:grid-cols-2')}>
          {donsActifs && (
            <div className="rounded-sm border border-paper-border bg-white p-5">
              <p className="text-sm text-ink-faint">Dons ce mois-ci</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatEur(montantMois)}</p>
              <p className="mt-1 text-xs text-ink-faint">{nombreDonsMois} don{nombreDonsMois > 1 ? 's' : ''}</p>
            </div>
          )}
          {adherentsActifs && (
            <div className="rounded-sm border border-paper-border bg-white p-5">
              <p className="text-sm text-ink-faint">Adhérents proches d'expiration (30 jours)</p>
              <p className="mt-1 text-2xl font-bold text-ink">{adherentsExpiration.length}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {adherentsExpiration.length === 0 ? 'Aucun renouvellement à prévoir' : 'À relancer pour renouvellement'}
              </p>
            </div>
          )}
        </div>
      )}

      {(donsActifs || adherentsActifs) && (
        <div className={cn('grid grid-cols-1 gap-4', donsActifs && adherentsActifs ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
          {donsActifs && (
            <Card title="Dons récents" action={<Link to="/admin/dons" className="text-xs font-medium text-stamp hover:underline">Voir tout</Link>}>
              {recentDons.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucun don enregistré.</p>
              ) : (
                <ul className="space-y-3">
                  {recentDons.map((don) => (
                    <li key={don.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">
                        {don.profils_participant?.personnes.prenom} {don.profils_participant?.personnes.nom}
                      </span>
                      <span className="font-medium text-ink">{formatEur(don.montant)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {donsActifs && (
            <Card title="Activités récentes" action={<Link to="/admin/activites" className="text-xs font-medium text-stamp hover:underline">Voir tout</Link>}>
              {recentActivites.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucune activité enregistrée.</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivites.map((activite) => (
                    <li key={activite.id} className="text-sm">
                      <p className="text-ink-muted">{activite.nom}</p>
                      {activite.date_debut && (
                        <p className="text-xs text-ink-faint">{formatDate(activite.date_debut)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {adherentsActifs && (
            <Card title="Adhérents proches d'expiration" action={<Link to="/admin/adherents" className="text-xs font-medium text-stamp hover:underline">Voir tout</Link>}>
              {adherentsExpiration.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucun adhérent proche d'expiration.</p>
              ) : (
                <ul className="space-y-3">
                  {adherentsExpiration.map((adhesion) => (
                    <li key={adhesion.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">
                        {adhesion.adherents?.prenom} {adhesion.adherents?.nom}
                      </span>
                      <span className="text-xs text-ink-faint">{formatDate(adhesion.date_fin)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      <Dialog open={emailInvalideModalOpen} onOpenChange={(next) => { if (!next) setEmailInvalideModalOpen(false) }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <div className="p-6">
            <h2 className="font-registre text-lg font-semibold text-ink">Adresses email invalides</h2>
            <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {adherentsEmailInvalideList.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAdherent(a)
                      setEmailInvalideModalOpen(false)
                      setAdherentModalOpen(true)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-sm border border-paper-border px-3 py-2 text-left font-registre hover:bg-paper"
                  >
                    <span className="truncate text-sm font-medium text-ink">{[a.prenom, a.nom].filter(Boolean).join(' ')}</span>
                    <span className="shrink-0 truncate text-xs text-ink-faint">{a.courriel}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setEmailInvalideModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {organisationId && (
        <AdherentModal
          open={adherentModalOpen}
          onClose={() => setAdherentModalOpen(false)}
          onSaved={() => {
            setAdherentModalOpen(false)
            fetchAdherentsEmailInvalide()
          }}
          adherent={editingAdherent}
          organisationId={organisationId}
        />
      )}
    </div>
  )
}
