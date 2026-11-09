import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { fetchAllRows } from '../lib/fetchAllRows'
import { adherentsARenouveler, chargerDernieresAdhesions, type AdherentARenouveler } from '../lib/dernieresAdhesions'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { ActionsATraiter, type ActionATraiter } from '../components/ActionsATraiter'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { compterDonsReguliersAConfirmer } from '../lib/donsReguliers'
import { StatTiles } from '../components/ui/stat-tiles'
import { PageHeader } from '../components/ui/page-header'
import { cn } from '../lib/utils'
import type { Adherent } from '../types'
import AdherentModal from '../components/AdherentModal'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent } from '../components/ui/dialog'
import { libelleAValider } from '../lib/renouvellementsLibelles'

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

interface CandidatRenouvellement {
  adherent_id: string
  adherents: { id: string; nom: string; prenom: string | null }
}

// Bloc « Adhésions à renouveler » : 5 plus proches échéances au plus.
const A_RENOUVELER_AFFICHES = 5

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-paper-border bg-white">
      {/* gap + flex-wrap : titre et action ne se collent jamais ; l'action passe à la ligne si la
          colonne est trop étroite (grille à 3 colonnes vers 1 024–1 280 px). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-paper-border px-5 py-3">
        <h2 className="font-registre text-sm font-semibold text-ink">{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
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
  const [montantAnnee, setMontantAnnee] = useState(0)
  const [nombreDonsAnnee, setNombreDonsAnnee] = useState(0)
  const [nombreDonsMois, setNombreDonsMois] = useState(0)
  const [recentDons, setRecentDons] = useState<RecentDon[]>([])
  const [recentActivites, setRecentActivites] = useState<RecentActivite[]>([])
  const [aRenouveler, setARenouveler] = useState<AdherentARenouveler[]>([])
  const [nombreExpires, setNombreExpires] = useState(0)
  // Demandes en attente : renouvellements, et anciennes demandes d'adhésion (formulaire public retiré) comptées à part.
  const [demandesEnAttente, setDemandesEnAttente] = useState(0)
  const [anciennesAdhesionsEnAttente, setAnciennesAdhesionsEnAttente] = useState(0)
  const [donsReguliersAConfirmer, setDonsReguliersAConfirmer] = useState(0)
  const [adherentsEmailInvalideList, setAdherentsEmailInvalideList] = useState<Adherent[]>([])
  const [emailInvalideModalOpen, setEmailInvalideModalOpen] = useState(false)
  // undefined = pas encore chargé (évite un flash de la bannière avant la réponse)
  const [statutsUrl, setStatutsUrl] = useState<string | null | undefined>(undefined)
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
      // Année civile entière (dons datés plus tard dans l'année compris) : même périmètre que le
      // « Total <année> » de la page Statistiques, pour que les deux chiffres concordent.
      const annee = now.getFullYear()
      const dans30Jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [donsMoisRes, donsAnneeRes, recentDonsRes, recentActivitesRes, candidatsRenouvellementRes, expiresRes, demandesRes, engagementsRes, donsGeneresRes, organisationRes] = await Promise.all([
        supabase
          .from('dons')
          .select('montant')
          .eq('organisation_id', organisationId)
          .gte('date', debutMois)
          .lte('date', aujourdhui),
        // Paginé (plus de 1 000 dons possibles sur une année), comme le chargement de Statistiques.
        fetchAllRows<{ montant: number }>((from, to) =>
          supabase
            .from('dons')
            .select('montant')
            .eq('organisation_id', organisationId)
            .gte('date', `${annee}-01-01`)
            .lte('date', `${annee}-12-31`)
            .order('id')
            .range(from, to) as unknown as PromiseLike<{ data: { montant: number }[] | null; error: { message: string } | null }>,
        ),
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
          // En cours ou à venir, la plus proche d'abord (le bloc s'appelait « Activités
          // récentes » mais listait surtout des activités futures).
          .or(`date_debut.gte.${aujourdhui},date_fin.gte.${aujourdhui}`)
          .order('date_debut', { ascending: true })
          .limit(5),
        // Candidats : adhérents non archivés ayant une adhésion qui se termine dans les 30 jours ; on ne
        // garde ensuite que ceux dont c'est la **dernière** adhésion (pas encore renouvelés).
        fetchAllRows<CandidatRenouvellement>((from, to) =>
          supabase
            .from('adhesions')
            .select('adherent_id, adherents!inner(id, nom, prenom, organisation_id, statut)')
            .eq('adherents.organisation_id', organisationId)
            .eq('adherents.statut', 'actif')
            .gte('date_fin', aujourdhui)
            .lte('date_fin', dans30Jours)
            .order('id')
            .range(from, to) as unknown as PromiseLike<{ data: CandidatRenouvellement[] | null; error: { message: string } | null }>,
        ),
        // Expirés : même règle que l'état « Expirés » de la page Adhérents.
        supabase.rpc('search_adherents', { p_organisation_id: organisationId, p_statut: 'expire', p_limit: 1, p_offset: 0 }),
        supabase
          .from('demandes_adhesion')
          .select('type')
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
        supabase
          .from('organisations')
          .select('statuts_url')
          .eq('id', organisationId)
          .single(),
      ])

      const donsMois = (donsMoisRes.data ?? []) as { montant: number }[]
      setMontantMois(donsMois.reduce((sum, d) => sum + Number(d.montant), 0))
      setNombreDonsMois(donsMois.length)
      setMontantAnnee(donsAnneeRes.data.reduce((sum, d) => sum + Number(d.montant), 0))
      setNombreDonsAnnee(donsAnneeRes.data.length)
      setRecentDons((recentDonsRes.data ?? []) as unknown as RecentDon[])
      setRecentActivites((recentActivitesRes.data ?? []) as RecentActivite[])
      const candidats = new Map(candidatsRenouvellementRes.data.map((c) => [c.adherents.id, c.adherents]))
      const dernieres = await chargerDernieresAdhesions([...candidats.keys()])
      setARenouveler(adherentsARenouveler([...candidats.values()], dernieres, aujourdhui, dans30Jours))
      setNombreExpires(((expiresRes.data ?? []) as { total_count: number }[])[0]?.total_count ?? 0)
      const demandes = (demandesRes.data ?? []) as { type: 'adhesion' | 'renouvellement' }[]
      setDemandesEnAttente(demandes.length)
      setAnciennesAdhesionsEnAttente(demandes.filter((d) => d.type === 'adhesion').length)

      const engagements = (engagementsRes.data ?? []) as { id: string; jour_prelevement: number; date_debut: string; date_fin: string | null }[]
      const donsGeneres = (donsGeneresRes.data ?? []) as { don_regulier_id: string; date: string }[]
      const totalAConfirmer = compterDonsReguliersAConfirmer(engagements, donsGeneres)
      setDonsReguliersAConfirmer(totalAConfirmer)
      setStatutsUrl((organisationRes.data as { statuts_url: string | null } | null)?.statuts_url ?? null)

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

  const nbEmailsInvalides = adherentsEmailInvalideList.length
  const actionsATraiter: ActionATraiter[] = [
    ...(adherentsActifs && demandesEnAttente > 0 ? [{
      key: 'demandes',
      icone: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3h.008v.008h-.008V12.75z',
      titre: libelleAValider(demandesEnAttente - anciennesAdhesionsEnAttente, anciennesAdhesionsEnAttente),
      detail: anciennesAdhesionsEnAttente > 0
        ? "Envoyés par les adhérents depuis leur lien personnel, plus les anciennes demandes d'adhésion encore en attente."
        : 'Envoyés par les adhérents depuis leur lien personnel de renouvellement.',
      libelle: 'Valider',
      to: '/admin/adherents/renouvellements',
    }] : []),
    ...(donsActifs && donsReguliersAConfirmer > 0 ? [{
      key: 'dons-reguliers',
      icone: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z',
      titre: `${donsReguliersAConfirmer} don${donsReguliersAConfirmer > 1 ? 's' : ''} régulier${donsReguliersAConfirmer > 1 ? 's' : ''} en attente de confirmation`,
      detail: 'Prélèvements mensuels à valider avant enregistrement définitif.',
      libelle: 'Confirmer',
      to: '/admin/dons-reguliers',
    }] : []),
    ...(adherentsActifs && nbEmailsInvalides > 0 ? [{
      key: 'emails-invalides',
      icone: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
      titre: `${nbEmailsInvalides} adresse${nbEmailsInvalides > 1 ? 's' : ''} email d'adhérent${nbEmailsInvalides > 1 ? 's' : ''} invalide${nbEmailsInvalides > 1 ? 's' : ''}`,
      detail: "Un envoi précédent n'a pas pu être délivré — à corriger sur la fiche de l'adhérent.",
      libelle: 'Voir les adhérents',
      onClick: () => setEmailInvalideModalOpen(true),
    }] : []),
    ...(adherentsActifs && statutsUrl === null ? [{
      key: 'statuts',
      icone: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
      titre: "Statuts de l'association non configurés",
      detail: "La page de renouvellement et l'espace bénévole ne peuvent pas les proposer à la lecture.",
      libelle: 'Configurer',
      to: '/admin/parametres/adhesions',
    }] : []),
  ]

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre organisation."
        actions={(donsActifs || adherentsActifs) && (
          <>
            {/* Emailing : rattaché au module adhérents (comme le menu Communication). */}
            {adherentsActifs && (
              <Button asChild variant="secondary">
                <Link to="/admin/communication/emailing">Envoyer un email</Link>
              </Button>
            )}
            {adherentsActifs && (
              <Button asChild variant="secondary">
                <Link to="/admin/adherents?nouveau=1">Ajouter un adhérent</Link>
              </Button>
            )}
            {/* Action la plus fréquente : en dernier à partir de md (gabarit), en premier en mobile pour ne pas rester seule sur une 2ᵉ ligne. */}
            {donsActifs && (
              <Button asChild className="order-first md:order-none">
                <Link to="/admin/dons?nouveau=1">Saisir un don</Link>
              </Button>
            )}
          </>
        )}
      />

      <ActionsATraiter actions={actionsATraiter} />

      {/* Stats */}
      {(donsActifs || adherentsActifs) && (
        <StatTiles
          items={[
            ...(donsActifs
              ? [
                  { label: 'Dons ce mois-ci', value: formatEur(montantMois), hint: `${nombreDonsMois} don${nombreDonsMois > 1 ? 's' : ''}` },
                  { label: `Dons ${new Date().getFullYear()}`, value: formatEur(montantAnnee), hint: `${nombreDonsAnnee} don${nombreDonsAnnee > 1 ? 's' : ''}` },
                ]
              : []),
            ...(adherentsActifs
              ? [{
                  label: 'Adhésions à renouveler (30 j)',
                  value: String(aRenouveler.length),
                  hint: aRenouveler.length === 0 ? 'Aucune échéance dans les 30 jours' : 'Expirent dans les 30 jours',
                  href: '/admin/adherents?etat=a_renouveler',
                }, {
                  label: 'Adhésions expirées',
                  value: String(nombreExpires),
                  hint: nombreExpires === 0 ? 'Aucun adhérent expiré' : 'Adhésion échue, non renouvelée',
                  href: '/admin/adherents?etat=expire',
                }]
              : []),
          ]}
        />
      )}

      {/* 3 cartes : 2 colonnes à 1024 (sidebar comprise, trop serré à 3), 3 à partir de xl. */}
      {(donsActifs || adherentsActifs) && (
        <div className={cn('grid grid-cols-1 gap-4', donsActifs && adherentsActifs ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-2')}>
          {donsActifs && (
            <Card title="Dons récents" action={<Link to="/admin/dons" className="text-xs font-medium text-stamp hover:underline">Voir tout</Link>}>
              {recentDons.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucun don enregistré.</p>
              ) : (
                <ul className="space-y-3">
                  {recentDons.map((don) => (
                    <li key={don.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink-muted">
                        {don.profils_participant?.personnes.prenom} {don.profils_participant?.personnes.nom}
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-medium text-ink">{formatEur(don.montant)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {donsActifs && (
            <Card title="Activités en cours et à venir" action={<Link to="/admin/activites" className="text-xs font-medium text-stamp hover:underline">Voir tout</Link>}>
              {recentActivites.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucune activité en cours ou à venir.</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivites.map((activite) => (
                    <li key={activite.id} className="text-sm">
                      <p className="truncate text-ink-muted">{activite.nom}</p>
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
            <Card
              title="Adhésions à renouveler"
              // En-tête aligné sur les autres cartes (un seul lien à droite du titre) ; le lien vers
              // les expirés passe sous la liste, sinon les deux liens repoussent l'en-tête sous le titre.
              action={<Link to="/admin/adherents?etat=a_renouveler" className="text-xs font-medium text-stamp hover:underline">Voir tout ({aRenouveler.length})</Link>}
            >
              {aRenouveler.length === 0 ? (
                <p className="text-sm text-ink-faint">Aucune adhésion n'expire dans les 30 jours.</p>
              ) : (
                <ul className="space-y-3">
                  {aRenouveler.slice(0, A_RENOUVELER_AFFICHES).map((a) => (
                    <li key={a.adherentId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink-muted">
                        {a.prenom} {a.nom}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-ink-faint">{formatDate(a.dateFin)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {nombreExpires > 0 && (
                <p className="mt-4 border-t border-paper-border pt-3 text-xs">
                  <Link to="/admin/adherents?etat=expire" className="font-medium text-stamp hover:underline">Voir les expirés ({nombreExpires})</Link>
                </p>
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
