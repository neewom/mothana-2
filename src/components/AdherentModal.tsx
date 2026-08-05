import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adherent, Adhesion, CiviliteAdherent, ModePaiement } from '../types'
import { CIVILITE_ADHERENT_OPTIONS } from '../lib/civiliteAdherent'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { generateUUID } from '../lib/uuid'
import { computeDateFin } from '../lib/adhesion'
import { toUpperName, toCapitalizedName, isValidEmail, sanitizePhoneInput } from '../lib/textFormat'
import Modal from './Modal'

interface IdentitePrefill {
  civilite: CiviliteAdherent
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  telephone: string | null
  courriel: string | null
}

interface AdherentModalProps {
  open: boolean
  onClose: () => void
  onSaved: (adherent: Adherent, adhesion?: Adhesion) => void
  adherent?: Adherent
  organisationId: string
  // Pré-remplit le formulaire de création à partir d'une demande d'adhésion en attente de ratification
  prefill?: IdentitePrefill
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function AdherentModal({ open, onClose, onSaved, adherent, organisationId, prefill }: AdherentModalProps) {
  const isEdit = !!adherent

  // Identité
  const [civilite, setCivilite] = useState<CiviliteAdherent>(0)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [telephone, setTelephone] = useState('')
  const [courriel, setCourriel] = useState('')

  // Premier cycle (création uniquement)
  const [dateDebut, setDateDebut] = useState(today())
  const [montantCotisation, setMontantCotisation] = useState('')
  const [modePaiement, setModePaiement] = useState<ModePaiement | ''>('')
  const [datePaiementCotisation, setDatePaiementCotisation] = useState('')
  const [droitVoteAg, setDroitVoteAg] = useState(true)
  const [bulletinSigne, setBulletinSigne] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courrielTouched, setCourrielTouched] = useState(false)

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
        setTelephone(adherent.telephone ?? '')
        setCourriel(adherent.courriel ?? '')
      } else {
        setCivilite(prefill?.civilite ?? 0)
        setNom(toUpperName(prefill?.nom ?? ''))
        setPrenom(toCapitalizedName(prefill?.prenom ?? ''))
        setDateNaissance(prefill?.date_naissance ?? '')
        setAdresse(prefill?.adresse ?? '')
        setCodePostal(prefill?.code_postal ?? '')
        setVille(prefill?.ville ?? '')
        setTelephone(prefill?.telephone ?? '')
        setCourriel(prefill?.courriel ?? '')
        setDateDebut(today())
        setMontantCotisation('')
        setModePaiement('')
        setDatePaiementCotisation('')
        setDroitVoteAg(true)
        setBulletinSigne(true)
      }
      setError(null)
      setCourrielTouched(false)
    }
  }, [open, adherent, prefill])

  const courrielInvalid = courrielTouched && courriel.trim() !== '' && !isValidEmail(courriel)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (courriel.trim() !== '' && !isValidEmail(courriel)) {
      setCourrielTouched(true)
      setError("Le format de l'adresse email est invalide.")
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
      telephone: telephone || null,
      courriel: courriel || null,
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
      return
    }

    const adherentId = generateUUID()
    const adhesionId = generateUUID()
    const dateFin = computeDateFin(dateDebut)

    const { error: adherentErr } = await supabase.from('adherents').insert({
      id: adherentId,
      organisation_id: organisationId,
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
    onSaved(
      {
        id: adherentId,
        organisation_id: organisationId,
        id_externe: null,
        statut: 'actif',
        statuts_acceptes: true,
        consent_rgpd: false,
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
    <Modal open={open} onClose={onClose} labelledBy="adherent-modal-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="adherent-modal-title" className="text-lg font-semibold text-slate-900">
          {isEdit ? "Modifier l'adhérent" : 'Ajouter un adhérent'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="space-y-4 overflow-y-auto p-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Civilité <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={civilite === 0 ? '' : civilite}
              onChange={(e) => setCivilite(e.target.value ? (Number(e.target.value) as CiviliteAdherent) : 0)}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Sélectionner…</option>
              {CIVILITE_ADHERENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(toUpperName(e.target.value))}
              placeholder="DUPONT"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={prenom}
              onChange={(e) => setPrenom(toCapitalizedName(e.target.value))}
              placeholder="Jean"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date de naissance <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Adresse <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="12 rue des Lilas"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Code postal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="75000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ville <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Paris"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={20}
              value={telephone}
              onChange={(e) => setTelephone(sanitizePhoneInput(e.target.value))}
              placeholder="06 00 00 00 00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Courriel</label>
            <input
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              onBlur={() => setCourrielTouched(true)}
              placeholder="jean.dupont@exemple.fr"
              aria-invalid={courrielInvalid}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                courrielInvalid
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-indigo-500'
              }`}
            />
            {courrielInvalid && <p className="mt-1 text-xs text-red-600">Format d'email invalide.</p>}
          </div>

          {!isEdit && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <p className="mb-3 text-sm font-medium text-slate-700">Première adhésion</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Date d'adhésion <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Cotisation</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montantCotisation}
                    onChange={(e) => setMontantCotisation(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mode de paiement</label>
                  <select
                    value={modePaiement}
                    onChange={(e) => setModePaiement(e.target.value ? (Number(e.target.value) as ModePaiement) : '')}
                    className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Non renseigné</option>
                    {MODE_PAIEMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date de paiement</label>
                <input
                  type="date"
                  value={datePaiementCotisation}
                  onChange={(e) => setDatePaiementCotisation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={droitVoteAg}
                    onChange={(e) => setDroitVoteAg(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Droit de vote AG
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={bulletinSigne}
                    onChange={(e) => setBulletinSigne(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Bulletin signé
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
