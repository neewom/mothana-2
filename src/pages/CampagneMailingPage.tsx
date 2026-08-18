import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import ParametresSection from '../components/ParametresSection'
import ScrollShadowX from '../components/ScrollShadowX'

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

type FiltreStatut = 'actif' | 'archive' | 'tous'

interface BrevoConfig {
  brevo_api_key: string | null
  brevo_expediteur_nom: string | null
  brevo_expediteur_email: string | null
}

interface Campagne {
  id: string
  sujet: string
  nombre_destinataires: number
  nombre_exclus: number
  created_at: string
}

interface PieceJointeState {
  fichier: File
  base64: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const PLACEHOLDERS = [
  { key: 'prenom', label: 'Prénom' },
  { key: 'nom', label: 'Nom' },
]

function EditorToolbarButton({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function CampagneMailingPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()

  // Config Brevo
  const [configLoading, setConfigLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [expediteurNom, setExpediteurNom] = useState('')
  const [expediteurEmail, setExpediteurEmail] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)

  // Composition
  const [sujet, setSujet] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('actif')
  const [pieceJointe, setPieceJointe] = useState<PieceJointeState | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [destinatairesCount, setDestinatairesCount] = useState<{ avecEmail: number; exclus: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Historique
  const [historique, setHistorique] = useState<Campagne[]>([])
  const [historiqueLoading, setHistoriqueLoading] = useState(true)

  const [corpsHtml, setCorpsHtml] = useState('')
  const [corpsVide, setCorpsVide] = useState(true)
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false)
  const placeholdersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (placeholdersRef.current && !placeholdersRef.current.contains(e.target as Node)) {
        setPlaceholdersOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: '',
    onUpdate: ({ editor }) => {
      setCorpsHtml(editor.getHTML())
      setCorpsVide(editor.getText().trim() === '')
    },
  })

  const draftKey = organisationId ? `mothana-mailing-draft-${organisationId}` : null
  const draftRestoredRef = useRef(false)

  // Restauration du brouillon (une seule fois, une fois l'éditeur prêt) — protège
  // contre une perte de progression sur rechargement de page (HMR en dev, F5 accidentel…).
  useEffect(() => {
    if (!editor || !draftKey || draftRestoredRef.current) return
    draftRestoredRef.current = true
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as { sujet: string; corpsHtml: string; filtreStatut: FiltreStatut }
      setSujet(draft.sujet ?? '')
      setFiltreStatut(draft.filtreStatut ?? 'actif')
      editor.commands.setContent(draft.corpsHtml ?? '')
      setCorpsHtml(draft.corpsHtml ?? '')
      setCorpsVide(editor.getText().trim() === '')
    } catch {
      localStorage.removeItem(draftKey)
    }
  }, [editor, draftKey])

  // Sauvegarde continue du brouillon (pièce jointe exclue : trop volumineuse pour localStorage)
  useEffect(() => {
    if (!draftKey) return
    if (!sujet && corpsVide) {
      localStorage.removeItem(draftKey)
      return
    }
    localStorage.setItem(draftKey, JSON.stringify({ sujet, corpsHtml, filtreStatut }))
  }, [draftKey, sujet, corpsHtml, filtreStatut, corpsVide])

  useEffect(() => {
    if (!organisationId) return
    async function fetchConfig() {
      setConfigLoading(true)
      const { data } = await supabase
        .from('organisations')
        .select('brevo_api_key, brevo_expediteur_nom, brevo_expediteur_email')
        .eq('id', organisationId)
        .single()

      const raw = data as BrevoConfig | null
      setApiKey(raw?.brevo_api_key ?? '')
      setExpediteurNom(raw?.brevo_expediteur_nom ?? '')
      setExpediteurEmail(raw?.brevo_expediteur_email ?? '')
      setConfigured(!!(raw?.brevo_api_key && raw.brevo_expediteur_nom && raw.brevo_expediteur_email))
      setConfigLoading(false)
    }
    fetchConfig()
  }, [organisationId])

  const fetchHistorique = useCallback(async () => {
    if (!organisationId) return
    setHistoriqueLoading(true)
    const { data } = await supabase
      .from('campagnes_mailing')
      .select('id, sujet, nombre_destinataires, nombre_exclus, created_at')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorique((data ?? []) as Campagne[])
    setHistoriqueLoading(false)
  }, [organisationId])

