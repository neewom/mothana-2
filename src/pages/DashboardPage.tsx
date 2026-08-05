import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'

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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function DashboardPage() {
  const organisationId = useOrganisationId()

  const [loading, setLoading] = useState(true)
  const [montantMois, setMontantMois] = useState(0)
  const [nombreDonsMois, setNombreDonsMois] = useState(0)
  const [recentDons, setRecentDons] = useState<RecentDon[]>([])
  const [recentActivites, setRecentActivites] = useState<RecentActivite[]>([])
  const [adherentsExpiration, setAdherentsExpiration] = useState<AdherentProcheExpiration[]>([])
  const [demandesEnAttente, setDemandesEnAttente] = useState(0)

  useEffect(() => {
    if (!organisationId) return

    async function fetchDashboard() {
      setLoading(true)

      const now = new Date()
      const debutMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const aujourdhui = now.toISOString().split('T')[0]
      const dans30Jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [donsMoisRes, recentDonsRes, recentActivitesRes, adherentsExpirationRes, demandesRes] = await Promise.all([
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
      ])

      const donsMois = (donsMoisRes.data ?? []) as { montant: number }[]
      setMontantMois(donsMois.reduce((sum, d) => sum + Number(d.montant), 0))
      setNombreDonsMois(donsMois.length)
      setRecentDons((recentDonsRes.data ?? []) as unknown as RecentDon[])
      setRecentActivites((recentActivitesRes.data ?? []) as RecentActivite[])
      setAdherentsExpiration((adherentsExpirationRes.data ?? []) as unknown as AdherentProcheExpiration[])
      setDemandesEnAttente(demandesRes.count ?? 0)

      setLoading(false)
    }

    fetchDashboard()
  }, [organisationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-500">Vue d'ensemble de votre organisation.</p>
      </div>

      {demandesEnAttente > 0 && (
        <Link
          to="/admin/adherents/demandes"
          className="flex items-center gap-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-5 shadow-sm transition-colors hover:bg-amber-100"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3h.008v.008h-.008V12.75z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-amber-900">
              {demandesEnAttente} demande{demandesEnAttente > 1 ? 's' : ''} d'adhésion en attente de ratification
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Soumises via le formulaire public, à examiner par le conseil d'administration.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
            Examiner →
          </span>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Dons ce mois-ci</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatEur(montantMois)}</p>
          <p className="mt-1 text-xs text-slate-400">{nombreDonsMois} don{nombreDonsMois > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Adhérents proches d'expiration (30 jours)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{adherentsExpiration.length}</p>
          <p className="mt-1 text-xs text-slate-400">
            {adherentsExpiration.length === 0 ? 'Aucun renouvellement à prévoir' : 'À relancer pour renouvellement'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Dons récents" action={<Link to="/admin/dons" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Voir tout</Link>}>
          {recentDons.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun don enregistré.</p>
          ) : (
            <ul className="space-y-3">
              {recentDons.map((don) => (
                <li key={don.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {don.profils_participant?.personnes.prenom} {don.profils_participant?.personnes.nom}
                  </span>
                  <span className="font-medium text-slate-900">{formatEur(don.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activités récentes" action={<Link to="/admin/activites" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Voir tout</Link>}>
          {recentActivites.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune activité enregistrée.</p>
          ) : (
            <ul className="space-y-3">
              {recentActivites.map((activite) => (
                <li key={activite.id} className="text-sm">
                  <p className="text-slate-700">{activite.nom}</p>
                  {activite.date_debut && (
                    <p className="text-xs text-slate-400">{formatDate(activite.date_debut)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Adhérents proches d'expiration" action={<Link to="/admin/adherents" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Voir tout</Link>}>
          {adherentsExpiration.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun adhérent proche d'expiration.</p>
          ) : (
            <ul className="space-y-3">
              {adherentsExpiration.map((adhesion) => (
                <li key={adhesion.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {adhesion.adherents?.prenom} {adhesion.adherents?.nom}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(adhesion.date_fin)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
