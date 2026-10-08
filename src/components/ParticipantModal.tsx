import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Civilite, ProfilParticipant } from '../types'
import { CIVILITE_OPTIONS } from '../lib/civilite'
import { generateUUID } from '../lib/uuid'
import { isValidEmail } from '../lib/textFormat'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Textarea } from './ui/textarea'

interface ParticipantModalProps {
  open: boolean
  onClose: () => void
  onSaved: (participant: ProfilParticipant) => void
  participant?: ProfilParticipant
  organisationId: string
}

export default function ParticipantModal({
  open,
  onClose,
  onSaved,
  participant,
  organisationId,
}: ParticipantModalProps) {
  const isEdit = !!participant

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [civilite, setCivilite] = useState<Civilite | ''>('')
  const [nom2, setNom2] = useState('')
  const [prenom2, setPrenom2] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [pays, setPays] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailInvalid = email.length > 0 && !isValidEmail(email.trim())
  const isFoyer = civilite === 4
  const hasNoPrenom = civilite === 5 || civilite === 6

  useEffect(() => {
    if (open) {
      if (participant) {
        setNom(participant.personnes.nom)
        setPrenom(participant.personnes.prenom ?? '')
        setEmail(participant.personnes.email ?? '')
        setTelephone(participant.personnes.telephone ?? '')
        setCivilite(participant.personnes.civilite ?? '')
        setNom2(participant.personnes.nom2 ?? '')
        setPrenom2(participant.personnes.prenom2 ?? '')
        setAdresse(participant.personnes.adresse ?? '')
        setCodePostal(participant.personnes.code_postal ?? '')
        setVille(participant.personnes.ville ?? '')
        setPays(participant.personnes.pays ?? '')
        setNotes(participant.notes ?? '')
      } else {
        setNom('')
        setPrenom('')
        setEmail('')
        setTelephone('')
        setCivilite('')
        setNom2('')
        setPrenom2('')
        setAdresse('')
        setCodePostal('')
        setVille('')
        setPays('')
        setNotes('')
      }
      setError(null)
    }
  }, [open, participant])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (emailInvalid) {
      setError("Le format de l'adresse email est invalide.")
      return
    }
    setSaving(true)

    if (isEdit && participant) {
      // Update personne
      const { error: personneErr } = await supabase
        .from('personnes')
        .update({
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        })
        .eq('id', participant.personne_id)

      if (personneErr) {
        setError(personneErr.message)
        setSaving(false)
        return
      }

      // Update notes on profil
      const { error: profilErr } = await supabase
        .from('profils_participant')
        .update({ notes: notes || null })
        .eq('id', participant.id)

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved({
        ...participant,
        notes: notes || null,
        personnes: {
          ...participant.personnes,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        },
      })
      onClose()
      return
    } else {
      const { data: idExterne, error: idExterneErr } = await supabase.rpc('next_participant_id_externe', {
        p_organisation_id: organisationId,
      })

      if (idExterneErr) {
        setError(idExterneErr.message)
        setSaving(false)
        return
      }

      // Generate UUIDs client-side to avoid triggering the SELECT policy via RETURNING
      const personneId = generateUUID()
      const profilId = generateUUID()

      // Insert personne
      const { error: personneErr } = await supabase
        .from('personnes')
        .insert({
          id: personneId,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        })

      if (personneErr) {
        setError(personneErr.message)
        setSaving(false)
        return
      }

      // Insert profil_participant
      const { error: profilErr } = await supabase
        .from('profils_participant')
        .insert({
          id: profilId,
          personne_id: personneId,
          organisation_id: organisationId,
          notes: notes || null,
          id_externe: idExterne,
        })

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved({
        id: profilId,
        personne_id: personneId,
        organisation_id: organisationId,
        notes: notes || null,
        id_externe: idExterne,
        created_at: new Date().toISOString(),
        personnes: {
          id: personneId,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        },
      })
      onClose()
      return
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 pr-12">
          <DialogTitle>{isEdit ? 'Modifier le donateur' : 'Ajouter un donateur'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pm-civilite" className="block">Civilité</Label>
              <Select
                id="pm-civilite"
                value={civilite}
                onChange={(e) => {
                  const value = e.target.value ? (Number(e.target.value) as Civilite) : ''
                  setCivilite(value)
                  if (value === 5 || value === 6) setPrenom('')
                }}
                className="w-full"
              >
                <option value="">Non renseigné</option>
                {CIVILITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-nom">
                Nom <span className="text-stamp">*</span>
              </Label>
              <Input id="pm-nom" type="text" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Dupont" />
            </div>

            {!hasNoPrenom && (
              <div className="space-y-1.5">
                <Label htmlFor="pm-prenom">Prénom</Label>
                <Input id="pm-prenom" type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Jean" />
              </div>
            )}

            {isFoyer && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pm-nom2">Nom 2</Label>
                  <Input id="pm-nom2" type="text" value={nom2} onChange={(e) => setNom2(e.target.value)} placeholder="Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pm-prenom2">Prénom 2</Label>
                  <Input id="pm-prenom2" type="text" value={prenom2} onChange={(e) => setPrenom2(e.target.value)} placeholder="Marie" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pm-email">Email</Label>
              <Input
                id="pm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@exemple.fr"
                aria-invalid={emailInvalid}
                className={cn(emailInvalid && 'border-stamp focus-visible:ring-stamp/70')}
              />
              {emailInvalid && <p className="font-registre-mono text-[11px] text-stamp">Format d'email invalide.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-tel">Téléphone</Label>
              {/* type="tel" sans filtrage des chiffres : les donateurs peuvent avoir un numéro
                  international (+66, +856…) que sanitizeDigits amputerait du « + ». */}
              <Input
                id="pm-tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 00 00 00 00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-adresse">Adresse</Label>
              <Input id="pm-adresse" type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="12 rue des Lilas" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-cp">Code postal</Label>
                <Input id="pm-cp" type="text" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="75000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-ville">Ville</Label>
                <Input id="pm-ville" type="text" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Paris" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-pays">Pays</Label>
              <Input id="pm-pays" type="text" value={pays} onChange={(e) => setPays(e.target.value)} placeholder="France" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-notes">Notes</Label>
              <Textarea id="pm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes libres…" />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
