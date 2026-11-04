import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ParametresSection from '../components/ParametresSection'
import LectureSeuleNotice from '../components/parametres/LectureSeuleNotice'
import SaveBar from '../components/parametres/SaveBar'
import TemplatesRecuSection from '../components/TemplatesRecuSection'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { usePeutModifierParametres } from '../hooks/usePeutModifierParametres'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { DEFAULT_MODELE } from '../lib/modeleRecu'
import { exempleNumeroRecu, formatNumeroRecu } from '../lib/numeroRecu'
import { supabase } from '../lib/supabaseClient'
import type { FormatNumeroRecu, ModeleRecu } from '../types'

// Paramètres › Reçus fiscaux : ce qui reste purement fiscal de l'ancienne page Fiscalité
// (mention légale, taux, numérotation) et les modèles de reçus. L'identité de l'association
// (adresse, RNA, SIREN, objet social) est dans Paramètres › Organisation.

interface RecusForm {
  mentionLegale: string
  formatNumeroRecu: FormatNumeroRecu
  numeroRecuDepart: number
  tauxReduction: number
}

function toForm(modele: ModeleRecu): RecusForm {
  return {
    mentionLegale: modele.mention_legale,
    formatNumeroRecu: formatNumeroRecu(modele.format_numero_recu),
    numeroRecuDepart: modele.numero_recu_depart,
    tauxReduction: modele.taux_reduction,
  }
}

