import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import ScrollShadowX from '../components/ScrollShadowX'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'
import AdherentModal from '../components/AdherentModal'
import type { Activite, Adherent } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Dialog, DialogContent } from '../components/ui/dialog'

type FiltreStatut = 'actif' | 'archive' | 'tous'

function parseEnvoyerA(value: string): { filtreStatut: FiltreStatut; tagEnvoi: string | null } {
  const sep = value.indexOf(':')
  const kind = value.slice(0, sep)
  const rest = value.slice(sep + 1)
  if (kind === 'tag') return { filtreStatut: 'tous', tagEnvoi: rest }
  return { filtreStatut: rest as FiltreStatut, tagEnvoi: null }
}

function selectionLabel(filtreStatut: FiltreStatut, tagEnvoi: string | null): string {
  if (tagEnvoi) return `Liste : ${tagEnvoi}`
  if (filtreStatut === 'archive') return 'Adhérents archivés'
  if (filtreStatut === 'tous') return 'Tous les adhérents'
  return 'Adhérents actifs'
}

interface CampagneCourrier {
  id: string
  activite_id: string
  selection_label: string
  nombre_destinataires: number
  nombre_exclus: number
  created_at: string
  activites: { nom: string } | null
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-paper-border bg-white">
      <div className="border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function CampagneCourrierPage() {
  const organisationId = useOrganisationId()
  const navigate = useNavigate()
  const { toast, showToast, dismissToast } = useToast()

  const [activites, setActivites] = useState<Activite[]>([])
  const [activiteId, setActiviteId] = useState('')
  const [envoyerA, setEnvoyerA] = useState('statut:actif')
  const [excludeTag, setExcludeTag] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [destinatairesCount, setDestinatairesCount] = useState<{ complets: number; exclus: number } | null>(null)
  const [destinatairesApercu, setDestinatairesApercu] = useState<
    { id: string; nom: string; prenom: string | null; adresse: string; code_postal: string; ville: string }[]
  >([])
  const [apercuOpen, setApercuOpen] = useState(false)
  const [editingAdherent, setEditingAdherent] = useState<Adherent | undefined>(undefined)
  const [adherentModalOpen, setAdherentModalOpen] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [historique, setHistorique] = useState<CampagneCourrier[]>([])
  const [historiqueLoading, setHistoriqueLoading] = useState(true)

  const { filtreStatut, tagEnvoi } = parseEnvoyerA(envoyerA)

  useEffect(() => {
    if (!organisationId) return
    supabase.from('activites').select('*').eq('organisation_id', organisationId).order('nom').then(({ data }) => {
      setActivites((data ?? []) as Activite[])
    })
  }, [organisationId])

  useEffect(() => {
    if (!organisationId) return
    supabase
      .from('listes_diffusion')
      .select('nom')
      .eq('organisation_id', organisationId)
      .order('nom')
      .then(({ data }) => {
        setAvailableTags(((data ?? []) as { nom: string }[]).map((r) => r.nom))
      })
  }, [organisationId])

  const fetchHistorique = useCallback(async () => {
    if (!organisationId) return
    setHistoriqueLoading(true)
    const { data } = await supabase
      .from('campagnes_courrier')
      .select('id, activite_id, selection_label, nombre_destinataires, nombre_exclus, created_at, activites(nom)')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorique((data ?? []) as unknown as CampagneCourrier[])
    setHistoriqueLoading(false)
  }, [organisationId])

  useEffect(() => {
    fetchHistorique()
  }, [fetchHistorique])

  // Même garde-fou de séquencement que CampagneMailingPage : ignorer une
  // réponse arrivée après un fetch plus récent (changement rapide de filtre).
  const destinatairesRequestIdRef = useRef(0)

