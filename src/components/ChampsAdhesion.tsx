import type { CiviliteAdherent } from '../types'
import { CIVILITE_ADHERENT_OPTIONS } from '../lib/civiliteAdherent'
import type { ChampsAdhesionValeurs } from '../lib/champsAdhesion'
import { toUpperName, toCapitalizedName, isValidEmail, sanitizeDigits } from '../lib/textFormat'
import { COUNTRIES } from '../lib/countries'
import { maxDateNaissance, isAnneeNaissanceValide } from '../lib/dateNaissance'
import { cn } from '../lib/utils'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'

interface ChampsAdhesionProps {
  valeurs: ChampsAdhesionValeurs
  onChange: (patch: Partial<ChampsAdhesionValeurs>) => void
  /** Masquée pour un renouvellement : la date de naissance de l'adhérent est déjà connue. */
  avecDateNaissance?: boolean
}

/** Identité, adresse et contact du formulaire public d'adhésion (adhésion et renouvellement). */
export default function ChampsAdhesion({ valeurs, onChange, avecDateNaissance = true }: ChampsAdhesionProps) {
  const { civilite, nom, prenom, dateNaissance, adresse, codePostal, ville, pays, telephone, courriel } = valeurs
  const courrielInvalid = courriel.length > 0 && !isValidEmail(courriel)
  const dateNaissanceInvalid = dateNaissance !== '' && !isAnneeNaissanceValide(dateNaissance)
  // Pays d'une fiche existante absent de la liste : proposé tel quel plutôt que remplacé.
  const paysOptions = pays && !COUNTRIES.includes(pays) ? [pays, ...COUNTRIES] : COUNTRIES

  return (
    <>
      <div>
        <Label>
          Civilité <span className="text-stamp">*</span>
        </Label>
        <Select
          required
          value={civilite === 0 ? '' : civilite}
          onChange={(e) => onChange({ civilite: e.target.value ? (Number(e.target.value) as CiviliteAdherent) : 0 })}
          className="mt-1 w-full"
        >
          <option value="" disabled>Sélectionner…</option>
          {CIVILITE_ADHERENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="nom">
          Nom <span className="text-stamp">*</span>
        </Label>
        <Input
          id="nom"
          type="text"
          required
          value={nom}
          onChange={(e) => onChange({ nom: toUpperName(e.target.value) })}
          placeholder="DUPONT"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="prenom">
          Prénom <span className="text-stamp">*</span>
        </Label>
        <Input
          id="prenom"
          type="text"
          required
          value={prenom}
          onChange={(e) => onChange({ prenom: toCapitalizedName(e.target.value) })}
          placeholder="Jean"
          className="mt-1"
        />
      </div>

      {avecDateNaissance && (
        <div>
          <Label htmlFor="date-naissance">
            Date de naissance <span className="text-stamp">*</span>
          </Label>
          <Input
            id="date-naissance"
            type="date"
            required
            value={dateNaissance}
            onChange={(e) => onChange({ dateNaissance: e.target.value })}
            aria-invalid={dateNaissanceInvalid}
            className={cn('mt-1', dateNaissanceInvalid && 'border-stamp focus-visible:ring-stamp/70')}
          />
          {dateNaissanceInvalid && (
            <p className="mt-1 text-xs text-stamp">
              L'année de naissance doit être {maxDateNaissance().slice(0, 4)} ou antérieure.
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="adresse">
          Adresse <span className="text-stamp">*</span>
        </Label>
        <Input
          id="adresse"
          type="text"
          required
          value={adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
          placeholder="12 rue des Lilas"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="code-postal">
            Code postal <span className="text-stamp">*</span>
          </Label>
          <Input
            id="code-postal"
            type="text"
            required
            inputMode="numeric"
            maxLength={5}
            value={codePostal}
            onChange={(e) => onChange({ codePostal: sanitizeDigits(e.target.value) })}
            placeholder="75000"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ville">
            Ville <span className="text-stamp">*</span>
          </Label>
          <Input
            id="ville"
            type="text"
            required
            value={ville}
            onChange={(e) => onChange({ ville: e.target.value })}
            placeholder="Paris"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>Pays</Label>
        <Select value={pays} onChange={(e) => onChange({ pays: e.target.value })} className="mt-1 w-full">
          {paysOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="telephone">Téléphone</Label>
        <Input
          id="telephone"
          type="tel"
          inputMode="numeric"
          minLength={10}
          maxLength={25}
          value={telephone}
          onChange={(e) => onChange({ telephone: sanitizeDigits(e.target.value) })}
          placeholder="0600000000"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="courriel">Courriel</Label>
        <Input
          id="courriel"
          type="email"
          value={courriel}
          onChange={(e) => onChange({ courriel: e.target.value })}
          placeholder="jean.dupont@exemple.fr"
          aria-invalid={courrielInvalid}
          className={cn('mt-1', courrielInvalid && 'border-stamp focus-visible:ring-stamp/70')}
        />
        {courrielInvalid && <p className="mt-1 text-xs text-stamp">Format d'email invalide.</p>}
      </div>
    </>
  )
}

interface ConsentementsAdhesionProps {
  statutsUrl: string | null
  accepteStatuts: boolean
  consentRgpd: boolean
  onAccepteStatutsChange: (value: boolean) => void
  onConsentRgpdChange: (value: boolean) => void
  /** Objet du traitement cité dans le consentement (« ma demande d'adhésion »…). */
  objet: string
}

/** Statuts (si l'organisation en publie) et consentement RGPD, tous deux obligatoires. */
export function ConsentementsAdhesion({
  statutsUrl,
  accepteStatuts,
  consentRgpd,
  onAccepteStatutsChange,
  onConsentRgpdChange,
  objet,
}: ConsentementsAdhesionProps) {
  return (
    <div className="border-t border-paper-border pt-4">
      {statutsUrl && (
        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            required
            checked={accepteStatuts}
            onChange={(e) => onAccepteStatutsChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-sm border-paper-border text-stamp focus:ring-stamp/70"
          />
          <span>
            J'ai pris connaissance{' '}
            <a href={statutsUrl} target="_blank" rel="noreferrer" className="font-medium text-stamp hover:underline">
              des statuts de l'association
            </a>{' '}
            et les approuve. <span className="text-stamp">*</span>
          </span>
        </label>
      )}

      <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          required
          checked={consentRgpd}
          onChange={(e) => onConsentRgpdChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded-sm border-paper-border text-stamp focus:ring-stamp/70"
        />
        <span>
          J'accepte que les informations saisies dans ce formulaire soient utilisées par l'association dans le
          cadre du traitement de {objet}. <span className="text-stamp">*</span>
        </span>
      </label>
    </div>
  )
}
