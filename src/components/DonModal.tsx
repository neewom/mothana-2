import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Don, ProfilParticipant, Activite, ModePaiement } from '../types'
import ParticipantAutocomplete from './ParticipantAutocomplete'
import ActiviteAutocomplete from './ActiviteAutocomplete'
import ParticipantModal from './ParticipantModal'
import DonFichiers, { type DonFichiersHandle } from './DonFichiers'
import AdherentFallbackSuggestions from './AdherentFallbackSuggestions'
import type { ParticipantEnAttente } from '../lib/adherentTranspose'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { participantFullName, filterParticipants } from '../lib/participantSearch'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface DonModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  // Message prêt à afficher dans un toast par le parent (montant formaté,
  // et détail des éventuelles pièces jointes en échec) — le parent décide
  // comment/où l'afficher, DonModal ne connaît pas son système de toast.
  onDonSaved?: (message: string, durationMs?: number) => void
  don?: Don
  participants: ProfilParticipant[]
  activites: Activite[]
  organisationId: string
  defaultParticipantId?: string
}

function formatEur(montant: number): string {
  return montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export default function DonModal({
  open,
  onClose,
  onSaved,
  onDonSaved,
  don,
  participants,
  activites,
  organisationId,
  defaultParticipantId,
}: DonModalProps) {
  const isEdit = !!don

  const [profilParticipantId, setProfilParticipantId] = useState('')
  const [activiteId, setActiviteId] = useState('')
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(todayISO())
  const [modePaiement, setModePaiement] = useState<ModePaiement>(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const donFichiersRef = useRef<DonFichiersHandle>(null)
  // Portée ici (pas dans AdherentFallbackSuggestions) car ce composant se
  // démonte dès que profilParticipantId devient non-vide (showAdherentFallback
  // ci-dessous) — un état interne à ce composant ne survivrait pas jusqu'à la
  // validation du don.
  const pendingTransposeRef = useRef<{ participantId: string; persist: ParticipantEnAttente['persist'] } | null>(null)

  // Participant created via the full ParticipantModal (opened from "+
  // Nouveau participant"), not yet present in the `participants` prop from
  // the parent list until its next refetch.
  const [fullModalOpen, setFullModalOpen] = useState(false)
  const [extraParticipants, setExtraParticipants] = useState<ProfilParticipant[]>([])
  const [participantSearch, setParticipantSearch] = useState('')

  const allParticipants = useMemo(
    () => (extraParticipants.length ? [...participants, ...extraParticipants] : participants),
    [participants, extraParticipants]
  )

  // Repli adhérents : uniquement si aucun participant existant ne correspond
  // déjà au texte tapé (cf. cadrage "Sélection d'un adhérent à la saisie d'un
  // don" — la recherche participant reste le premier réflexe, inchangée).
  const showAdherentFallback =
    !isEdit &&
    !profilParticipantId &&
    participantSearch.trim().length >= 2 &&
    filterParticipants(allParticipants, participantSearch).length === 0

  useEffect(() => {
    if (open) {
      if (don) {
        setProfilParticipantId(don.profil_participant_id)
        setActiviteId(don.activite_id ?? '')
        setMontant(String(don.montant))
        setDate(don.date)
        setModePaiement(don.mode_paiement)
      } else {
        setProfilParticipantId(defaultParticipantId ?? '')
        setActiviteId('')
        setMontant('')
        setDate(todayISO())
        setModePaiement(3)
      }
      setFullModalOpen(false)
      setExtraParticipants([])
      setParticipantSearch('')
      setError(null)
      pendingTransposeRef.current = null
    }
    // defaultParticipantId lu seulement à l'ouverture — l'exclure évite de réinitialiser
    // la sélection en cours si la prop change pendant que la modale est déjà ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, don])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!profilParticipantId) {
      setError('Veuillez sélectionner ou créer un donateur.')
      return
    }

    const isReassignment = isEdit && don && profilParticipantId !== don.profil_participant_id

    if (isReassignment && don) {
      const annee = Number(date.slice(0, 4))
      const { data: blockingRecus, error: checkErr } = await supabase
        .from('recus_fiscaux')
        .select('profil_participant_id')
        .eq('organisation_id', organisationId)
        .eq('annee', annee)
        .in('profil_participant_id', [don.profil_participant_id, profilParticipantId])

      if (checkErr) {
        setError(checkErr.message)
        return
      }

      if (blockingRecus && blockingRecus.length > 0) {
        const blockedIds = new Set(blockingRecus.map((r) => r.profil_participant_id))
        const names: string[] = []
        if (blockedIds.has(don.profil_participant_id)) {
          const source = allParticipants.find((p) => p.id === don.profil_participant_id)
          names.push(source ? participantFullName(source) : 'le donateur actuel')
        }
        if (blockedIds.has(profilParticipantId)) {
          const dest = allParticipants.find((p) => p.id === profilParticipantId)
          names.push(dest ? participantFullName(dest) : 'le nouveau donateur')
        }
        setError(
          `Impossible de réaffecter ce don : un reçu fiscal ${annee} a déjà été émis pour ${names.join(' et ')}. Réaffecter désynchroniserait le montant du reçu déjà émis.`
        )
        return
      }
    }

    setSaving(true)

    const payload = {
      profil_participant_id: profilParticipantId,
      activite_id: activiteId || null,
      montant: parseFloat(montant),
      date,
      mode_paiement: modePaiement,
    }

    if (isEdit && don) {
      const { error: updateErr } = await supabase.from('dons').update(payload).eq('id', don.id)

      setSaving(false)

      if (updateErr) {
        setError(updateErr.message)
        return
      }

      onSaved()
      onDonSaved?.(`Don de ${formatEur(payload.montant)} modifié`)
      onClose()
      return
    }

    // Si un adhérent a été transposé en donateur (AdherentFallbackSuggestions),
    // rien n'a encore été écrit en base à ce stade — seulement préparé. Ce
    // n'est qu'ici, à la validation effective de la saisie du don, que le
    // donateur est réellement créé (cf. cadrage : le doublonnement ne doit
    // être effectif qu'à la validation du don, pas avant).
    const pendingTranspose = pendingTransposeRef.current
    const transposeErr =
      pendingTranspose && pendingTranspose.participantId === profilParticipantId
        ? await pendingTranspose.persist()
        : null
    pendingTransposeRef.current = null
    if (transposeErr) {
      setSaving(false)
      setError(`Impossible de créer le donateur à partir de l'adhérent : ${transposeErr}`)
      return
    }

    const { data: created, error: insertErr } = await supabase
      .from('dons')
      .insert({
        ...payload,
        organisation_id: organisationId,
        created_by_role: 'admin',
      })
      .select('id')
      .single()

    if (insertErr || !created) {
      setSaving(false)
      setError(insertErr?.message ?? 'Erreur lors de la création du don.')
      return
    }

    // Le don est déjà enregistré à ce stade — un échec d'upload des pièces
    // jointes en attente ne doit pas bloquer la fermeture de la modale ni être
    // présenté comme un échec de l'enregistrement du don lui-même. Le message
    // (succès ou avertissement) est délégué à un toast côté parent, qui
    // persiste après la fermeture — contrairement au bandeau d'erreur de la
    // modale, coupé net si l'utilisateur clique en dehors pour essayer de le
    // lire (cf. retour utilisateur du 2026-09-07).
    const uploadErrors = (await donFichiersRef.current?.uploadStaged(created.id)) ?? []

    setSaving(false)
    onSaved()

    if (uploadErrors.length > 0) {
      onDonSaved?.(
        `Don de ${formatEur(payload.montant)} enregistré, mais pièce(s) jointe(s) en échec : ${uploadErrors.join(' ; ')}`,
        8000
      )
    } else {
      onDonSaved?.(`Don de ${formatEur(payload.montant)} enregistré`)
    }

    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
        <DialogContent
          className="max-w-md"
          aria-describedby={undefined}
          // Le ParticipantModal imbriqué ("+ Nouveau participant") est porté hors de ce
          // DialogContent (voir plus bas) : Radix considère donc tout clic/Escape dedans
          // comme "à l'extérieur" de ce Dialog-ci et le fermerait sinon — ignorés quand la
          // cible de l'événement vient du modal imbriqué, quel que soit l'état React au
          // moment où l'event Radix se déclenche (trouvé en testant : une garde basée sur
          // fullModalOpen ne suffisait pas, l'état avait déjà changé entre le clic sur
          // "Fermer" du participant et le moment où Radix traite l'event).
          onInteractOutside={(e) => { if ((e.target as Element | null)?.closest('[data-elevated-modal]')) e.preventDefault() }}
          onEscapeKeyDown={(e) => { if ((e.target as Element | null)?.closest('[data-elevated-modal]')) e.preventDefault() }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Modifier le don' : 'Ajouter un don'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                  {error}
                </div>
              )}

              {/* Donateur */}
              <div className="space-y-1.5">
                <Label>
                  Donateur <span className="text-stamp">*</span>
                </Label>

                <ParticipantAutocomplete
                  participants={allParticipants}
                  value={profilParticipantId}
                  onChange={setProfilParticipantId}
                  onSearchChange={setParticipantSearch}
                  placeholder="Rechercher par nom et prénom…"
                />
                {showAdherentFallback && (
                  <AdherentFallbackSuggestions
                    organisationId={organisationId}
                    search={participantSearch}
                    role="admin"
                    onCreated={(p, persist) => {
                      setExtraParticipants((prev) => [...prev, p])
                      setProfilParticipantId(p.id)
                      setParticipantSearch('')
                      pendingTransposeRef.current = { participantId: p.id, persist }
                    }}
                  />
                )}
                {isEdit && (
                  <p className="font-registre-mono text-[11px] text-ink-faint">
                    Changer le donateur réaffecte ce don — bloqué si un reçu fiscal a déjà été émis pour l'année concernée.
                  </p>
                )}

                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => setFullModalOpen(true)}
                    className="flex items-center gap-1 font-registre-mono text-[11px] font-medium text-stamp hover:text-stamp/80"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Nouveau donateur
                  </button>
                )}
              </div>

              {/* Activité */}
              <div className="space-y-1.5">
                <Label>Activité</Label>
                <ActiviteAutocomplete
                  activites={activites}
                  value={activiteId}
                  onChange={setActiviteId}
                  placeholder="Aucune activité"
                />
              </div>

              {/* Montant */}
              <div className="space-y-1.5">
                <Label htmlFor="don-montant">
                  Montant (€) <span className="text-stamp">*</span>
                </Label>
                <Input
                  id="don-montant"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="don-date">
                  Date <span className="text-stamp">*</span>
                </Label>
                <Input
                  id="don-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Mode de paiement */}
              <div className="space-y-1.5">
                <Label htmlFor="don-mode-paiement">
                  Mode de paiement <span className="text-stamp">*</span>
                </Label>
                <Select
                  id="don-mode-paiement"
                  required
                  value={modePaiement}
                  onChange={(e) => setModePaiement(Number(e.target.value) as ModePaiement)}
                  className="w-full"
                >
                  {MODE_PAIEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              <DonFichiers
                ref={donFichiersRef}
                donId={isEdit && don ? don.id : null}
                organisationId={organisationId}
                canDelete
              />
            </div>

            {/* Actions */}
            <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full participant form, opened from "+ Nouveau participant" — rendu hors du
          Dialog (pas dans DialogContent) : DialogContent applique un translate CSS qui
          créerait un nouveau containing block et casserait le position:fixed de l'ancien
          Modal (pas encore migré) si celui-ci était imbriqué à l'intérieur.
          `elevated` : le Portal Radix du Dialog parent est toujours ré-attaché en fin de
          <body>, donc peint après ce Modal à z-index égal quel que soit l'ordre JSX — sans
          ça, "Ajouter un don" recouvrait "Ajouter un participant" au lieu de l'inverse
          (trouvé en testant). */}
      <ParticipantModal
        open={fullModalOpen}
        onClose={() => setFullModalOpen(false)}
        onSaved={(created) => {
          setExtraParticipants((prev) => [...prev, created])
          setProfilParticipantId(created.id)
          setFullModalOpen(false)
        }}
        organisationId={organisationId}
        elevated
      />
    </>
  )
}