  const fetchDestinatairesCount = useCallback(async () => {
    if (!organisationId) return
    const requestId = ++destinatairesRequestIdRef.current
    let query = supabase
      .from('adherents')
      .select('id, nom, prenom, adresse, code_postal, ville, tags')
      .eq('organisation_id', organisationId)
    if (tagEnvoi) {
      query = query.contains('tags', [tagEnvoi])
    } else if (filtreStatut !== 'tous') {
      query = query.eq('statut', filtreStatut)
    }
    const { data } = await query
    if (requestId !== destinatairesRequestIdRef.current) return
    const rows = (data ?? []) as {
      id: string
      nom: string
      prenom: string | null
      adresse: string | null
      code_postal: string | null
      ville: string | null
      tags: string[]
    }[]
    const filtered = excludeTag ? rows.filter((a) => !(a.tags ?? []).includes(excludeTag)) : rows
    const complets = filtered.filter((a) => a.adresse?.trim() && a.code_postal?.trim() && a.ville?.trim())
    setDestinatairesCount({ complets: complets.length, exclus: filtered.length - complets.length })
    setDestinatairesApercu(
      complets.map((a) => ({ id: a.id, nom: a.nom, prenom: a.prenom, adresse: a.adresse!, code_postal: a.code_postal!, ville: a.ville! })),
    )
  }, [organisationId, filtreStatut, tagEnvoi, excludeTag])

  async function handleApercuRowClick(id: string) {
    const { data } = await supabase.from('adherents').select('*').eq('id', id).single()
    if (!data) return
    setEditingAdherent(data as Adherent)
    setApercuOpen(false)
    setAdherentModalOpen(true)
  }

  function handleAdherentSaved() {
    fetchDestinatairesCount()
  }