export default function ParametresRecusFiscauxPage() {
  const organisationId = useOrganisationId()
  const peutModifier = usePeutModifierParametres()
  const [saved, setSaved] = useState<RecusForm | null>(null)
  const [form, setForm] = useState<RecusForm | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anneeExemple = new Date().getFullYear()
  const dirty = saved !== null && form !== null && JSON.stringify(saved) !== JSON.stringify(form)
  const guardDialog = useUnsavedChangesGuard(dirty)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function load() {
      const { data, error: loadError } = await supabase
        .from('organisations')
        .select('modele_recu_pdf')
        .eq('id', organisationId)
        .single()
      if (cancelled) return
      if (loadError || !data) {
        setFetchError(loadError?.message ?? 'Erreur de chargement')
        return
      }
      const modele = { ...DEFAULT_MODELE, ...((data as { modele_recu_pdf: Partial<ModeleRecu> | null }).modele_recu_pdf ?? {}) }
      setSaved(toForm(modele))
      setForm(toForm(modele))
    }

    void load()
    return () => { cancelled = true }
  }, [organisationId])

  function update<K extends keyof RecusForm>(key: K, value: RecusForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
    setSuccess(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form || !dirty) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    // modele_recu_pdf est partagé avec Organisation : relu juste avant l'écriture.
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
      mention_legale: form.mentionLegale,
      format_numero_recu: form.formatNumeroRecu,
      numero_recu_depart: form.numeroRecuDepart,
      taux_reduction: form.tauxReduction,
    }

    const { error: saveError } = await supabase
      .from('organisations')
      .update({ modele_recu_pdf: modele })
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Reçus fiscaux</h1>
          <p className="mt-1 text-sm text-ink-muted">Mention légale, taux, numérotation et modèles des reçus remis à vos donateurs.</p>
        </div>

        {!peutModifier && <LectureSeuleNotice />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contributeur : champs désactivés d'un bloc (la base refuse aussi l'écriture). */}
          <fieldset disabled={!peutModifier} className="min-w-0 space-y-6">
          <ParametresSection
            title="Informations fiscales"
            description="Affichées sur chaque reçu. L'adresse, le RNA, le SIREN et l'objet social se règlent dans Organisation."
          >
            {/* Information, pas une action requise : encadré neutre (l'ambre est réservé aux actions à faire). */}
            <div className="mb-6 rounded-sm border border-paper-border bg-paper px-4 py-3 text-sm text-ink-muted">
              <p className="font-medium text-ink">Obligations légales</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>L'association doit conserver une copie de chaque reçu émis pendant 6 ans.</li>
                <li>Depuis le 1er janvier 2021, l'association doit déclarer annuellement le montant total des dons et le nombre de reçus émis (article 222 bis du CGI).</li>
                <li>Une association qui émet des reçus sans y être habilitée s'expose à une amende égale à 66% des sommes inscrites.</li>
              </ul>
              <p className="mt-2">
                Identité de l'association (adresse, RNA ou SIREN, objet social) :{' '}
                <Link to="/admin/parametres" className="font-medium text-stamp underline underline-offset-2">Paramètres › Organisation</Link>.
              </p>
            </div>

            <div className="max-w-lg space-y-4">
              <div>
                <Label htmlFor="modele-mention-legale">Mention légale</Label>
                <Textarea
                  id="modele-mention-legale"
                  rows={2}
                  value={form.mentionLegale}
                  onChange={(e) => update('mentionLegale', e.target.value)}
                  className="mt-1 resize-none"
                />
                <p className="mt-1 text-xs text-ink-faint">Affichée sur le reçu pour justifier l'éligibilité au mécénat.</p>
              </div>

              <div>
                <Label htmlFor="modele-format-numero-recu">Format du numéro de reçu</Label>
                <Select
                  id="modele-format-numero-recu"
                  value={form.formatNumeroRecu}
                  onChange={(e) => update('formatNumeroRecu', formatNumeroRecu(e.target.value))}
                  className="mt-1 w-full"
                >
                  <option value="sequence">Séquence annuelle</option>
                  <option value="donateur">Année + numéro de donateur</option>
                </Select>
                <p className="mt-1 text-xs text-ink-faint">
                  Exemple :{' '}
                  <span className="font-medium text-ink">
                    {exempleNumeroRecu(form.formatNumeroRecu, anneeExemple, { numeroDepart: form.numeroRecuDepart })}
                  </span>
                  {form.formatNumeroRecu === 'donateur'
                    ? ' pour le donateur n° 2803. Un donateur sans numéro de donateur ne peut pas recevoir de reçu.'
                    : ', puis la suite de la séquence, qui repart chaque 1er janvier.'}
                  {' '}Un reçu déjà émis garde son numéro.
                </p>
              </div>

              <div className="flex gap-3">
                {form.formatNumeroRecu === 'sequence' && (
                  <div className="flex-1">
                    <Label htmlFor="modele-numero-recu-depart">Numéro du premier reçu</Label>
                    <Input
                      id="modele-numero-recu-depart"
                      type="number"
                      min={1}
                      value={form.numeroRecuDepart}
                      onChange={(e) => update('numeroRecuDepart', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="modele-taux-reduction">Taux de réduction fiscale</Label>
                  <div className="relative mt-1">
                    <Input
                      id="modele-taux-reduction"
                      type="number"
                      min={0}
                      max={100}
                      value={form.tauxReduction}
                      onChange={(e) => update('tauxReduction', Number(e.target.value))}
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">%</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">66% standard, 75% pour certains organismes (ex : aide aux personnes en difficulté).</p>
                </div>
              </div>
            </div>
          </ParametresSection>

          </fieldset>

          {peutModifier && <SaveBar
            dirty={dirty}
            saving={saving}
            success={success}
            error={error}
            onReset={() => {
              setForm(saved)
              setError(null)
            }}
          />}
        </form>

        <ParametresSection
          title="Modèles de reçus fiscaux"
          description="Gérez les templates HTML utilisés pour générer les reçus 11580 (particuliers) et 16216 (entreprises). Enregistrés depuis leur éditeur."
        >
          {organisationId && <TemplatesRecuSection organisationId={organisationId} lectureSeule={!peutModifier} />}
        </ParametresSection>
      </div>
      {guardDialog}
    </div>
  )
}
