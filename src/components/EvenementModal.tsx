import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { filterUpcomingDatedActivites, findExactActivite } from '../lib/activiteSearch'
import { slugifyUrl } from '../lib/organisationAssets'
import type { Activite } from '../types'
import type { Evenement, EvenementStatut } from '../types/evenement'
import ActiviteAutocomplete from './ActiviteAutocomplete'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface EvenementModalProps {
  open: boolean
  onClose: () => void
  organisationId: string
  activites: Activite[]
  evenement: Evenement | null
  onSaved: (message: string) => void
}

const DEFAULT_AMOUNTS = ['5.00', '10.00', '20.00', '50.00']

function eurosToCentimes(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const centimes = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(centimes) && centimes > 0 ? centimes : null
}

function centimesToInput(value: number): string {
  return (value / 100).toFixed(2)
}

export default function EvenementModal({
  open,
  onClose,
  organisationId,
  activites,
  evenement,
  onSaved,
}: EvenementModalProps) {
  const isEdit = evenement !== null
  const [nom, setNom] = useState('')
  const [slug, setSlug] = useState('')
  const [dateEvenement, setDateEvenement] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [statut, setStatut] = useState<EvenementStatut>('brouillon')
  const [activiteId, setActiviteId] = useState('')
  const [montants, setMontants] = useState<string[]>(DEFAULT_AMOUNTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNom(evenement?.nom ?? '')
    setSlug(evenement?.slug ?? '')
    setDateEvenement(evenement?.date_evenement ?? '')
    setDateFin(evenement?.date_fin ?? '')
    setStatut(evenement?.statut ?? 'brouillon')
    setActiviteId(evenement?.activite_id ?? '')
    setMontants(evenement?.montants_credit_centimes.map(centimesToInput) ?? DEFAULT_AMOUNTS)
    setError(null)
    setSaving(false)
  }, [open, evenement])

  function updateMontant(index: number, value: string) {
    setMontants((current) => current.map((amount, i) => (i === index ? value : amount)))
  }

  function removeMontant(index: number) {
    setMontants((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const normalizedName = nom.trim()
    const normalizedSlug = slugifyUrl(isEdit ? slug : normalizedName)
    if (!normalizedName || !dateEvenement || !dateFin || !normalizedSlug) {
      setError('Renseignez le nom, les dates et un identifiant URL valide.')
      return
    }
    if (dateFin < dateEvenement) {
      setError('La date de fin doit être égale ou postérieure à la date de début.')
      return
    }

    const parsedAmounts = montants.map(eurosToCentimes)
    if (parsedAmounts.length === 0 || parsedAmounts.some((amount) => amount === null)) {
      setError('Ajoutez au moins un montant supérieur à 0, avec deux décimales maximum.')
      return
    }
    const uniqueAmounts = Array.from(new Set(parsedAmounts as number[]))

    setSaving(true)
    let linkedActiviteId = activiteId
    let createdActiviteId: string | null = null
    const todayIso = new Date().toLocaleDateString('en-CA')
    const suggestedActivites = filterUpcomingDatedActivites(activites, todayIso)

    if (!linkedActiviteId) {
      const exactActivite = findExactActivite(suggestedActivites, normalizedName)
      if (exactActivite) {
        linkedActiviteId = exactActivite.id
      } else {
        const { data: createdActivite, error: activiteError } = await supabase
          .from('activites')
          .insert({
            organisation_id: organisationId,
            nom: normalizedName,
            date_debut: dateEvenement,
            date_fin: dateFin,
          })
          .select('id')
          .single()

        if (activiteError || !createdActivite) {
          setError(activiteError?.message ?? 'L’activité associée n’a pas pu être créée.')
          setSaving(false)
          return
        }
        linkedActiviteId = createdActivite.id
        createdActiviteId = createdActivite.id
      }
    }

    const payload = {
      nom: normalizedName,
      slug: normalizedSlug,
      date_evenement: dateEvenement,
      date_fin: dateFin,
      statut,
      activite_id: linkedActiviteId,
      montants_credit_centimes: uniqueAmounts,
    }

    const { error: saveError } = isEdit
      ? await supabase.from('evenements').update(payload).eq('id', evenement.id)
      : await supabase.from('evenements').insert({ ...payload, organisation_id: organisationId })

    if (saveError) {
      if (createdActiviteId) {
        await supabase.from('activites').delete().eq('id', createdActiviteId)
      }
      setError(
        saveError.code === '23505'
          ? 'Cet identifiant URL est déjà utilisé par un autre événement de cette organisation.'
          : saveError.message,
      )
      setSaving(false)
      return
    }

    onSaved(isEdit ? 'Événement mis à jour.' : 'Événement créé.')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader className="pr-12">
          <DialogTitle>{isEdit ? 'Modifier l’événement' : 'Nouvel événement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error && (
              <p role="alert" className="rounded-sm border border-stamp/25 bg-stamp/[0.04] px-3 py-2 text-sm text-stamp">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="evenement-nom">Nom</Label>
              <ActiviteAutocomplete
                activites={filterUpcomingDatedActivites(activites, new Date().toLocaleDateString('en-CA'))}
                value={activiteId}
                onChange={setActiviteId}
                customValue={nom}
                onCustomValueChange={setNom}
                inputId="evenement-nom"
                allowCreate
                displayCustomValueWhenSelected
                placeholder="Ex : Nouvel An lao 2027"
                disabled={saving}
                required
              />
              <p className="font-registre-mono text-[11px] text-ink-faint">
                Une activité du même nom sera créée ou retrouvée automatiquement.
              </p>
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="evenement-slug">Identifiant URL</Label>
                <Input
                  id="evenement-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="nouvel-an-lao-2027"
                  required
                />
                <p className="font-registre-mono text-[11px] text-ink-faint">
                  Lettres minuscules, chiffres et tirets. Modifiable sans contrainte de transition.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="evenement-date">Date de début</Label>
                <Input
                  id="evenement-date"
                  type="date"
                  value={dateEvenement}
                  onChange={(event) => {
                    const nextDate = event.target.value
                    setDateFin((current) => !current || current === dateEvenement ? nextDate : current)
                    setDateEvenement(nextDate)
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evenement-date-fin">Date de fin</Label>
                <Input
                  id="evenement-date-fin"
                  type="date"
                  min={dateEvenement || undefined}
                  value={dateFin}
                  onChange={(event) => setDateFin(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evenement-statut">Statut</Label>
                <select
                  id="evenement-statut"
                  value={statut}
                  onChange={(event) => setStatut(event.target.value as EvenementStatut)}
                  className="flex h-9 w-full rounded-sm border border-paper-border bg-white px-3 py-2 font-registre text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="ouvert">Ouvert</option>
                  <option value="clos">Clos</option>
                </select>
              </div>
            </div>
            <p className="-mt-3 font-registre-mono text-[11px] text-ink-faint">
              Le statut se change manuellement dans les deux sens. Aucun passage automatique n’est appliqué.
            </p>

            <fieldset className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <legend className="font-registre text-sm font-medium text-ink-muted">
                  Montants proposés en ligne
                </legend>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setMontants((current) => [...current, ''])}
                >
                  Ajouter un montant
                </Button>
              </div>
              <div className="space-y-2">
                {montants.map((amount, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(event) => updateMontant(index, event.target.value)}
                        aria-label={`Montant ${index + 1} en euros`}
                        className="pr-9 font-registre-mono"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">€</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMontant(index)}
                      disabled={montants.length === 1}
                      aria-label={`Supprimer le montant ${index + 1}`}
                    >
                      Retirer
                    </Button>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’événement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
