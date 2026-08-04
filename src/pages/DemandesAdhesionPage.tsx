import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Adherent, DemandeAdhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from '../lib/civiliteAdherent'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import AdherentModal from '../components/AdherentModal'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function demandeFullName(d: DemandeAdhesion): string {
  return [d.prenom, d.nom].filter(Boolean).join(' ')
}

type Tab = 'en_attente' | 'ratifiee' | 'refusee'

const TABS: { value: Tab; label: string }[] = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'ratifiee', label: 'Ratifiées' },
  { value: 'refusee', label: 'Refusées' },
]

export default function DemandesAdhesionPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()

  const [tab, setTab] = useState<Tab>('en_attente')
  const [demandes, setDemandes] = useState<DemandeAdhesion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ratifyingDemande, setRatifyingDemande] = useState<DemandeAdhesion | undefined>(undefined)
  const [refusingDemande, setRefusingDemande] = useState<DemandeAdhesion | null>(null)
  const [refusing, setRefusing] = useState(false)
  const [detailDemande, setDetailDemande] = useState<DemandeAdhesion | null>(null)

  const fetchDemandes = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('demandes_adhesion')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('statut', tab)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setDemandes((data ?? []) as DemandeAdhesion[])
    setLoading(false)
  }, [organisationId, tab])

  useEffect(() => {
    fetchDemandes()
  }, [fetchDemandes])

  async function handleRatified(adherent: Adherent) {
    if (!ratifyingDemande) return

    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('demandes_adhesion')
      .update({
        statut: 'ratifiee',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        adherent_id: adherent.id,
      })
      .eq('id', ratifyingDemande.id)

    if (err) {
      setError(err.message)
      return
    }

    showToast(`${demandeFullName(ratifyingDemande)} ratifié et ajouté aux adhérents`)
    fetchDemandes()
  }

  async function handleRefuse() {
    if (!refusingDemande) return
    setRefusing(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('demandes_adhesion')
      .update({
        statut: 'refusee',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
      })
      .eq('id', refusingDemande.id)

    setRefusing(false)

    if (err) {
      setError(err.message)
      return
    }

    showToast(`Demande de ${demandeFullName(refusingDemande)} refusée`)
    setRefusingDemande(null)
    fetchDemandes()
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Demandes d'adhésion</h1>
          <p className="mt-1 text-sm text-slate-500">
            Demandes soumises via le formulaire public, à ratifier par le conseil d'administration.
          </p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Erreur : {error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex gap-1 border-b border-slate-200 px-6 pt-4">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                  tab === t.value
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : demandes.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-400">Aucune demande</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Civilité</th>
                    <th className="px-6 py-3">Nom</th>
                    <th className="px-6 py-3">Prénom</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">{tab === 'en_attente' ? 'Soumise le' : 'Décidée le'}</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {demandes.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-500">{CIVILITE_ADHERENT_LABELS[d.civilite]}</td>
                      <td className="px-6 py-3 font-medium text-slate-900">{d.nom}</td>
                      <td className="px-6 py-3 text-slate-700">{d.prenom ?? '—'}</td>
                      <td className="px-6 py-3 text-slate-500">
                        {d.courriel ?? '—'}
                        {d.telephone && <p className="text-xs text-slate-400">{d.telephone}</p>}
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {formatDateTime(tab === 'en_attente' ? d.created_at : (d.decided_at ?? d.created_at))}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setDetailDemande(d)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Détail
                          </button>
                          {tab === 'en_attente' && (
                            <>
                              <button
                                onClick={() => setRatifyingDemande(d)}
                                className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                              >
                                Ratifier
                              </button>
                              <button
                                onClick={() => setRefusingDemande(d)}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Refuser
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {ratifyingDemande && organisationId && (
        <AdherentModal
          open
          onClose={() => setRatifyingDemande(undefined)}
          onSaved={handleRatified}
          organisationId={organisationId}
          prefill={{
            civilite: ratifyingDemande.civilite,
            nom: ratifyingDemande.nom,
            prenom: ratifyingDemande.prenom,
            date_naissance: ratifyingDemande.date_naissance,
            adresse: ratifyingDemande.adresse,
            code_postal: ratifyingDemande.code_postal,
            ville: ratifyingDemande.ville,
            telephone: ratifyingDemande.telephone,
            courriel: ratifyingDemande.courriel,
          }}
        />
      )}

      {refusingDemande && (
        <Modal open onClose={() => setRefusingDemande(null)} maxWidthClassName="max-w-sm" labelledBy="refuse-demande-title">
          <div className="p-6">
            <h2 id="refuse-demande-title" className="text-lg font-semibold text-slate-900">Refuser la demande</h2>
            <p className="mt-2 text-sm text-slate-600">
              Êtes-vous sûr de vouloir refuser la demande d'adhésion de{' '}
              <span className="font-medium">« {demandeFullName(refusingDemande)} »</span> ? Elle restera visible dans
              l'onglet Refusées.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setRefusingDemande(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuse}
                disabled={refusing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {refusing ? 'Refus…' : 'Refuser'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detailDemande && (
        <Modal open onClose={() => setDetailDemande(null)} maxWidthClassName="max-w-lg" labelledBy="detail-demande-title">
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <h2 id="detail-demande-title" className="text-lg font-semibold text-slate-900">
              {demandeFullName(detailDemande)}
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Civilité</dt>
                <dd className="mt-0.5 text-slate-700">{CIVILITE_ADHERENT_LABELS[detailDemande.civilite]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Date de naissance</dt>
                <dd className="mt-0.5 text-slate-700">{detailDemande.date_naissance ? formatDate(detailDemande.date_naissance) : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Adresse</dt>
                <dd className="mt-0.5 text-slate-700">
                  {detailDemande.adresse ?? '—'}
                  {(detailDemande.code_postal || detailDemande.ville) && (
                    <>
                      <br />
                      {detailDemande.code_postal} {detailDemande.ville}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Téléphone</dt>
                <dd className="mt-0.5 text-slate-700">{detailDemande.telephone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Courriel</dt>
                <dd className="mt-0.5 text-slate-700">{detailDemande.courriel ?? '—'}</dd>
              </div>
            </dl>

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Signature</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <img src={detailDemande.signature_data_url} alt="Signature" className="w-full" />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Demande soumise le {formatDateTime(detailDemande.created_at)}, statuts approuvés et consentement RGPD donné.
            </p>
          </div>
        </Modal>
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
