import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Adherent, DemandeAdhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from '../lib/civiliteAdherent'
import { useToast } from '../hooks/useToast'
import {
  findAdherentDuplicates,
  RAISON_EMAIL,
  RAISON_TELEPHONE,
  RAISON_NOM_PRENOM,
  type DuplicateMatch,
} from '../lib/adherentDuplicateCheck'
import Toast from '../components/Toast'
import AdherentModal from '../components/AdherentModal'
import ScrollShadowX from '../components/ScrollShadowX'
import { logModification } from '../lib/journalModifications'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Dialog, DialogContent } from '../components/ui/dialog'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function demandeFullName(d: DemandeAdhesion): string {
  return [d.prenom, d.nom].filter(Boolean).join(' ')
}

function adherentFullName(a: Adherent): string {
  return [a.prenom, a.nom].filter(Boolean).join(' ')
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
  const [motifRefus, setMotifRefus] = useState('')
  const [detailDemande, setDetailDemande] = useState<DemandeAdhesion | null>(null)
  // Doublons potentiels par demande, calculés dès le chargement de la liste (pas seulement au clic
  // sur "Ratifier") pour permettre une colorimétrie différente dans le tableau et le détail.
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, DuplicateMatch[]>>({})
  const [duplicatesMapLoading, setDuplicatesMapLoading] = useState(false)

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

    const list = (data ?? []) as DemandeAdhesion[]
    setDemandes(list)
    setLoading(false)

    setDuplicatesMapLoading(true)
    const entries = await Promise.all(
      list.map(async (d) => {
        const matches = await findAdherentDuplicates(
          organisationId,
          { nom: d.nom, prenom: d.prenom, courriel: d.courriel, telephone: d.telephone },
          d.adherent_id,
        )
        return [d.id, matches] as const
      }),
    )
    setDuplicatesMap(Object.fromEntries(entries))
    setDuplicatesMapLoading(false)
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
    if (organisationId) {
      await logModification({
        organisationId,
        tableCible: 'demandes_adhesion',
        ligneId: ratifyingDemande.id,
        action: 'ratification',
        details: { nom: ratifyingDemande.nom, prenom: ratifyingDemande.prenom, adherent_id: adherent.id },
      })
    }
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
        motif_refus: motifRefus.trim() || null,
      })
      .eq('id', refusingDemande.id)

    setRefusing(false)

    if (err) {
      setError(err.message)
      return
    }

    showToast(`Demande de ${demandeFullName(refusingDemande)} refusée`)
    if (organisationId) {
      await logModification({
        organisationId,
        tableCible: 'demandes_adhesion',
        ligneId: refusingDemande.id,
        action: 'refus',
        details: { nom: refusingDemande.nom, prenom: refusingDemande.prenom, motif_refus: motifRefus.trim() || null },
      })
    }
    setRefusingDemande(null)
    setMotifRefus('')
    fetchDemandes()
  }

  return (
    <>
      {/*
        THESIS: une demande d'adhésion est une pièce du registre en attente d'instruction —
        le doublon potentiel est le seul signal qui mérite de rompre le monochrome, jamais
        une décoration.
        OWN-WORLD: papier clair (paper), encre vermillon (stamp, marque/danger), plus deux
        encres sémantiques réservées introduites sur cette page — ambre (warning, doublon
        possible) et vert registre (success, ratification) — jamais mélangées à l'accent de
        marque, même principe de réserve que l'ancien DESIGN.md.
        STORY: l'admin instruit une pile de demandes, repère les doublons au premier coup
        d'œil, décide (ratifier/refuser) sans quitter le tableau.
        FIRST VIEWPORT: onglets (en attente/ratifiées/refusées) + tableau en registre,
        premier vrai <table> du rollout — nouvelle primitive Table introduite ici.
        FORM: 3e page du rollout "carnet tamponné x registre" (direction validée sur
        ActivitesPage, PR #112 ; DonsReguliersPage, PR #113).
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Demandes d'adhésion</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Demandes soumises via le formulaire public, à ratifier par le conseil d'administration.
          </p>
        </div>

        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            Erreur : {error}
          </div>
        )}

        <div className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
          <div className="flex gap-1 border-b border-paper-border px-4 pt-4 md:px-6">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'rounded-t-sm px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.value
                    ? 'border-b-2 border-stamp text-stamp'
                    : 'text-ink-faint hover:text-ink-muted'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
            </div>
          ) : demandes.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-registre text-sm text-ink-faint">Aucune demande</p>
            </div>
          ) : (
            <ScrollShadowX>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Civilité</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>{tab === 'en_attente' ? 'Soumise le' : 'Décidée le'}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demandes.map((d) => {
                    const hasDuplicate = (duplicatesMap[d.id]?.length ?? 0) > 0
                    return (
                      <TableRow
                        key={d.id}
                        onClick={() => setDetailDemande(d)}
                        className={cn(
                          'cursor-pointer',
                          hasDuplicate ? 'bg-warning-tint hover:bg-warning-tint/70' : 'hover:bg-paper-border/20'
                        )}
                      >
                        <TableCell className="text-ink-faint">{CIVILITE_ADHERENT_LABELS[d.civilite]}</TableCell>
                        <TableCell className="font-medium text-ink">
                          <div className="flex items-center gap-2">
                            {d.nom}
                            {hasDuplicate && (
                              <span
                                title={duplicatesMap[d.id].map((m) => `${adherentFullName(m.adherent)} (${m.raisons.join(', ')})`).join(' · ')}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-warning-border bg-white px-2 py-0.5 font-registre-mono text-[11px] font-medium text-warning"
                              >
                                Doublon possible
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-ink-muted">{d.prenom ?? '—'}</TableCell>
                        <TableCell className="text-ink-faint">
                          {d.courriel ?? '—'}
                          {d.telephone && <p className="font-registre-mono text-xs text-ink-faint">{d.telephone}</p>}
                        </TableCell>
                        <TableCell className="font-registre-mono text-xs text-ink-faint">
                          {formatDateTime(tab === 'en_attente' ? d.created_at : (d.decided_at ?? d.created_at))}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setDetailDemande(d)}>
                              Détail
                            </Button>
                            {tab === 'en_attente' && (
                              <>
                                <Button variant="success" size="sm" onClick={() => setRatifyingDemande(d)}>
                                  Ratifier
                                </Button>
                                <Button variant="default" size="sm" onClick={() => setRefusingDemande(d)}>
                                  Refuser
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollShadowX>
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
            pays: ratifyingDemande.pays,
            telephone: ratifyingDemande.telephone,
            courriel: ratifyingDemande.courriel,
          }}
          duplicateWarnings={duplicatesMap[ratifyingDemande.id] ?? []}
          duplicateWarningsLoading={duplicatesMapLoading && !(ratifyingDemande.id in duplicatesMap)}
        />
      )}

      <Dialog open={!!refusingDemande} onOpenChange={(next) => { if (!next) { setRefusingDemande(null); setMotifRefus('') } }}>
        <DialogContent aria-describedby={undefined}>
          {refusingDemande && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Refuser la demande</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir refuser la demande d'adhésion de{' '}
                <span className="font-medium text-ink">« {demandeFullName(refusingDemande)} »</span> ? Elle restera visible dans
                l'onglet Refusées.
              </p>
              <div className="mt-4 space-y-1.5">
                <label className="block font-registre text-sm font-medium text-ink-muted">
                  Motif du refus <span className="font-normal text-ink-faint">(interne, non transmis au demandeur)</span>
                </label>
                <Textarea
                  value={motifRefus}
                  onChange={(e) => setMotifRefus(e.target.value)}
                  rows={3}
                  placeholder="Optionnel"
                />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setRefusingDemande(null); setMotifRefus('') }}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleRefuse} disabled={refusing}>
                  {refusing ? 'Refus…' : 'Refuser'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailDemande} onOpenChange={(next) => { if (!next) setDetailDemande(null) }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          {detailDemande && (() => {
            const detailDuplicates = duplicatesMap[detailDemande.id] ?? []
            const nomPrenomConflicts = detailDuplicates.filter((m) => m.raisons.includes(RAISON_NOM_PRENOM))
            const telephoneConflicts = detailDuplicates.filter((m) => m.raisons.includes(RAISON_TELEPHONE))
            const courrielConflicts = detailDuplicates.filter((m) => m.raisons.includes(RAISON_EMAIL))
            const conflictLabel = (matches: DuplicateMatch[]) => matches.map((m) => adherentFullName(m.adherent)).join(', ')

            return (
              <>
                <div className="overflow-y-auto p-6">
                  <h2 className="font-registre text-lg font-semibold text-ink">
                    {demandeFullName(detailDemande)}
                  </h2>

                  {detailDuplicates.length > 0 && (
                    <div className="mt-3 rounded-sm border-2 border-warning-border bg-warning-tint px-4 py-3 font-registre text-sm text-warning">
                      <p className="font-semibold">Adhérent(s) potentiellement déjà existant(s)</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4">
                        {detailDuplicates.map((m) => (
                          <li key={m.adherent.id}>
                            <span className="font-medium">{adherentFullName(m.adherent)}</span> — {m.raisons.join(', ')}
                            {m.adherent.statut === 'archive' && ' (archivé)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-registre text-sm">
                    <div className="col-span-2">
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Nom et prénom</dt>
                      <dd
                        className={cn(
                          'mt-0.5',
                          nomPrenomConflicts.length > 0 ? 'rounded-sm border border-warning-border bg-warning-tint px-2 py-1 text-warning' : 'text-ink-muted'
                        )}
                      >
                        {demandeFullName(detailDemande)}
                      </dd>
                      {nomPrenomConflicts.length > 0 && (
                        <p className="mt-1 font-registre-mono text-[11px] text-warning">Déjà utilisé par {conflictLabel(nomPrenomConflicts)}</p>
                      )}
                    </div>
                    <div>
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Civilité</dt>
                      <dd className="mt-0.5 text-ink-muted">{CIVILITE_ADHERENT_LABELS[detailDemande.civilite]}</dd>
                    </div>
                    <div>
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Date de naissance</dt>
                      <dd className="mt-0.5 text-ink-muted">{detailDemande.date_naissance ? formatDate(detailDemande.date_naissance) : '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Adresse</dt>
                      <dd className="mt-0.5 text-ink-muted">
                        {detailDemande.adresse ?? '—'}
                        {(detailDemande.code_postal || detailDemande.ville) && (
                          <>
                            <br />
                            {detailDemande.code_postal} {detailDemande.ville}
                          </>
                        )}
                        {detailDemande.pays && detailDemande.pays !== 'France' && (
                          <>
                            <br />
                            {detailDemande.pays}
                          </>
                        )}
                      </dd>
                    </div>
                    {/* Téléphone/Courriel en pleine largeur (pas de colonne à 50%) : contrairement à
                        Civilité/Date de naissance (formats courts et fixes), un email long forçait un
                        scroll horizontal de la modale (retour utilisateur, testé sur une vraie demande). */}
                    <div className="col-span-2">
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Téléphone</dt>
                      <dd
                        className={cn(
                          'mt-0.5 break-words',
                          telephoneConflicts.length > 0 ? 'rounded-sm border border-warning-border bg-warning-tint px-2 py-1 text-warning' : 'text-ink-muted'
                        )}
                      >
                        {detailDemande.telephone ?? '—'}
                      </dd>
                      {telephoneConflicts.length > 0 && (
                        <p className="mt-1 font-registre-mono text-[11px] text-warning">Déjà utilisé par {conflictLabel(telephoneConflicts)}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Courriel</dt>
                      <dd
                        className={cn(
                          'mt-0.5 break-words',
                          courrielConflicts.length > 0 ? 'rounded-sm border border-warning-border bg-warning-tint px-2 py-1 text-warning' : 'text-ink-muted'
                        )}
                      >
                        {detailDemande.courriel ?? '—'}
                      </dd>
                      {courrielConflicts.length > 0 && (
                        <p className="mt-1 font-registre-mono text-[11px] text-warning">Déjà utilisé par {conflictLabel(courrielConflicts)}</p>
                      )}
                    </div>
                  </dl>

                  <div className="mt-5">
                    <p className="mb-2 font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Signature</p>
                    <div className="rounded-sm border border-paper-border bg-paper p-3">
                      <img src={detailDemande.signature_data_url} alt="Signature" className="w-full" />
                    </div>
                  </div>

                  {detailDemande.statut === 'refusee' && detailDemande.motif_refus && (
                    <div className="mt-5">
                      <p className="mb-2 font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Motif du refus</p>
                      <p className="rounded-sm border border-stamp/30 bg-stamp/[0.04] p-3 font-registre text-sm text-stamp">
                        {detailDemande.motif_refus}
                      </p>
                    </div>
                  )}

                  <p className="mt-3 font-registre-mono text-[11px] text-ink-faint">
                    Demande soumise le {formatDateTime(detailDemande.created_at)}, statuts approuvés et consentement RGPD donné.
                  </p>
                </div>

                {detailDemande.statut === 'en_attente' && (
                  <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
                    <Button variant="destructive" onClick={() => { const d = detailDemande; setDetailDemande(null); setRefusingDemande(d) }}>
                      Refuser
                    </Button>
                    <Button
                      variant="success"
                      className="border-none bg-success text-white hover:bg-success/90"
                      onClick={() => { const d = detailDemande; setDetailDemande(null); setRatifyingDemande(d) }}
                    >
                      Ratifier
                    </Button>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
