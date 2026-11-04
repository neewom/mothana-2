import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import EmailRecuSection from '../components/EmailRecuSection'
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
import { chargerEtatConfigBrevo, type EtatConfigBrevo } from '../lib/brevoConfig'
import { DEFAULT_MODELE } from '../lib/modeleRecu'
import { RYTHME_ENVOI_BORNES, rythmeEnvoi } from '../lib/recusLot'
import { exempleNumeroRecu, formatNumeroRecu } from '../lib/numeroRecu'
import { supabase } from '../lib/supabaseClient'
import { cn } from '../lib/utils'
import type { FormatNumeroRecu, ModeleRecu } from '../types'
import {
  EMAIL_RECU_MESSAGE_DEFAUT,
  EMAIL_RECU_OBJET_DEFAUT,
  messageEffectif,
  messageEstVide,
  objetEffectif,
} from '../../supabase/functions/_shared/recuEmail.ts'

// Paramètres › Reçus fiscaux : ce qui reste purement fiscal de l'ancienne page Fiscalité
// (mention légale, taux, numérotation), l'email d'envoi des reçus et les modèles de reçus. L'identité de l'association
// (adresse, RNA, SIREN, objet social) est dans Paramètres › Organisation.

interface RecusForm {
  mentionLegale: string
  formatNumeroRecu: FormatNumeroRecu
  numeroRecuDepart: number
  tauxReduction: number
  emailObjet: string
  emailHtml: string
  // Saisis en texte (validation live, pas de contrainte native bloquante)
  envoiParJour: string
  envoiParMinute: string
}

function toForm(modele: ModeleRecu): RecusForm {
  return {
    mentionLegale: modele.mention_legale,
    formatNumeroRecu: formatNumeroRecu(modele.format_numero_recu),
    numeroRecuDepart: modele.numero_recu_depart,
    tauxReduction: modele.taux_reduction,
    emailObjet: objetEffectif(modele.email_objet),
    emailHtml: messageEffectif(modele.email_html),
    envoiParJour: String(rythmeEnvoi(modele).parJour),
    envoiParMinute: String(rythmeEnvoi(modele).parMinute),
  }
}

/** Entier dans les bornes, sinon null (message d'erreur affiché, enregistrement bloqué). */
function entierBorne(valeur: string, bornes: { min: number; max: number }): number | null {
  if (!/^\d+$/.test(valeur.trim())) return null
  const n = Number(valeur.trim())
  return n >= bornes.min && n <= bornes.max ? n : null
}

// Modèle identique au défaut (ou vidé) : rien de stocké, l'Edge Function applique le défaut.
function objetAStocker(objet: string): string | null {
  const t = objet.trim()
  return t === '' || t === EMAIL_RECU_OBJET_DEFAUT ? null : t
}

function messageAStocker(html: string): string | null {
  return messageEstVide(html) || html === EMAIL_RECU_MESSAGE_DEFAUT ? null : html
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
  const [organisationNom, setOrganisationNom] = useState('')
  const [etatBrevo, setEtatBrevo] = useState<EtatConfigBrevo | null>(null)

  const anneeExemple = new Date().getFullYear()
  const dirty = saved !== null && form !== null && JSON.stringify(saved) !== JSON.stringify(form)
  const parJour = form ? entierBorne(form.envoiParJour, RYTHME_ENVOI_BORNES.parJour) : null
  const parMinute = form ? entierBorne(form.envoiParMinute, RYTHME_ENVOI_BORNES.parMinute) : null
  const guardDialog = useUnsavedChangesGuard(dirty)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function load() {
      const { data, error: loadError } = await supabase
        .from('organisations')
        .select('nom, modele_recu_pdf')
        .eq('id', organisationId)
        .single()
      if (cancelled) return
      if (loadError || !data) {
        setFetchError(loadError?.message ?? 'Erreur de chargement')
        return
      }
      const row = data as { nom: string; modele_recu_pdf: Partial<ModeleRecu> | null }
      const modele = { ...DEFAULT_MODELE, ...(row.modele_recu_pdf ?? {}) }
      setOrganisationNom(row.nom)
      setSaved(toForm(modele))
      setForm(toForm(modele))
    }

    // Canal d'envoi des reçus (avertissement « les reçus partent depuis Samakan ») : non bloquant.
    void chargerEtatConfigBrevo(organisationId).then((etat) => {
      if (!cancelled) setEtatBrevo(etat)
    })

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
    if (parJour === null || parMinute === null) {
      setError("Corrigez le rythme d'envoi en lot avant d'enregistrer.")
      return
    }
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
      email_objet: objetAStocker(form.emailObjet),
      email_html: messageAStocker(form.emailHtml),
      envoi_lot_par_jour: parJour,
      envoi_lot_par_minute: parMinute,
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
          <p className="mt-1 text-sm text-ink-muted">Mention légale, taux, numérotation, email d'envoi et modèles des reçus remis à vos donateurs.</p>
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

          <ParametresSection
            title="Email d'envoi des reçus"
            description="Objet et message de l'email qui accompagne chaque reçu envoyé à un donateur."
          >
            <EmailRecuSection
              objet={form.emailObjet}
              html={form.emailHtml}
              organisationNom={organisationNom}
              etatBrevo={etatBrevo}
              lectureSeule={!peutModifier}
              onObjetChange={(objet) => update('emailObjet', objet)}
              onHtmlChange={(html) => update('emailHtml', html)}
              onHtmlNormalise={(html) => {
                setSaved((current) => (current ? { ...current, emailHtml: html } : current))
                setForm((current) => (current ? { ...current, emailHtml: html } : current))
              }}
            />
          </ParametresSection>

          <ParametresSection
            title="Envoi en lot"
            description="Rythme de « Envoyer les reçus non envoyés » : l'envoi s'étale sur plusieurs jours si besoin, sans dépasser ce quota."
          >
            <div className="max-w-lg space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Label htmlFor="envoi-lot-par-jour">Emails par jour au plus</Label>
                  <Input
                    id="envoi-lot-par-jour"
                    inputMode="numeric"
                    value={form.envoiParJour}
                    onChange={(e) => update('envoiParJour', e.target.value.replace(/[^\d]/g, ''))}
                    aria-invalid={parJour === null}
                    className={cn('mt-1', parJour === null && 'border-stamp focus-visible:ring-stamp/70')}
                  />
                  {parJour === null && (
                    <p className="mt-1 font-registre-mono text-[11px] text-stamp">
                      Entre {RYTHME_ENVOI_BORNES.parJour.min} et {RYTHME_ENVOI_BORNES.parJour.max.toLocaleString('fr-FR')}.
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="envoi-lot-par-minute">Emails par minute au plus</Label>
                  <Input
                    id="envoi-lot-par-minute"
                    inputMode="numeric"
                    value={form.envoiParMinute}
                    onChange={(e) => update('envoiParMinute', e.target.value.replace(/[^\d]/g, ''))}
                    aria-invalid={parMinute === null}
                    className={cn('mt-1', parMinute === null && 'border-stamp focus-visible:ring-stamp/70')}
                  />
                  {parMinute === null && (
                    <p className="mt-1 font-registre-mono text-[11px] text-stamp">
                      Entre {RYTHME_ENVOI_BORNES.parMinute.min} et {RYTHME_ENVOI_BORNES.parMinute.max}.
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-ink-faint">
                Réglez-le sur le quota de votre offre Brevo (offre gratuite : 300 emails par jour, tous envois confondus) en gardant
                une marge pour vos campagnes : le quota compte les reçus envoyés un par un et en lot, pas les campagnes. Par défaut :
                250 par jour, 5 par minute.
              </p>
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
