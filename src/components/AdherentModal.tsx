import { useState, useEffect, useRef, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adherent, Adhesion, CiviliteAdherent, ModePaiement } from '../types'
import { CIVILITE_ADHERENT_OPTIONS } from '../lib/civiliteAdherent'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { generateUUID } from '../lib/uuid'
import { computeDateFin } from '../lib/adhesion'
import { toUpperName, toCapitalizedName, isValidEmail, sanitizeDigits } from '../lib/textFormat'
import { COUNTRIES } from '../lib/countries'
import { maxDateNaissance, isAnneeNaissanceValide } from '../lib/dateNaissance'
import type { DuplicateMatch } from '../lib/adherentDuplicateCheck'
import { logModification, computeAdherentDiff } from '../lib/journalModifications'
import AdherentHistoriqueSection from './AdherentHistoriqueSection'
import TagsInput from './TagsInput'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface IdentitePrefill {
  civilite: CiviliteAdherent
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  telephone: string | null
  courriel: string | null
}

interface AdherentModalProps {
  open: boolean
  onClose: () => void
  onSaved: (adherent: Adherent, adhesion?: Adhesion) => void
  adherent?: Adherent
  organisationId: string
  // Tags déjà utilisés dans l'organisation, pour les puces de suggestion du nuage de tags
  // (optionnel : DemandesAdhesionPage n'a pas cette liste chargée, l'input reste utilisable sans suggestions)
  availableTags?: string[]
  // Pré-remplit le formulaire de création à partir d'une demande d'adhésion en attente de ratification
  prefill?: IdentitePrefill
  // Doublons potentiels détectés côté DemandesAdhesionPage lors de l'ouverture pour ratification
  duplicateWarnings?: DuplicateMatch[]
  duplicateWarningsLoading?: boolean
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function AdherentModal({
  open,
  onClose,
  onSaved,
  adherent,
  organisationId,
  availableTags = [],
  prefill,
  duplicateWarnings,
  duplicateWarningsLoading,
}: AdherentModalProps) {
  const isEdit = !!adherent

  // Identité
  const [civilite, setCivilite] = useState<CiviliteAdherent>(0)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [pays, setPays] = useState('France')
  const [telephone, setTelephone] = useState('')
  const [courriel, setCourriel] = useState('')
  const [mailingOptOut, setMailingOptOut] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  // Sert uniquement à ne recalculer mailing_opt_out_at que si la case a réellement changé
  // (sinon un enregistrement du formulaire sans y toucher écraserait la date d'origine)
  const initialMailingOptOutRef = useRef(false)

  // Premier cycle (création uniquement)
  const [dateDebut, setDateDebut] = useState(today())
  const [montantCotisation, setMontantCotisation] = useState('')
  const [modePaiement, setModePaiement] = useState<ModePaiement | ''>('')
  const [datePaiementCotisation, setDatePaiementCotisation] = useState('')
  const [droitVoteAg, setDroitVoteAg] = useState(true)
  const [bulletinSigne, setBulletinSigne] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (adherent) {
        setCivilite(adherent.civilite)
        setNom(toUpperName(adherent.nom))
        setPrenom(toCapitalizedName(adherent.prenom ?? ''))
        setDateNaissance(adherent.date_naissance ?? '')
        setAdresse(adherent.adresse ?? '')
        setCodePostal(adherent.code_postal ?? '')
        setVille(adherent.ville ?? '')
        setPays(adherent.pays ?? 'France')
        setTelephone(adherent.telephone ?? '')
        setCourriel(adherent.courriel ?? '')
        setMailingOptOut(adherent.mailing_opt_out)
        initialMailingOptOutRef.current = adherent.mailing_opt_out
        setTags(adherent.tags ?? [])
      } else {
        setCivilite(prefill?.civilite ?? 0)
        setNom(toUpperName(prefill?.nom ?? ''))
        setPrenom(toCapitalizedName(prefill?.prenom ?? ''))
        setDateNaissance(prefill?.date_naissance ?? '')
        setAdresse(prefill?.adresse ?? '')
        setCodePostal(prefill?.code_postal ?? '')
        setVille(prefill?.ville ?? '')
        setPays(prefill?.pays ?? 'France')
        setTelephone(prefill?.telephone ?? '')
        setCourriel(prefill?.courriel ?? '')
        setMailingOptOut(false)
        initialMailingOptOutRef.current = false
        setTags([])
        setDateDebut(today())
        setMontantCotisation('')
        setModePaiement('')
        setDatePaiementCotisation('')
        setDroitVoteAg(true)
        setBulletinSigne(true)
      }
      setError(null)
    }
  }, [open, adherent, prefill])

  const courrielInvalid = courriel.length > 0 && !isValidEmail(courriel)
  const dateNaissanceInvalid = dateNaissance !== '' && !isAnneeNaissanceValide(dateNaissance)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (courriel.trim() !== '' && !isValidEmail(courriel)) {
      setError("Le format de l'adresse email est invalide.")
      return
    }
    if (dateNaissanceInvalid) {
      setError("La date de naissance n'est pas valide.")
      return
    }
    if (codePostal.length !== 5) {
      setError('Le code postal doit contenir 5 chiffres.')
      return
    }

    setSaving(true)

    const identite = {
      civilite,
      nom,
      prenom: prenom || null,
      date_naissance: dateNaissance || null,
      adresse: adresse || null,
      code_postal: codePostal || null,
      ville: ville || null,
      pays: pays || null,
      telephone: telephone || null,
      courriel: courriel || null,
      mailing_opt_out: mailingOptOut,
      tags,
      ...(mailingOptOut !== initialMailingOptOutRef.current
        ? { mailing_opt_out_at: mailingOptOut ? new Date().toISOString() : null }
        : {}),
    }

    if (isEdit && adherent) {
      const { error: err } = await supabase.from('adherents').update(identite).eq('id', adherent.id)

      if (err) {
        setError(err.message)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved({ ...adherent, ...identite })
      onClose()
      const champsModifies = computeAdherentDiff(adherent as unknown as Record<string, unknown>, identite)
      await logModification({
        organisationId,
        tableCible: 'adherents',
        ligneId: adherent.id,
        action: 'modification',
        details: { nom, prenom, champs_modifies: champsModifies },
      })
      return
    }

    const { data: idExterne, error: idExterneErr } = await supabase.rpc('next_adherent_id_externe', {
      p_organisation_id: organisationId,
    })

    if (idExterneErr) {
      setError(idExterneErr.message)
      setSaving(false)
      return
    }

    const adherentId = generateUUID()
    const adhesionId = generateUUID()
    const dateFin = computeDateFin(dateDebut)

    const { error: adherentErr } = await supabase.from('adherents').insert({
      id: adherentId,
      organisation_id: organisationId,
      id_externe: idExterne,
      ...identite,
    })

    if (adherentErr) {
      setError(adherentErr.message)
      setSaving(false)
      return
    }

    const { error: adhesionErr } = await supabase.from('adhesions').insert({
      id: adhesionId,
      adherent_id: adherentId,
      date_debut: dateDebut,
      date_fin: dateFin,
      montant_cotisation: montantCotisation ? Number(montantCotisation) : null,
      date_paiement_cotisation: datePaiementCotisation || null,
      mode_paiement: modePaiement || null,
      renouvellement: false,
      droit_vote_ag: droitVoteAg,
      bulletin_signe: bulletinSigne,
    })

    if (adhesionErr) {
      setError(adhesionErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    await logModification({
      organisationId,
      tableCible: 'adherents',
      ligneId: adherentId,
      action: 'creation',
      details: { nom, prenom },
    })
    onSaved(
      {
        id: adherentId,
        organisation_id: organisationId,
        id_externe: idExterne,
        statut: 'actif',
        statuts_acceptes: true,
        consent_rgpd: false,
        mailing_opt_out_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...identite,
      },
      {
        id: adhesionId,
        adherent_id: adherentId,
        date_debut: dateDebut,
        date_fin: dateFin,
        montant_cotisation: montantCotisation ? Number(montantCotisation) : null,
        date_paiement_cotisation: datePaiementCotisation || null,
        mode_paiement: modePaiement || null,
        renouvellement: false,
        droit_vote_ag: droitVoteAg,
        bulletin_signe: bulletinSigne,
        created_at: new Date().toISOString(),
      },
    )
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'adhérent" : 'Ajouter un adhérent'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                {error}
              </div>
            )}

            {prefill && duplicateWarningsLoading && (
              <div className="flex items-center gap-2 rounded-sm border border-warning-border bg-warning-tint px-4 py-3 font-registre text-sm text-warning">
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                Recherche de doublons en cours…
              </div>
            )}

            {prefill && !duplicateWarningsLoading && duplicateWarnings && duplicateWarnings.length > 0 && (
              <div className="rounded-sm border-2 border-warning-border bg-warning-tint px-4 py-3 font-registre text-sm text-warning">
                <p className="font-semibold">Adhérent(s) potentiellement déjà existant(s)</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {duplicateWarnings.map(({ adherent: existing, raisons }) => (
                    <li key={existing.id}>
                      <span className="font-medium">{[existing.prenom, existing.nom].filter(Boolean).join(' ')}</span>
                      {' '}— {raisons.join(', ')}
                      {existing.statut === 'archive' && ' (archivé)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="am-civilite">
                Civilité <span className="text-stamp">*</span>
              </Label>
              <Select
                id="am-civilite"
                required
                value={civilite === 0 ? '' : civilite}
                onChange={(e) => setCivilite(e.target.value ? (Number(e.target.value) as CiviliteAdherent) : 0)}
                className="w-full"
              >
                <option value="" disabled>Sélectionner…</option>
                {CIVILITE_ADHERENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-nom">
                Nom <span className="text-stamp">*</span>
              </Label>
              <Input
                id="am-nom"
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(toUpperName(e.target.value))}
                placeholder="DUPONT"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-prenom">
                Prénom <span className="text-stamp">*</span>
              </Label>
              <Input
                id="am-prenom"
                type="text"
                required
                value={prenom}
                onChange={(e) => setPrenom(toCapitalizedName(e.target.value))}
                placeholder="Jean"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-naissance">
                Date de naissance <span className="text-stamp">*</span>
              </Label>
              <Input
                id="am-naissance"
                type="date"
                required
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
                aria-invalid={dateNaissanceInvalid}
                className={cn(dateNaissanceInvalid && 'border-stamp focus-visible:ring-stamp/70')}
              />
              {dateNaissanceInvalid && (
                <p className="font-registre-mono text-[11px] text-stamp">
                  L'année de naissance doit être {maxDateNaissance().slice(0, 4)} ou antérieure.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-adresse">
                Adresse <span className="text-stamp">*</span>
              </Label>
              <Input
                id="am-adresse"
                type="text"
                required
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="12 rue des Lilas"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="am-cp">
                  Code postal <span className="text-stamp">*</span>
                </Label>
                <Input
                  id="am-cp"
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={5}
                  value={codePostal}
                  onChange={(e) => setCodePostal(sanitizeDigits(e.target.value))}
                  placeholder="75000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-ville">
                  Ville <span className="text-stamp">*</span>
                </Label>
                <Input
                  id="am-ville"
                  type="text"
                  required
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Paris"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-pays">Pays</Label>
              <Select id="am-pays" value={pays} onChange={(e) => setPays(e.target.value)} className="w-full">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-tel">Téléphone</Label>
              <Input
                id="am-tel"
                type="tel"
                inputMode="numeric"
                minLength={10}
                maxLength={25}
                value={telephone}
                onChange={(e) => setTelephone(sanitizeDigits(e.target.value))}
                placeholder="0600000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="am-email">Courriel</Label>
              <Input
                id="am-email"
                type="email"
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                placeholder="jean.dupont@exemple.fr"
                aria-invalid={courrielInvalid}
                className={cn(courrielInvalid && 'border-stamp focus-visible:ring-stamp/70')}
              />
              {courrielInvalid && <p className="font-registre-mono text-[11px] text-stamp">Format d'email invalide.</p>}
            </div>

            <label className="flex items-center gap-2 font-registre text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={mailingOptOut}
                onChange={(e) => setMailingOptOut(e.target.checked)}
                className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
              />
              Ne pas contacter par email (campagnes mailing)
            </label>

            <div className="space-y-1.5">
              <Label>Listes de diffusion</Label>
              <TagsInput tags={tags} onChange={setTags} availableTags={availableTags} />
            </div>

            {!isEdit && (
              <>
                <div className="border-t border-paper-border pt-4">
                  <p className="mb-3 font-registre text-sm font-medium text-ink-muted">Première adhésion</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="am-date-adhesion">
                    Date d'adhésion <span className="text-stamp">*</span>
                  </Label>
                  <Input
                    id="am-date-adhesion"
                    type="date"
                    required
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="am-cotisation">Cotisation</Label>
                    <Input
                      id="am-cotisation"
                      type="number"
                      step="0.01"
                      min="0"
                      value={montantCotisation}
                      onChange={(e) => setMontantCotisation(e.target.value)}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="am-mode-paiement">Mode de paiement</Label>
                    <Select
                      id="am-mode-paiement"
                      value={modePaiement}
                      onChange={(e) => setModePaiement(e.target.value ? (Number(e.target.value) as ModePaiement) : '')}
                      className="w-full"
                    >
                      <option value="">Non renseigné</option>
                      {MODE_PAIEMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="am-date-paiement">Date de paiement</Label>
                  <Input
                    id="am-date-paiement"
                    type="date"
                    value={datePaiementCotisation}
                    onChange={(e) => setDatePaiementCotisation(e.target.value)}
                  />
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 font-registre text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={droitVoteAg}
                      onChange={(e) => setDroitVoteAg(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    Droit de vote AG
                  </label>
                  <label className="flex items-center gap-2 font-registre text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={bulletinSigne}
                      onChange={(e) => setBulletinSigne(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    Bulletin signé
                  </label>
                </div>
              </>
            )}

            {isEdit && adherent && (
              <div className="border-t border-paper-border pt-4">
                <AdherentHistoriqueSection organisationId={organisationId} adherentId={adherent.id} />
              </div>
            )}
          </div>

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
  )
}
