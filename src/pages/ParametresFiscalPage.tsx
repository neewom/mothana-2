import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import TemplatesRecuSection from '../components/TemplatesRecuSection'
import { DEFAULT_MODELE } from '../lib/modeleRecu'
import type { ModeleRecu } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'

interface OrgSettings {
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  modele_recu_pdf: ModeleRecu
}

export default function ParametresFiscalPage() {
  const organisationId = useOrganisationId()

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Informations fiscales (adresse organisation + modèle reçu) — modele_recu_pdf
  // est partagé avec Paramètres > Organisation, toujours relire/réécrire l'objet
  // complet (voir types/index.ts).
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [pays, setPays] = useState('France')
  const [modele, setModele] = useState<ModeleRecu>(DEFAULT_MODELE)
  const [modeleSaving, setModeleSaving] = useState(false)
  const [modeleSuccess, setModeleSuccess] = useState(false)
  const [modeleError, setModeleError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return

    async function fetchSettings() {
      setLoading(true)
      setFetchError(null)

      const { data, error } = await supabase
        .from('organisations')
        .select('adresse, code_postal, ville, pays, modele_recu_pdf')
        .eq('id', organisationId)
        .single()

      if (error || !data) {
        setFetchError(error?.message ?? 'Erreur de chargement')
        setLoading(false)
        return
      }

      const raw = data as OrgSettings
      const modeleRaw = (raw.modele_recu_pdf ?? {}) as Partial<ModeleRecu>

      setAdresse(raw.adresse ?? '')
      setCodePostal(raw.code_postal ?? '')
      setVille(raw.ville ?? '')
      setPays(raw.pays ?? 'France')
      setModele({ ...DEFAULT_MODELE, ...modeleRaw })
      setLoading(false)
    }

    fetchSettings()
  }, [organisationId])

  async function handleSaveModele(e: FormEvent) {
    e.preventDefault()
    setModeleSaving(true)
    setModeleError(null)
    setModeleSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({
        adresse: adresse || null,
        code_postal: codePostal || null,
        ville: ville || null,
        pays: pays || 'France',
        modele_recu_pdf: modele,
      })
      .eq('id', organisationId)

    if (error) {
      setModeleError(error.message)
    } else {
      setModeleSuccess(true)
      setTimeout(() => setModeleSuccess(false), 3000)
    }
    setModeleSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 font-registre text-sm text-ink-faint">
        Chargement…
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
        {fetchError}
      </div>
    )
  }

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Paramètres — Fiscalité</h1>
        <p className="mt-1 text-sm text-ink-muted">Informations fiscales et modèles de reçus utilisés pour vos donateurs.</p>
      </div>

      <ParametresSection
        title="Informations fiscales"
        description="Ces informations apparaissent sur les reçus fiscaux générés pour vos donateurs et sont requises pour être conforme."
      >
        <div className="mb-6 rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
          <p className="font-medium">⚠️ Obligations légales</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>L'association doit conserver une copie de chaque reçu émis pendant 6 ans.</li>
            <li>Depuis le 1er janvier 2021, l'association doit déclarer annuellement le montant total des dons et le nombre de reçus émis (article 222 bis du CGI).</li>
            <li>Une association qui émet des reçus sans y être habilitée s'expose à une amende égale à 66% des sommes inscrites.</li>
          </ul>
        </div>

        <form onSubmit={handleSaveModele} className="max-w-lg space-y-4">
          <div>
            <Label>Adresse de l'association</Label>
            <div className="mt-2 space-y-3">
              <Input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Ex : 12 rue des Lilas"
              />
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  placeholder="Code postal"
                  className="w-32"
                />
                <Input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Ville"
                  className="min-w-0 flex-1"
                />
              </div>
              <Input
                type="text"
                value={pays}
                onChange={(e) => setPays(e.target.value)}
                placeholder="Pays"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="modele-rna">Numéro RNA</Label>
              <Input
                id="modele-rna"
                type="text"
                value={modele.rna}
                onChange={(e) => setModele((m) => ({ ...m, rna: e.target.value }))}
                placeholder="Ex : W751234567"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="modele-siren">Numéro SIREN</Label>
              <Input
                id="modele-siren"
                type="text"
                value={modele.siren}
                onChange={(e) => setModele((m) => ({ ...m, siren: e.target.value }))}
                placeholder="Optionnel si RNA renseigné"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="modele-objet-social">Objet social</Label>
            <Textarea
              id="modele-objet-social"
              rows={2}
              value={modele.objet_social}
              onChange={(e) => setModele((m) => ({ ...m, objet_social: e.target.value }))}
              placeholder="Ex : association d'intérêt général à but non lucratif"
              className="mt-1 resize-none"
            />
          </div>

          <div>
            <Label htmlFor="modele-mention-legale">Mention légale</Label>
            <Textarea
              id="modele-mention-legale"
              rows={2}
              value={modele.mention_legale}
              onChange={(e) => setModele((m) => ({ ...m, mention_legale: e.target.value }))}
              className="mt-1 resize-none"
            />
            <p className="mt-1 text-xs text-ink-faint">Affichée sur le reçu pour justifier l'éligibilité au mécénat.</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="modele-numero-recu-depart">Numéro du premier reçu</Label>
              <Input
                id="modele-numero-recu-depart"
                type="number"
                min={1}
                value={modele.numero_recu_depart}
                onChange={(e) => setModele((m) => ({ ...m, numero_recu_depart: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="modele-taux-reduction">Taux de réduction fiscale</Label>
              <div className="relative mt-1">
                <Input
                  id="modele-taux-reduction"
                  type="number"
                  min={0}
                  max={100}
                  value={modele.taux_reduction}
                  onChange={(e) => setModele((m) => ({ ...m, taux_reduction: Number(e.target.value) }))}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">%</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">66% standard, 75% pour certains organismes (ex : aide aux personnes en difficulté).</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={modeleSaving}>
              {modeleSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {modeleSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Enregistré
              </span>
            )}
            {modeleError && <span className="text-sm text-stamp">{modeleError}</span>}
          </div>
        </form>
      </ParametresSection>

      <ParametresSection
        title="Modèles de reçus fiscaux"
        description="Gérez les templates HTML utilisés pour générer les reçus 11580 (particuliers) et 16216 (entreprises)."
      >
        {organisationId && <TemplatesRecuSection organisationId={organisationId} />}
      </ParametresSection>
    </div>
  )
}
