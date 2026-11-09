import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import CarteAdherentSection from '../components/CarteAdherentSection'
import FormulaireAdhesionEditorModal from '../components/FormulaireAdhesionEditorModal'
import { slugifyUrl } from '../lib/organisationAssets'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import SaveBar from '../components/parametres/SaveBar'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { Select } from '../components/ui/select'
import { StatusNotice } from '../components/ui/status-notice'
import LectureSeuleNotice from '../components/parametres/LectureSeuleNotice'
import { usePeutModifierParametres } from '../hooks/usePeutModifierParametres'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { MOIS } from '../lib/journalModifications'
import type { RegleFinAdhesion } from '../lib/adhesion'
import { storageUploadErrorMessage, type StorageUploadResult } from '../lib/storageUpload'

const MAX_STATUTS_SIZE = 2 * 1024 * 1024

// Réutilise le bucket public organisation-assets (déjà scopé par organisation_id,
// pas de confidentialité à préserver pour un document destiné à être consulté publiquement).
async function uploadStatutsFile(organisationId: string, file: File): Promise<StorageUploadResult> {
  const path = `${organisationId}/statuts-${Date.now()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('organisation-assets')
    .upload(path, file, { contentType: 'application/pdf' })

  if (uploadError) return { url: null, error: storageUploadErrorMessage(uploadError, 'PDF') }

  const { data } = supabase.storage.from('organisation-assets').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

interface OrgSettings {
  slug: string
  statuts_url: string | null
  formulaire_adhesion_header_html: string | null
  formulaire_adhesion_footer_html: string | null
  formulaire_adhesion_css: string | null
  notif_demandes_adhesion: boolean
  saisie_adhesion_benevole: boolean
  adhesion_regle_fin: RegleFinAdhesion
  adhesion_mois_bascule: number
}

interface ApercuRecalage {
  total: number
  a_modifier: number
}

export default function ParametresAdhesionsPage() {
  const organisationId = useOrganisationId()
  const peutModifier = usePeutModifierParametres()

  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Renouvellement en ligne (slug public + statuts PDF)
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [statutsUrl, setStatutsUrl] = useState<string | null>(null)
  const [statutsUploading, setStatutsUploading] = useState(false)
  const [statutsError, setStatutsError] = useState<string | null>(null)
  const [formulaireHeaderHtml, setFormulaireHeaderHtml] = useState<string | null>(null)
  const [formulaireFooterHtml, setFormulaireFooterHtml] = useState<string | null>(null)
  const [formulaireCss, setFormulaireCss] = useState<string | null>(null)
  const [formulaireEditorOpen, setFormulaireEditorOpen] = useState(false)
  const [notifDemandes, setNotifDemandes] = useState(true)
  const [saisieBenevole, setSaisieBenevole] = useState(false)
  const [regleFin, setRegleFin] = useState<RegleFinAdhesion>('glissante')
  const [moisBascule, setMoisBascule] = useState(12)
  // Après un changement de règle : proposer de recalculer les adhésions existantes.
  const [apercuRecalage, setApercuRecalage] = useState<ApercuRecalage | null>(null)
  const [recalageEnCours, setRecalageEnCours] = useState(false)
  const [recalageMessage, setRecalageMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  // Un seul enregistrement pour les réglages du formulaire ; les statuts
  // (envoi de fichier) et l'éditeur d'en-tête restent des actions immédiates.
  const regleModifiee = settings !== null
    && (regleFin !== settings.adhesion_regle_fin || (regleFin === 'annee_civile' && moisBascule !== settings.adhesion_mois_bascule))
  const dirty = settings !== null && (slug !== settings.slug || regleModifiee || notifDemandes !== settings.notif_demandes_adhesion || saisieBenevole !== settings.saisie_adhesion_benevole)
  const guardDialog = useUnsavedChangesGuard(dirty)

  useEffect(() => {
    if (!organisationId) return

    async function fetchSettings() {
      setLoading(true)
      setFetchError(null)

      const { data, error } = await supabase
        .from('organisations')
        .select(
          'slug, statuts_url, formulaire_adhesion_header_html, formulaire_adhesion_footer_html, formulaire_adhesion_css, notif_demandes_adhesion, saisie_adhesion_benevole, adhesion_regle_fin, adhesion_mois_bascule',
        )
        .eq('id', organisationId)
        .single()

      if (error || !data) {
        setFetchError(error?.message ?? 'Erreur de chargement')
        setLoading(false)
        return
      }

      const raw = data as OrgSettings

      setSettings(raw)
      setSlug(raw.slug)
      setStatutsUrl(raw.statuts_url)
      setFormulaireHeaderHtml(raw.formulaire_adhesion_header_html)
      setFormulaireFooterHtml(raw.formulaire_adhesion_footer_html)
      setFormulaireCss(raw.formulaire_adhesion_css)
      setNotifDemandes(raw.notif_demandes_adhesion)
      setSaisieBenevole(raw.saisie_adhesion_benevole)
      setRegleFin(raw.adhesion_regle_fin)
      setMoisBascule(raw.adhesion_mois_bascule)
      setLoading(false)
    }

    fetchSettings()
  }, [organisationId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!dirty) return
    const normalized = slugifyUrl(slug)
    if (!normalized) {
      setSaveError('Identifiant public invalide')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({
        slug: normalized,
        notif_demandes_adhesion: notifDemandes,
        saisie_adhesion_benevole: saisieBenevole,
        adhesion_regle_fin: regleFin,
        adhesion_mois_bascule: moisBascule,
      })
      .eq('id', organisationId)

    if (error) {
      setSaveError(error.code === '23505' ? 'Cet identifiant est déjà utilisé par une autre organisation' : error.message)
    } else {
      setSlug(normalized)
      setSettings((current) => (current
        ? { ...current, slug: normalized, notif_demandes_adhesion: notifDemandes, saisie_adhesion_benevole: saisieBenevole, adhesion_regle_fin: regleFin, adhesion_mois_bascule: moisBascule }
        : current))
      setSaveSuccess(true)
      setRecalageMessage(null)
      // La nouvelle règle vaut pour les adhésions à venir ; les existantes ne changent que si
      // l'admin le confirme (aperçu calculé avec la règle qui vient d'être enregistrée).
      if (regleModifiee) {
        const { data } = await supabase.rpc('apercu_recalage_adhesions', { p_organisation_id: organisationId })
        const apercu = data as ApercuRecalage | null
        if (apercu && apercu.a_modifier > 0) setApercuRecalage(apercu)
      }
    }
    setSaving(false)
  }

  async function handleRecalage() {
    setRecalageEnCours(true)
    const { data, error } = await supabase.rpc('recalculer_dates_fin_adhesions', { p_organisation_id: organisationId })
    setRecalageEnCours(false)
    setApercuRecalage(null)
    if (error) {
      setRecalageMessage({ tone: 'danger', text: `Le recalcul a échoué : ${error.message}` })
      return
    }
    const n = Number(data ?? 0)
    setRecalageMessage({ tone: 'success', text: `${n} date${n > 1 ? 's' : ''} de fin recalculée${n > 1 ? 's' : ''}.` })
  }

  async function handleUploadStatuts(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setStatutsError('Format non supporté (PDF uniquement)')
      return
    }
    if (file.size > MAX_STATUTS_SIZE) {
      setStatutsError('Fichier trop volumineux (2 Mo max)')
      return
    }

    setStatutsError(null)
    setStatutsUploading(true)

    const { url, error: uploadError } = await uploadStatutsFile(organisationId, file)
    if (!url) {
      setStatutsError(uploadError)
      setStatutsUploading(false)
      return
    }

    const { error } = await supabase
      .from('organisations')
      .update({ statuts_url: url })
      .eq('id', organisationId)

    if (error) {
      setStatutsError(error.message)
    } else {
      setStatutsUrl(url)
    }
    setStatutsUploading(false)
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
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Paramètres des adhérents</h1>
        <p className="mt-1 text-sm text-ink-muted">Réglages du module Adhérents : carte adhérent, durée des adhésions, saisie par les bénévoles et renouvellement en ligne.</p>
      </div>

      {!peutModifier && <LectureSeuleNotice />}

      <ParametresSection
        title="Carte adhérent"
        description="Gérez le gabarit HTML utilisé pour imprimer les cartes adhérent (planche A4)."
      >
        {organisationId && <CarteAdherentSection organisationId={organisationId} lectureSeule={!peutModifier} />}
      </ParametresSection>

      <form onSubmit={handleSave} className="space-y-6">
      <ParametresSection
        title="Durée des adhésions"
        description="Règle de calcul de la date de fin, appliquée à chaque nouvelle adhésion ou renouvellement (saisie, demande validée, import)."
      >
        {/* Contributeur : réglages désactivés (la base refuse aussi l'écriture). */}
        <fieldset disabled={!peutModifier} className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adhesion-regle-fin">Fin de l'adhésion</Label>
            <Select
              id="adhesion-regle-fin"
              className="w-full"
              value={regleFin}
              onChange={(e) => { setRegleFin(e.target.value as RegleFinAdhesion); setSaveSuccess(false) }}
            >
              <option value="glissante">Un an après la date d'adhésion</option>
              <option value="annee_civile">Au 31 décembre</option>
            </Select>
          </div>
          {regleFin === 'annee_civile' && (
            <div className="space-y-1.5">
              <Label htmlFor="adhesion-mois-bascule">À partir du mois de</Label>
              <Select
                id="adhesion-mois-bascule"
                className="w-full"
                value={String(moisBascule)}
                onChange={(e) => { setMoisBascule(Number(e.target.value)); setSaveSuccess(false) }}
              >
                {MOIS.map((mois, i) => (
                  <option key={mois} value={i + 1}>{mois}</option>
                ))}
              </Select>
              <p className="text-xs text-ink-faint">
                Une adhésion prise à partir de ce mois vaut aussi l'année suivante (fin au 31 décembre de l'année suivante).
              </p>
            </div>
          )}
          {recalageMessage && <StatusNotice tone={recalageMessage.tone}>{recalageMessage.text}</StatusNotice>}
        </fieldset>
      </ParametresSection>

      <ParametresSection
        title="Saisie par les bénévoles"
        description="Autorise l'espace bénévole à créer un adhérent et sa première adhésion, sans ratification. Le code PIN bénévole étant partagé, le réglage vaut pour tous les bénévoles."
      >
        <fieldset disabled={!peutModifier} className="max-w-lg">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={saisieBenevole}
              onChange={(e) => { setSaisieBenevole(e.target.checked); setSaveSuccess(false) }}
              className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
            />
            Les bénévoles peuvent saisir de nouvelles adhésions (onglet « Nouvel adhérent »)
          </label>
          <p className="mt-1 text-xs text-ink-faint">
            L'adhérent signe à l'écran ou sur un bulletin papier. Chaque saisie est inscrite au journal ; les bénévoles ne voient pas la liste des adhérents.
          </p>
        </fieldset>
      </ParametresSection>

      <ParametresSection
        title="Renouvellement en ligne"
        description="Page publique où un adhérent renouvelle son adhésion depuis le lien personnel reçu par email ; la demande est ensuite à valider dans Demandes d'adhésion."
      >
        <div className="max-w-lg space-y-4">
          <div>
            <Label htmlFor="adhesion-slug">Identifiant public (liens de renouvellement)</Label>
            <Input
              id="adhesion-slug"
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSaveSuccess(false) }}
              placeholder="ex : mon-association"
              className="mt-1"
              disabled={!peutModifier}
            />
            <p className="mt-1 text-xs text-ink-faint">
              Lettres minuscules, chiffres et tirets uniquement. Il figure dans l'adresse des liens de renouvellement : le modifier rend inutilisables les liens déjà envoyés.
            </p>
          </div>
        </div>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-ink-muted">Statuts de l'association</p>
          <p className="mb-3 text-xs text-ink-faint">
            PDF proposé à la lecture sur la page de renouvellement et dans l'espace bénévole, pour que l'adhérent puisse en prendre connaissance avant de signer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {statutsUrl && (
              <a
                href={statutsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center rounded-sm border border-paper-border bg-white px-3 font-registre text-xs font-medium text-ink-muted hover:bg-paper"
              >
                Voir le PDF actuel
              </a>
            )}
            {peutModifier && <label className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-paper-border bg-white px-3 font-registre text-xs font-medium text-ink-muted hover:bg-paper">
              {statutsUploading ? 'Envoi…' : statutsUrl ? 'Remplacer' : 'Choisir un fichier'}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={statutsUploading}
                onChange={(e) => {
                  handleUploadStatuts(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>}
          </div>
          {statutsError && <p className="mt-1.5 text-xs text-stamp">{statutsError}</p>}
        </div>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-ink-muted">En-tête et pied de page</p>
          <p className="mb-3 text-xs text-ink-faint">
            Affichés sur la page de renouvellement, dont le formulaire central reste inchangé. Personnalisez-les avec vos assets (logo, bannière…) via l'éditeur.
          </p>
          <div className="flex items-center gap-3">
            {peutModifier && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setFormulaireEditorOpen(true)}>
                {formulaireHeaderHtml || formulaireFooterHtml ? 'Modifier' : 'Personnaliser'}
              </Button>
            )}
            {(formulaireHeaderHtml || formulaireFooterHtml) && (
              <span className="text-xs text-success">Personnalisé</span>
            )}
          </div>
        </div>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-ink-muted">Notification de l'équipe</p>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={notifDemandes}
              onChange={(e) => { setNotifDemandes(e.target.checked); setSaveSuccess(false) }}
              className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
            />
            Prévenir l'équipe par email à chaque nouvelle demande de renouvellement
          </label>
          <p className="mt-1 text-xs text-ink-faint">
            Chaque compte peut aussi couper cet email pour lui-même (Mon compte), ou un administrateur pour un compte (Équipe).
          </p>
        </div>

      </ParametresSection>

      {peutModifier && <SaveBar
        dirty={dirty}
        saving={saving}
        success={saveSuccess}
        error={saveError}
        onReset={() => {
          if (settings) setSlug(settings.slug)
          if (settings) {
            setNotifDemandes(settings.notif_demandes_adhesion)
            setSaisieBenevole(settings.saisie_adhesion_benevole)
            setRegleFin(settings.adhesion_regle_fin)
            setMoisBascule(settings.adhesion_mois_bascule)
          }
          setSaveError(null)
        }}
      />}
      </form>

      {organisationId && (
        <FormulaireAdhesionEditorModal
          open={formulaireEditorOpen}
          onClose={() => setFormulaireEditorOpen(false)}
          onSaved={async () => {
            const { data } = await supabase
              .from('organisations')
              .select('formulaire_adhesion_header_html, formulaire_adhesion_footer_html, formulaire_adhesion_css')
              .eq('id', organisationId)
              .single()
            if (data) {
              setFormulaireHeaderHtml(data.formulaire_adhesion_header_html)
              setFormulaireFooterHtml(data.formulaire_adhesion_footer_html)
              setFormulaireCss(data.formulaire_adhesion_css)
            }
          }}
          organisationId={organisationId}
          headerHtml={formulaireHeaderHtml}
          footerHtml={formulaireFooterHtml}
          css={formulaireCss}
        />
      )}
      <Dialog open={apercuRecalage !== null} onOpenChange={(next) => { if (!next && !recalageEnCours) setApercuRecalage(null) }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader className="shrink-0 pr-12">
            <DialogTitle>Recalculer les adhésions existantes ?</DialogTitle>
          </DialogHeader>
          {apercuRecalage && (
            <div className="space-y-3 p-6 text-sm text-ink-muted">
              <p>
                La nouvelle règle s'applique aux prochaines adhésions. Voulez-vous aussi recalculer la date de fin
                des <span className="font-medium text-ink">{apercuRecalage.total} adhésion{apercuRecalage.total > 1 ? 's' : ''} existante{apercuRecalage.total > 1 ? 's' : ''}</span> ?
              </p>
              <p>
                {apercuRecalage.a_modifier} date{apercuRecalage.a_modifier > 1 ? 's' : ''} de fin changer{apercuRecalage.a_modifier > 1 ? 'ont' : 'a'},
                ce qui peut faire passer des adhérents de « à jour » à « expiré » ou l'inverse. L'opération est inscrite au journal.
              </p>
            </div>
          )}
          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" disabled={recalageEnCours} onClick={() => setApercuRecalage(null)}>
              Ne pas recalculer
            </Button>
            <Button type="button" disabled={recalageEnCours} onClick={() => void handleRecalage()}>
              {recalageEnCours ? 'Recalcul…' : 'Recalculer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {guardDialog}
    </div>
  )
}