  useEffect(() => {
    fetchHistorique()
  }, [fetchHistorique])

  const fetchDestinatairesCount = useCallback(async () => {
    if (!organisationId) return
    let query = supabase
      .from('adherents')
      .select('courriel', { count: 'exact' })
      .eq('organisation_id', organisationId)
      .eq('mailing_opt_out', false)
    if (filtreStatut !== 'tous') query = query.eq('statut', filtreStatut)
    const { data, count } = await query
    const avecEmail = (data ?? []).filter((a) => a.courriel && a.courriel.trim() !== '').length
    setDestinatairesCount({ avecEmail, exclus: (count ?? 0) - avecEmail })
  }, [organisationId, filtreStatut])

  useEffect(() => {
    fetchDestinatairesCount()
  }, [fetchDestinatairesCount])

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault()
    setConfigSaving(true)
    setConfigError(null)
    setConfigSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({
        brevo_api_key: apiKey.trim() || null,
        brevo_expediteur_nom: expediteurNom.trim() || null,
        brevo_expediteur_email: expediteurEmail.trim() || null,
      })
      .eq('id', organisationId)

    if (error) {
      setConfigError(error.message)
    } else {
      setConfigured(!!(apiKey.trim() && expediteurNom.trim() && expediteurEmail.trim()))
      setConfigSuccess(true)
      setTimeout(() => setConfigSuccess(false), 3000)
    }
    setConfigSaving(false)
  }

  function handleAttachmentChange(file: File | null) {
    setAttachmentError(null)
    if (!file) {
      setPieceJointe(null)
      return
    }
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAttachmentError('Format non supporté (PDF ou image uniquement)')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setAttachmentError('Fichier trop volumineux (10 Mo max)')
      return
    }
    fileToBase64(file).then((base64) => setPieceJointe({ fichier: file, base64 }))
  }

  function resetForm() {
    setSujet('')
    editor?.commands.setContent('')
    setCorpsHtml('')
    setCorpsVide(true)
    setPieceJointe(null)
    if (draftKey) localStorage.removeItem(draftKey)
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSendError('Session expirée')
      setSending(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/send-mailing-brevo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        sujet,
        corps_html: corpsHtml,
        filtre_statut: filtreStatut,
        piece_jointe: pieceJointe ? { nom: pieceJointe.fichier.name, contenu_base64: pieceJointe.base64, type_mime: pieceJointe.fichier.type } : null,
        site_url: window.location.origin,
      }),
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setSendError(json.error ?? 'Erreur inconnue')
      setSending(false)
      return
    }

    setSending(false)
    setConfirmOpen(false)
    showToast(`Campagne envoyée à ${json.nombre_destinataires} destinataire${json.nombre_destinataires > 1 ? 's' : ''}`)
    resetForm()
    fetchHistorique()
  }

  const canSend = sujet.trim() !== '' && !corpsVide && configured && (destinatairesCount?.avecEmail ?? 0) > 0

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mailing</h1>
        <p className="mt-1 text-sm text-slate-600">Envoyez une campagne d'information à vos adhérents via Brevo.</p>
      </div>

      <ParametresSection
        title="Configuration Brevo"
        description="Compte Brevo de votre organisation, utilisé pour l'envoi des campagnes."
      >
        <form onSubmit={handleSaveConfig} className="max-w-lg space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Clé API</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="xkeysib-…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l'expéditeur</label>
            <input
              type="text"
              value={expediteurNom}
              onChange={(e) => setExpediteurNom(e.target.value)}
              placeholder="Association Démo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email de l'expéditeur</label>
            <input
              type="email"
              value={expediteurEmail}
              onChange={(e) => setExpediteurEmail(e.target.value)}
              placeholder="contact@association.fr"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">Doit correspondre à un expéditeur vérifié dans votre compte Brevo.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={configSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {configSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {configSuccess && <span className="text-sm text-emerald-600">Enregistré</span>}
            {configError && <span className="text-sm text-red-600">{configError}</span>}
          </div>
        </form>
      </ParametresSection>

      <ParametresSection
        title="Nouvelle campagne"
        description="Composez le message envoyé à vos adhérents."
      >
        <div className="max-w-2xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sujet</label>
            <input
              type="text"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Objet de l'email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
            <div className="rounded-lg border border-slate-300">
              <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5">
                <EditorToolbarButton
                  label="Gras"
                  active={editor?.isActive('bold') ?? false}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <span className="font-bold">G</span>
                </EditorToolbarButton>
                <EditorToolbarButton
                  label="Lien"
                  active={editor?.isActive('link') ?? false}
                  onClick={() => {
                    if (editor?.isActive('link')) {
                      editor.chain().focus().unsetLink().run()
                      return
                    }
                    const url = window.prompt('URL du lien')
                    if (url) editor?.chain().focus().setLink({ href: url }).run()
                  }}
                >
                  Lien
                </EditorToolbarButton>
                <div ref={placeholdersRef} className="relative">
                  <EditorToolbarButton label="Insérer un placeholder" active={false} onClick={() => setPlaceholdersOpen((o) => !o)}>
                    {'{{ }}'}
                  </EditorToolbarButton>
                  {placeholdersOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            editor
                              ?.chain()
                              .focus()
                              .insertContent({ type: 'text', text: `{{params.${p.key}}}` })
                              .insertContent({ type: 'text', text: ' ' })
                              .run()
                            setPlaceholdersOpen(false)
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <EditorContent editor={editor} className="prose prose-sm max-w-none px-3 py-2 [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pièce jointe (facultatif)</label>
            <div className="flex items-center gap-3">
              {pieceJointe && <span className="text-sm text-slate-600">{pieceJointe.fichier.name}</span>}
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                {pieceJointe ? 'Remplacer' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    handleAttachmentChange(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
              {pieceJointe && (
                <button type="button" onClick={() => setPieceJointe(null)} className="text-xs font-medium text-red-600 hover:underline">
                  Retirer
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">PDF ou image, 10 Mo max, même fichier envoyé à tous les destinataires.</p>
            {attachmentError && <p className="mt-1 text-xs text-red-600">{attachmentError}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destinataires</label>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
              className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="actif">Adhérents actifs</option>
              <option value="archive">Adhérents archivés</option>
              <option value="tous">Tous les adhérents</option>
            </select>
            {destinatairesCount && (
              <p className="mt-1.5 text-xs text-slate-500">
                {destinatairesCount.avecEmail} destinataire{destinatairesCount.avecEmail > 1 ? 's' : ''} avec email
                {destinatairesCount.exclus > 0 && ` — ${destinatairesCount.exclus} exclu${destinatairesCount.exclus > 1 ? 's' : ''} (email manquant)`}
              </p>
            )}
          </div>

          {!configured && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Configurez d'abord la clé API Brevo et l'expéditeur ci-dessus.
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Envoyer la campagne
            </button>
            {sendError && <span className="text-sm text-red-600">{sendError}</span>}
          </div>
        </div>
      </ParametresSection>

      <ParametresSection title="Historique" description="20 dernières campagnes envoyées.">
        {historiqueLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : historique.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune campagne envoyée pour le moment.</p>
        ) : (
          <ScrollShadowX>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Sujet</th>
                  <th className="py-2 pr-4">Destinataires</th>
                  <th className="py-2">Exclus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historique.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 text-slate-500">{formatDateTime(c.created_at)}</td>
                    <td className="py-2 pr-4 font-medium text-slate-900">{c.sujet}</td>
                    <td className="py-2 pr-4 text-slate-700">{c.nombre_destinataires}</td>
                    <td className="py-2 text-slate-700">{c.nombre_exclus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollShadowX>
        )}
      </ParametresSection>

      {confirmOpen && (
        <Modal open onClose={() => setConfirmOpen(false)} maxWidthClassName="max-w-sm" labelledBy="confirm-send-title">
          <div className="p-6">
            <h2 id="confirm-send-title" className="text-lg font-semibold text-slate-900">Envoyer la campagne</h2>
            <p className="mt-2 text-sm text-slate-600">
              Vous êtes sur le point d'envoyer cet email à{' '}
              <span className="font-medium">{destinatairesCount?.avecEmail ?? 0} destinataire{(destinatairesCount?.avecEmail ?? 0) > 1 ? 's' : ''}</span>.
              Cette action est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
