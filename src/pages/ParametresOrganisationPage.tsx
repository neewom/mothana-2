import { useEffect, useState, type FormEvent } from 'react'
import ParametresSection from '../components/ParametresSection'
import AssetsManager from '../components/parametres/AssetsManager'
import SaveBar from '../components/parametres/SaveBar'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { DEFAULT_MODELE } from '../lib/modeleRecu'
import { supabase } from '../lib/supabaseClient'
import type { ModeleRecu } from '../types'

// Paramètres › Organisation : identité (nom, adresse, RNA, SIREN, objet social), signataire et
// visuels. L'adresse vient de l'ancienne page Fiscalité, le signataire de l'ancienne « Identité
// visuelle ». Les champs purement fiscaux (mention, taux, numérotation) sont dans Reçus fiscaux.

interface OrganisationForm {
  nom: string
  adresse: string
  codePostal: string
  ville: string
  pays: string
  rna: string
  siren: string
  objetSocial: string
  presidentNom: string
  presidentTitre: string
}

interface OrganisationRow {
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  modele_recu_pdf: Partial<ModeleRecu> | null
}

function toForm(row: OrganisationRow): OrganisationForm {
  const modele = { ...DEFAULT_MODELE, ...(row.modele_recu_pdf ?? {}) }
  return {
    nom: row.nom,
    adresse: row.adresse ?? '',
    codePostal: row.code_postal ?? '',
    ville: row.ville ?? '',
    pays: row.pays ?? 'France',
    rna: modele.rna,
    siren: modele.siren,
    objetSocial: modele.objet_social,
    presidentNom: modele.president_nom,
    presidentTitre: modele.president_titre,
  }
}