  useEffect(() => {
    fetchDestinatairesCount()
  }, [fetchDestinatairesCount])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setGenerateError('Session expirée')
      setGenerating(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-campagne-courrier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        activite_id: activiteId,
        filtre_statut: filtreStatut,
        tag_envoi: tagEnvoi,
        exclude_tag: excludeTag || null,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setGenerateError(json.error ?? 'Erreur inconnue')
      setGenerating(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const dispositionFilename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
    const link = document.createElement('a')
    link.href = url
    link.download = dispositionFilename ?? 'campagne-courrier.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    const nombreDestinataires = res.headers.get('X-Nombre-Destinataires')

    setGenerating(false)
    setConfirmOpen(false)
    showToast(`Planche générée pour ${nombreDestinataires ?? destinatairesCount?.complets ?? 0} destinataire(s)`)
    fetchHistorique()
  }

  const canGenerate = activiteId !== '' && (destinatairesCount?.complets ?? 0) > 0

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Campagne courrier</h1>
        <p className="mt-1 text-sm text-ink-muted">Générez une planche d'étiquettes adresse pour une campagne d'information papier.</p>
      </div>

      <SectionCard title="Nouvelle campagne" description="Sélectionnez l'activité concernée et les destinataires.">
        <div className="max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <Label>
              Activité <span className="text-stamp">*</span>
            </Label>
            <ActiviteAutocomplete
              activites={activites}
              value={activiteId}
              onChange={setActiviteId}
              placeholder="Rechercher une activité…"
            />
            <p className="text-xs text-ink-faint">Sert à identifier la campagne (QR code) en cas de retour de courrier.</p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <div className="space-y-1.5">
              <Label>Destinataires</Label>
              <Select
                value={envoyerA}
                onChange={(e) => {
                  if (e.target.value === '__create__') {
                    navigate('/admin/adherents')
                    return
                  }
                  setEnvoyerA(e.target.value)
                }}
                className="w-full"
              >
                <optgroup label="Statut">
                  <option value="statut:actif">Adhérents actifs</option>
                  <option value="statut:archive">Adhérents archivés</option>
                  <option value="statut:tous">Tous les adhérents</option>
                </optgroup>
                {availableTags.length > 0 && (
                  <optgroup label="Listes">
                    {availableTags.map((tag) => (
                      <option key={tag} value={`tag:${tag}`}>Liste : {tag}</option>
                    ))}
                  </optgroup>
                )}
                <option value="__create__">+ Créer une nouvelle liste</option>
              </Select>
            </div>

            {availableTags.length > 0 && (
              <div className="space-y-1.5">
                <Label>Exclure la liste</Label>
                <Select value={excludeTag} onChange={(e) => setExcludeTag(e.target.value)} className="w-full">
                  <option value="">Aucune</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {destinatairesCount && (
            <p className="text-xs text-ink-faint">
              {destinatairesCount.complets} destinataire{destinatairesCount.complets > 1 ? 's' : ''} avec adresse complète
              {destinatairesCount.exclus > 0 && ` — ${destinatairesCount.exclus} exclu${destinatairesCount.exclus > 1 ? 's' : ''} (adresse incomplète)`}
              {destinatairesCount.complets > 0 && (
                <>
                  {' — '}
                  <button type="button" onClick={() => setApercuOpen(true)} className="font-medium text-stamp hover:underline">
                    Voir la liste ({destinatairesCount.complets})
                  </button>
                </>
              )}
            </p>
          )}

          <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canGenerate}>
            Générer le PDF
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Historique" description="20 dernières campagnes courrier générées.">
        {historiqueLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
          </div>
        ) : historique.length === 0 ? (
          <p className="text-sm text-ink-faint">Aucune campagne courrier générée pour le moment.</p>
        ) : (
          <ScrollShadowX>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activité</TableHead>
                  <TableHead>Sélection</TableHead>
                  <TableHead>Destinataires</TableHead>
                  <TableHead>Exclus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historique.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-ink-muted">{formatDateTime(c.created_at)}</TableCell>
                    <TableCell className="font-medium text-ink">{c.activites?.nom ?? '—'}</TableCell>
                    <TableCell className="text-ink-muted">{c.selection_label}</TableCell>
                    <TableCell className="text-ink-muted">{c.nombre_destinataires}</TableCell>
                    <TableCell className="text-ink-muted">{c.nombre_exclus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollShadowX>
        )}
      </SectionCard>

      <Dialog open={confirmOpen} onOpenChange={(next) => { if (!next && !generating) setConfirmOpen(false) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <div className="p-6">
            <h2 className="font-registre text-lg font-semibold text-ink">Générer la planche d'étiquettes</h2>
            <p className="mt-2 font-registre text-sm text-ink-muted">
              Vous êtes sur le point de générer une planche pour{' '}
              <span className="font-medium text-ink">
                {destinatairesCount?.complets ?? 0} destinataire{(destinatairesCount?.complets ?? 0) > 1 ? 's' : ''}
              </span>{' '}
              ({selectionLabel(filtreStatut, tagEnvoi)}).
            </p>
            {generateError && (
              <div className="mt-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                {generateError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={generating}>
                Annuler
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Génération…' : 'Générer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={apercuOpen} onOpenChange={(next) => { if (!next) setApercuOpen(false) }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <div className="flex max-h-[80vh] flex-col p-6">
            <h2 className="font-registre text-lg font-semibold text-ink">Destinataires de la campagne</h2>
            <div className="mt-4 flex-1 overflow-y-auto">
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Adresse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {destinatairesApercu.map((a) => (
                      <TableRow key={a.id} onClick={() => handleApercuRowClick(a.id)} className="cursor-pointer hover:bg-paper-border/20">
                        <TableCell className="font-medium text-ink">{a.nom}</TableCell>
                        <TableCell className="text-ink-muted">{a.prenom ?? '—'}</TableCell>
                        <TableCell className="text-ink-muted">{a.adresse}, {a.code_postal} {a.ville}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setApercuOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AdherentModal
        open={adherentModalOpen}
        onClose={() => setAdherentModalOpen(false)}
        onSaved={handleAdherentSaved}
        adherent={editingAdherent}
        organisationId={organisationId}
        availableTags={availableTags}
      />

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
