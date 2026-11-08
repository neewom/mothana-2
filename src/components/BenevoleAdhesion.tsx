import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChampsAdhesion, { ConsentementsAdhesion } from './ChampsAdhesion'
import SignaturePad from './SignaturePad'
import { CHAMPS_ADHESION_VIDES, champsAdhesionPayload, type ChampsAdhesionValeurs } from '../lib/champsAdhesion'
import { erreurSaisieAdhesionBenevole, messageErreurAdhesionBenevole } from '../lib/adhesionBenevole'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import type { ModePaiement } from '../types'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { StatusNotice } from './ui/status-notice'

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface ResultatCreation {
  id_externe: string
  date_fin: string | null
  doublon: boolean
}

interface BenevoleAdhesionProps {
  organisationId: string
  statutsUrl: string | null
}

/** Onglet « Nouvel adhérent » de l'espace bénévole : adhérent + première adhésion, sans ratification. */
export default function BenevoleAdhesion({ organisationId, statutsUrl }: BenevoleAdhesionProps) {
  const [valeurs, setValeurs] = useState<ChampsAdhesionValeurs>(CHAMPS_ADHESION_VIDES)
  const [accepteStatuts, setAccepteStatuts] = useState(false)
  const [consentRgpd, setConsentRgpd] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [signeSurPapier, setSigneSurPapier] = useState(false)
  // Remonte la zone de signature (canvas vidé) à chaque nouvelle saisie.
  const [signatureKey, setSignatureKey] = useState(0)
  const [dateDebut, setDateDebut] = useState(todayISO())
  const [montant, setMontant] = useState('')
  const [modePaiement, setModePaiement] = useState<ModePaiement | null>(null)

  const [doublon, setDoublon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultat, setResultat] = useState<ResultatCreation | null>(null)

  const { nom, prenom, courriel } = valeurs

  // Avertissement d'homonyme / même email, non bloquant : la RPC ne renvoie qu'un booléen.
  useEffect(() => {
    if (nom.trim().length < 2 && courriel.trim() === '') {
      setDoublon(false)
      return
    }
    let annule = false
    const timeout = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('verifier_doublon_adhesion_benevole', {
        p_organisation_id: organisationId,
        p_nom: nom,
        p_prenom: prenom,
        p_courriel: courriel || null,
      })
      if (!annule && !err) setDoublon(data === true)
    }, 400)
    return () => {
      annule = true
      clearTimeout(timeout)
    }
  }, [organisationId, nom, prenom, courriel])

  function resetForm() {
    setValeurs(CHAMPS_ADHESION_VIDES)
    setAccepteStatuts(false)
    setConsentRgpd(false)
    setSignature(null)
    setSigneSurPapier(false)
    setSignatureKey((k) => k + 1)
    setDateDebut(todayISO())
    setMontant('')
    setModePaiement(null)
    setDoublon(false)
    setError(null)
    setResultat(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const erreur = erreurSaisieAdhesionBenevole({
      valeurs,
      statutsRequis: Boolean(statutsUrl),
      accepteStatuts,
      consentRgpd,
      signature,
      signeSurPapier,
      dateDebut,
      montant,
    })
    if (erreur) {
      setError(erreur)
      return
    }

    setSaving(true)
    const { data, error: err } = await supabase.rpc('creer_adhesion_benevole', {
      p_organisation_id: organisationId,
      p_adherent: champsAdhesionPayload(valeurs),
      p_accepte_statuts: statutsUrl ? accepteStatuts : true,
      p_consent_rgpd: consentRgpd,
      p_signature_data_url: signeSurPapier ? null : signature,
      p_signe_sur_papier: signeSurPapier,
      p_date_debut: dateDebut,
      p_montant_cotisation: montant.trim() === '' ? null : Number(montant),
      p_mode_paiement: modePaiement,
    })
    setSaving(false)
    if (err || !data) {
      setError(messageErreurAdhesionBenevole(err?.message))
      return
    }
    resetForm()
    setResultat(data as ResultatCreation)
  }

  if (resultat) {
    return (
      <div className="rounded-sm border border-success-border bg-success-tint p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-success">Adhérent créé</h2>
        <p className="mt-1 text-sm text-success">
          N° <span className="font-registre-mono font-medium">{resultat.id_externe}</span>
          {resultat.date_fin && (
            <>, adhésion jusqu'au <span className="font-medium">{formatDate(resultat.date_fin)}</span></>
          )}
          .
        </p>
        {resultat.doublon && (
          <StatusNotice tone="warning" className="mt-6 text-left">
            Un adhérent portait déjà ce nom ou cet email : signalez-le à un responsable pour vérification.
          </StatusNotice>
        )}
        <Button variant="success" onClick={resetForm} className="mt-6">
          Saisir un nouvel adhérent
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Nouvel adhérent</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Saisissez l'adhésion en présence de l'adhérent ou à partir de son bulletin papier.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-sm border border-paper-border bg-white p-6">
        {error && (
          <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            {error}
          </div>
        )}

        <ChampsAdhesion valeurs={valeurs} onChange={(patch) => setValeurs((v) => ({ ...v, ...patch }))} />

        {doublon && (
          <StatusNotice tone="warning">
            Un adhérent porte déjà ce nom ou cet email : vérifiez auprès d'un responsable avant de créer une nouvelle fiche.
          </StatusNotice>
        )}

        <div className="space-y-4 border-t border-paper-border pt-4">
          <div>
            <Label htmlFor="date-adhesion">
              Date d'adhésion <span className="text-stamp">*</span>
            </Label>
            <Input
              id="date-adhesion"
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="montant-cotisation">Montant de la cotisation (€)</Label>
            <Input
              id="montant-cotisation"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Facultatif"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Mode de paiement</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {MODE_PAIEMENT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={modePaiement === o.value}
                  onClick={() => setModePaiement(modePaiement === o.value ? null : o.value)}
                  className={cn(
                    'rounded-sm border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
                    modePaiement === o.value
                      ? 'border-stamp bg-stamp text-white'
                      : 'border-paper-border bg-white text-ink-muted hover:bg-paper'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">Facultatif — touchez à nouveau pour désélectionner.</p>
          </div>
        </div>

        <ConsentementsAdhesion
          statutsUrl={statutsUrl}
          accepteStatuts={accepteStatuts}
          consentRgpd={consentRgpd}
          onAccepteStatutsChange={setAccepteStatuts}
          onConsentRgpdChange={setConsentRgpd}
          objet="mon adhésion"
        />

        <div>
          <Label>
            Signature de l'adhérent <span className="text-stamp">*</span>
          </Label>
          {!signeSurPapier && (
            <div className="mt-1">
              <SignaturePad key={signatureKey} onChange={setSignature} />
            </div>
          )}
          <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={signeSurPapier}
              onChange={(e) => {
                setSigneSurPapier(e.target.checked)
                setSignature(null)
                setSignatureKey((k) => k + 1)
              }}
              className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
            />
            <span>Adhésion signée sur papier (le bulletin signé est conservé par l'association)</span>
          </label>
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Enregistrement…' : "Enregistrer l'adhésion"}
        </Button>
      </form>
    </>
  )
}