export default function ParametresOrganisationPage() {
  const organisationId = useOrganisationId()
  const [saved, setSaved] = useState<OrganisationForm | null>(null)
  const [form, setForm] = useState<OrganisationForm | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = saved !== null && form !== null && JSON.stringify(saved) !== JSON.stringify(form)
  const guardDialog = useUnsavedChangesGuard(dirty)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function load() {
      const { data, error: loadError } = await supabase
        .from('organisations')
        .select('nom, adresse, code_postal, ville, pays, modele_recu_pdf')
        .eq('id', organisationId)
        .single()
      if (cancelled) return
      if (loadError || !data) {
        setFetchError(loadError?.message ?? 'Erreur de chargement')
        return
      }
      const initial = toForm(data as OrganisationRow)
      setSaved(initial)
      setForm(initial)
    }

    void load()
    return () => { cancelled = true }
  }, [organisationId])

  function update<K extends keyof OrganisationForm>(key: K, value: OrganisationForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
    setSuccess(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form || !dirty) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    // modele_recu_pdf est partagé avec Reçus fiscaux : relu juste avant l'écriture, seuls les
    // champs de cette page sont remplacés.
    const { data: current, error: readError } = await supabase
      .from('organisations')
      .select('modele_recu_pdf')
      .eq('id', organisationId)
      .single()
    if (readError) {
      setError('Les modifications n’ont pas pu être enregistrées. Réessayez.')
      setSaving(false)
      return
    }
    const modele: ModeleRecu = {
      ...DEFAULT_MODELE,
      ...((current as { modele_recu_pdf: Partial<ModeleRecu> | null }).modele_recu_pdf ?? {}),
      rna: form.rna,
      siren: form.siren,
      objet_social: form.objetSocial,
      president_nom: form.presidentNom,
      president_titre: form.presidentTitre,
    }

    const { error: saveError } = await supabase
      .from('organisations')
      .update({
        nom: form.nom,
        adresse: form.adresse || null,
        code_postal: form.codePostal || null,
        ville: form.ville || null,
        pays: form.pays || 'France',
        modele_recu_pdf: modele,
      })
      .eq('id', organisationId)

    if (saveError) {
      setError('Les modifications n’ont pas pu être enregistrées. Réessayez.')
    } else {
      setSaved(form)
      setSuccess(true)
    }
    setSaving(false)
  }

  if (fetchError) {
    return (
      <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{fetchError}</div>
    )
  }
  if (!form) {
    return <div className="flex items-center justify-center py-24 font-registre text-sm text-ink-faint">Chargement…</div>
  }

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] bg-paper p-6 font-registre">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Organisation</h1>
          <p className="mt-1 text-sm text-ink-muted">Identité de l’association, signataire et visuels utilisés sur les reçus et les cartes.</p>
        </div>

        <ParametresSection title="Identité" description="Nom, adresse et identifiants, affichés sur les reçus fiscaux.">
          <div className="max-w-lg space-y-4">
            <div>
              <Label htmlFor="org-nom">Nom de l'association <span className="text-stamp">*</span></Label>
              <Input id="org-nom" type="text" required value={form.nom} onChange={(e) => update('nom', e.target.value)} placeholder="Ex : Les Amis du Quartier" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="org-adresse">Adresse</Label>
              <div className="mt-1 space-y-3">
                <Input id="org-adresse" type="text" value={form.adresse} onChange={(e) => update('adresse', e.target.value)} placeholder="Ex : 12 rue des Lilas" />
                <div className="flex gap-3">
                  <Input type="text" aria-label="Code postal" value={form.codePostal} onChange={(e) => update('codePostal', e.target.value)} placeholder="Code postal" className="w-32" />
                  <Input type="text" aria-label="Ville" value={form.ville} onChange={(e) => update('ville', e.target.value)} placeholder="Ville" className="min-w-0 flex-1" />
                </div>
                <Input type="text" aria-label="Pays" value={form.pays} onChange={(e) => update('pays', e.target.value)} placeholder="Pays" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="org-rna">Numéro RNA</Label>
                <Input id="org-rna" type="text" value={form.rna} onChange={(e) => update('rna', e.target.value)} placeholder="Ex : W751234567" className="mt-1" />
              </div>
              <div className="flex-1">
                <Label htmlFor="org-siren">Numéro SIREN</Label>
                <Input id="org-siren" type="text" value={form.siren} onChange={(e) => update('siren', e.target.value)} placeholder="Optionnel si RNA renseigné" className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="org-objet-social">Objet social</Label>
              <Textarea id="org-objet-social" rows={2} value={form.objetSocial} onChange={(e) => update('objetSocial', e.target.value)} placeholder="Ex : association d'intérêt général à but non lucratif" className="mt-1 resize-none" />
            </div>
          </div>
        </ParametresSection>

        <ParametresSection title="Signataire" description="Nom et titre du président, utilisés sur les reçus et les cartes adhérent.">
          <div className="max-w-lg space-y-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="president-nom">Nom du président</Label>
                <Input id="president-nom" type="text" value={form.presidentNom} onChange={(e) => update('presidentNom', e.target.value)} placeholder="Ex : Jean Dupont" className="mt-1" />
              </div>
              <div className="flex-1">
                <Label htmlFor="president-titre">Titre</Label>
                <Input id="president-titre" type="text" value={form.presidentTitre} onChange={(e) => update('presidentTitre', e.target.value)} placeholder="Ex : Président" className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-ink-faint">
              Disponibles comme placeholders <code>{'{{president_nom}}'}</code> et <code>{'{{president_titre}}'}</code> dans vos modèles.
            </p>
          </div>
        </ParametresSection>

        <ParametresSection title="Visuels" description="Logo, tampon, signature : utilisés à la fois par les reçus fiscaux et par la carte adhérent.">
          <AssetsManager organisationId={organisationId} />
        </ParametresSection>

        <SaveBar
          dirty={dirty}
          saving={saving}
          success={success}
          error={error}
          onReset={() => {
            setForm(saved)
            setError(null)
          }}
        />
      </form>
      {guardDialog}
    </div>
  )
}
