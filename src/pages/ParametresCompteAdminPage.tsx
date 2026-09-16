import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { getCanonicalSiteUrl } from '../lib/environment'
import ParametresSection from '../components/ParametresSection'
import AdminAccountsManager from '../components/AdminAccountsManager'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function callEdgeFunction(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token ?? ''

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: json.error ?? 'Erreur serveur' }
  return { ok: true, message: json.message }
}

export default function ParametresCompteAdminPage() {
  const { auth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast, showToast, dismissToast } = useToast()

  const isAdmin = auth.type === 'admin'

  const [loading, setLoading] = useState(true)

  // Nom affiché
  const [nomAffiche, setNomAffiche] = useState('')
  const [nomSaving, setNomSaving] = useState(false)
  const [nomSuccess, setNomSuccess] = useState(false)
  const [nomError, setNomError] = useState<string | null>(null)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Mot de passe
  const [pwdSending, setPwdSending] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<string | null>(null)

  // Préférences
  const [notifDemandes, setNotifDemandes] = useState(true)
  const initialNotifRef = useRef(true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('email_change') === 'confirme') {
      showToast('Adresse email mise à jour.')
      searchParams.delete('email_change')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    async function fetchProfil() {
      if (auth.type !== 'admin') return
      const { data } = await supabase
        .from('profils_organisation')
        .select('nom_affiche, notif_demandes_adhesion')
        .eq('utilisateur_id', auth.user.id)
        .single()
      if (data) {
        const row = data as { nom_affiche: string | null; notif_demandes_adhesion: boolean }
        setNomAffiche(row.nom_affiche ?? '')
        setNotifDemandes(row.notif_demandes_adhesion)
        initialNotifRef.current = row.notif_demandes_adhesion
      }
      setLoading(false)
    }
    fetchProfil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function handleSaveNom(e: FormEvent) {
    e.preventDefault()
    if (auth.type !== 'admin') return
    setNomSaving(true)
    setNomError(null)
    setNomSuccess(false)

    const { error } = await supabase
      .from('profils_organisation')
      .update({ nom_affiche: nomAffiche })
      .eq('utilisateur_id', auth.user.id)

    if (error) {
      setNomError(error.message)
    } else {
      setNomSuccess(true)
      setTimeout(() => setNomSuccess(false), 3000)
    }
    setNomSaving(false)
  }

  async function handleRequestEmailChange(e: FormEvent) {
    e.preventDefault()
    setEmailSaving(true)
    setEmailError(null)
    setEmailMessage(null)

    const result = await callEdgeFunction('request-email-change', { new_email: newEmail, site_url: getCanonicalSiteUrl() })

    if (!result.ok) {
      setEmailError(result.error ?? 'Erreur lors de la demande de changement')
    } else {
      setEmailMessage(result.message ?? 'Vérifiez votre boîte mail pour confirmer le changement.')
      setNewEmail('')
    }
    setEmailSaving(false)
  }

  async function handleResetPassword() {
    if (auth.type !== 'admin') return
    setPwdSending(true)
    setPwdMessage(null)

    await fetch(`${SUPABASE_URL}/functions/v1/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email: auth.user.email, site_url: getCanonicalSiteUrl() }),
    })

    setPwdMessage('Un email de réinitialisation vous a été envoyé.')
    setPwdSending(false)
  }

  async function handleToggleNotif() {
    if (auth.type !== 'admin') return
    const next = !notifDemandes
    setNotifDemandes(next)
    setNotifSaving(true)
    setNotifError(null)
    setNotifSuccess(false)

    const { error } = await supabase
      .from('profils_organisation')
      .update({
        notif_demandes_adhesion: next,
        ...(next !== initialNotifRef.current ? { notif_demandes_adhesion_updated_at: new Date().toISOString() } : {}),
      })
      .eq('utilisateur_id', auth.user.id)

    if (error) {
      setNotifDemandes(!next)
      setNotifError(error.message)
    } else {
      initialNotifRef.current = next
      setNotifSuccess(true)
      setTimeout(() => setNotifSuccess(false), 3000)
    }
    setNotifSaving(false)
  }

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Paramètres — Mon compte</h1>
        <p className="mt-1 text-sm text-ink-muted">Vos informations personnelles, votre mot de passe et vos préférences.</p>
      </div>

      {!isAdmin ? (
        <ParametresSection title="Mon compte">
          <p className="text-sm text-ink-muted">
            Cette page n'est pas disponible en mode consultation super-admin — elle concerne le compte d'un admin de l'organisation.
          </p>
        </ParametresSection>
      ) : loading ? (
        <div className="py-12 text-center text-sm text-ink-faint">Chargement…</div>
      ) : (
        <>
          <ParametresSection title="Mes informations">
            <form onSubmit={handleSaveNom} className="space-y-4">
              {nomError && (
                <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{nomError}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="compte-nom">Nom affiché</Label>
                <Input id="compte-nom" type="text" value={nomAffiche} onChange={(e) => setNomAffiche(e.target.value)} placeholder="Prénom Nom" />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={nomSaving || !nomAffiche.trim()}>
                  {nomSaving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                {nomSuccess && <span className="text-sm text-ink-muted">Enregistré</span>}
              </div>
            </form>

            <div className="my-6 border-t border-paper-border" />

            <form onSubmit={handleRequestEmailChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="compte-email-actuel">Adresse email actuelle</Label>
                <Input id="compte-email-actuel" type="email" value={auth.user.email ?? ''} disabled />
              </div>
              {emailError && (
                <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{emailError}</div>
              )}
              {emailMessage && (
                <div className="rounded-sm border border-paper-border bg-paper px-4 py-3 text-sm text-ink-muted">{emailMessage}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="compte-email-nouveau">Changer d'adresse email</Label>
                <Input
                  id="compte-email-nouveau"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nouvelle.adresse@exemple.fr"
                />
                <p className="text-xs text-ink-faint">Un email de confirmation sera envoyé à l'ancienne et à la nouvelle adresse.</p>
              </div>
              <Button type="submit" size="sm" variant="secondary" disabled={emailSaving || !newEmail.trim()}>
                {emailSaving ? 'Envoi…' : "Demander le changement"}
              </Button>
            </form>
          </ParametresSection>

          <ParametresSection title="Mot de passe">
            {pwdMessage && (
              <div className="mb-4 rounded-sm border border-paper-border bg-paper px-4 py-3 text-sm text-ink-muted">{pwdMessage}</div>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={handleResetPassword} disabled={pwdSending}>
              {pwdSending ? 'Envoi…' : 'Réinitialiser mon mot de passe'}
            </Button>
          </ParametresSection>

          <ParametresSection title="Préférences" description="Notifications par email liées à votre activité d'administrateur.">
            {notifError && (
              <div className="mb-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{notifError}</div>
            )}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={notifDemandes}
                  onChange={handleToggleNotif}
                  disabled={notifSaving}
                  className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                />
                Recevoir les notifications de demandes d'adhésion
              </label>
              {notifSuccess && <span className="text-sm text-ink-muted">Enregistré</span>}
            </div>
          </ParametresSection>

          {auth.role === 'admin' && (
            <ParametresSection title="Contributeurs" description="Comptes supplémentaires ayant les mêmes accès que vous, sans droit de gestion des comptes.">
              <AdminAccountsManager
                organisationId={auth.organisationId}
                filterRoles={['contributeur']}
                heading="Contributeurs de l'organisation"
                addButtonLabel="Ajouter un contributeur"
                newFormTitle="Nouveau contributeur"
                emptyLabel="Aucun contributeur pour cette organisation."
              />
            </ParametresSection>
          )}
        </>
      )}
    </div>
  )
}
