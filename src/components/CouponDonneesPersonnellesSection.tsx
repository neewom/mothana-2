import { useEffect, useState, type FormEvent } from 'react'
import {
  CONSERVATION_MOIS_DEFAUT,
  CONSERVATION_MOIS_MAX,
  CONSERVATION_MOIS_MIN,
  conservationMoisValide,
  urlPolitiqueValide,
} from '../lib/couponRgpd'
import { supabase } from '../lib/supabaseClient'
import ParametresSection from './ParametresSection'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface CouponDonneesPersonnellesSectionProps {
  organisationId: string
}

interface Settings {
  conservation_evenements_mois: number
  url_politique_confidentialite: string | null
}

/** Paramètres RGPD du porte-monnaie événementiel (durée de conservation, politique de confidentialité). */
export default function CouponDonneesPersonnellesSection({ organisationId }: CouponDonneesPersonnellesSectionProps) {
  const [saved, setSaved] = useState<Settings | null>(null)
  const [mois, setMois] = useState(String(CONSERVATION_MOIS_DEFAUT))
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function load() {
      const { data, error: loadError } = await supabase
        .from('organisations')
        .select('conservation_evenements_mois, url_politique_confidentialite')
        .eq('id', organisationId)
        .single()

      if (cancelled) return
      if (loadError || !data) {
        setError('Ces paramètres n’ont pas pu être chargés.')
        return
      }
      const settings = data as Settings
      setSaved(settings)
      setMois(String(settings.conservation_evenements_mois))
      setUrl(settings.url_politique_confidentialite ?? '')
    }

    void load()
    return () => { cancelled = true }
  }, [organisationId])

  const moisNumber = Number(mois)
  const moisInvalid = mois.length > 0 && !conservationMoisValide(moisNumber)
  const urlInvalid = url.trim().length > 0 && !urlPolitiqueValide(url)
  const normalizedUrl = url.trim() || null
  const unchanged = saved !== null
    && saved.conservation_evenements_mois === moisNumber
    && saved.url_politique_confidentialite === normalizedUrl

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!conservationMoisValide(moisNumber) || urlInvalid) return

    setSaving(true)
    setError(null)
    setSuccess(false)
    const { error: saveError } = await supabase
      .from('organisations')
      .update({ conservation_evenements_mois: moisNumber, url_politique_confidentialite: normalizedUrl })
      .eq('id', organisationId)

    if (saveError) {
      setError('Les paramètres n’ont pas pu être enregistrés. Réessayez.')
    } else {
      setSaved({ conservation_evenements_mois: moisNumber, url_politique_confidentialite: normalizedUrl })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  return (
    <ParametresSection
      title="Données personnelles des acheteurs"
      description="Portefeuilles événement : durée de conservation des emails et information des acheteurs."
    >
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <Label htmlFor="coupon-conservation">Durée de conservation (mois)</Label>
          <Input
            id="coupon-conservation"
            type="text"
            inputMode="numeric"
            value={mois}
            onChange={(event) => setMois(event.target.value.replace(/\D/g, ''))}
            aria-invalid={moisInvalid}
            aria-describedby="coupon-conservation-help"
            className="mt-1 w-32"
          />
          <p id="coupon-conservation-help" className={`mt-1.5 text-xs ${moisInvalid ? 'text-stamp' : 'text-ink-faint'}`}>
            {moisInvalid
              ? `Entre ${CONSERVATION_MOIS_MIN} et ${CONSERVATION_MOIS_MAX} mois.`
              : 'Comptée à partir de la fin de l’événement. Passé ce délai, les acheteurs sont anonymisés automatiquement et le crédit restant n’est plus utilisable.'}
          </p>
        </div>

        <div>
          <Label htmlFor="coupon-politique">Lien vers votre politique de confidentialité</Label>
          <Input
            id="coupon-politique"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            aria-invalid={urlInvalid}
            aria-describedby="coupon-politique-help"
            className="mt-1"
          />
          <p id="coupon-politique-help" className={`mt-1.5 text-xs ${urlInvalid ? 'text-stamp' : 'text-ink-faint'}`}>
            {urlInvalid
              ? 'Saisissez une adresse complète commençant par https://'
              : 'Facultatif. Affiché aux acheteurs à côté de la saisie de leur email.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || saved === null || unchanged || mois.length === 0 || moisInvalid || urlInvalid}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {success && <span className="text-sm text-success">Enregistré</span>}
          {error && <span className="text-sm text-stamp">{error}</span>}
        </div>
      </form>
    </ParametresSection>
  )
}
