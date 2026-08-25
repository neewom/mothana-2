import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import ParametresSection from '../components/ParametresSection'
import ScrollShadowX from '../components/ScrollShadowX'
import BrevoConfigModal, { type BrevoConfigValues } from '../components/BrevoConfigModal'

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

type FiltreStatut = 'actif' | 'archive' | 'tous'

function parseEnvoyerA(value: string): { filtreStatut: FiltreStatut; tagEnvoi: string | null } {
  const sep = value.indexOf(':')
  const kind = value.slice(0, sep)
  const rest = value.slice(sep + 1)
  if (kind === 'tag') return { filtreStatut: 'tous', tagEnvoi: rest }
  return { filtreStatut: rest as FiltreStatut, tagEnvoi: null }
}

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
  const navigate = useNavigate()
  const { toast, showToast, dismissToast } = useToast()

  // Config Brevo
  const [configLoading, setConfigLoading] = useState(true)
  const [brevoConfig, setBrevoConfig] = useState<BrevoConfigValues>({ apiKey: '', expediteurNom: '', expediteurEmail: '' })
  const [configured, setConfigured] = useState(false)
  const [brevoModalOpen, setBrevoModalOpen] = useState(false)

  // Composition
  const [sujet, setSujet] = useState('')
  // Encodé "statut:actif" | "statut:archive" | "statut:tous" | "tag:<nom>" — un seul
  // sélecteur "Envoyer à" plutôt que deux champs séparés, cf. cadrage listes de diffusion.
  const [envoyerA, setEnvoyerA] = useState('statut:actif')
  const [excludeTag, setExcludeTag] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])
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
      const draft = JSON.parse(raw) as { sujet: string; corpsHtml: string; envoyerA?: string; excludeTag?: string }
      setSujet(draft.sujet ?? '')
      setEnvoyerA(draft.envoyerA ?? 'statut:actif')
      setExcludeTag(draft.excludeTag ?? '')
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
    localStorage.setItem(draftKey, JSON.stringify({ sujet, corpsHtml, envoyerA, excludeTag }))
  }, [draftKey, sujet, corpsHtml, envoyerA, excludeTag, corpsVide])

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
      setBrevoConfig({
        apiKey: raw?.brevo_api_key ?? '',
        expediteurNom: raw?.brevo_expediteur_nom ?? '',
        expediteurEmail: raw?.brevo_expediteur_email ?? '',
      })
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

  const { filtreStatut, tagEnvoi } = parseEnvoyerA(envoyerA)

  const fetchDestinatairesCount = useCallback(async () => {
    if (!organisationId) return
    let query = supabase
      .from('adherents')
      .select('courriel, tags')
      .eq('organisation_id', organisationId)
      .eq('mailing_opt_out', false)
    // Sélectionner une liste prime sur le statut actif/archivé (envoie à tous les
    // porteurs du tag, peu importe leur statut) — cf. cadrage.
    if (tagEnvoi) {
      query = query.contains('tags', [tagEnvoi])
    } else if (filtreStatut !== 'tous') {
      query = query.eq('statut', filtreStatut)
    }
    const { data } = await query
    const rows = (data ?? []) as { courriel: string | null; tags: string[] }[]
    const filtered = excludeTag ? rows.filter((a) => !(a.tags ?? []).includes(excludeTag)) : rows
    const avecEmail = filtered.filter((a) => a.courriel && a.courriel.trim() !== '').length
    setDestinatairesCount({ avecEmail, exclus: filtered.length - avecEmail })
  }, [organisationId, filtreStatut, tagEnvoi, excludeTag])

  useEffect(() => {
    fetchDestinatairesCount()
  }, [fetchDestinatairesCount])

  useEffect(() => {
    if (!organisationId) return
    supabase
      .from('listes_diffusion')
      .select('nom')
      .eq('organisation_id', organisationId)
      .order('nom')
      .then(({ data }) => {
        setAvailableTags(((data ?? []) as { nom: string }[]).map((r) => r.nom))
      })
  }, [organisationId])

  function handleConfigSaved(values: BrevoConfigValues) {
    setBrevoConfig(values)
    setConfigured(!!(values.apiKey.trim() && values.expediteurNom.trim() && values.expediteurEmail.trim()))
    showToast('Configuration Brevo enregistrée')
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
        tag_envoi: tagEnvoi,
        exclude_tag: excludeTag || null,
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
        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              configured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {configured ? 'Configuré' : 'Non configuré'}
          </span>
          <button
            type="button"
            onClick={() => setBrevoModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurer
          </button>
        </div>
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

          <div className="flex flex-wrap items-start gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Envoyer à</label>
              <select
                value={envoyerA}
                onChange={(e) => {
                  if (e.target.value === '__create__') {
                    navigate('/admin/adherents')
                    return
                  }
                  setEnvoyerA(e.target.value)
                }}
                className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <optgroup label="Statut">
                  <option value="statut:actif">Adhérents actifs</option>
                  <option value="statut:archive">Adhérents archivés</option>
                  <option value="statut:tous">Tous les adhérents</option>
                </optgroup>
                {availableTags.length > 0 && (
                  <optgroup label="Listes">
                    {availableTags.map((tag) => (
                      <option key={tag} value={`tag:${tag}`}>Liste : {tag}</option>
                    ))}
                  </optgroup>
                )}
                <option value="__create__">+ Créer une nouvelle liste</option>
              </select>
            </div>

            {availableTags.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Exclure la liste</label>
                <select
                  value={excludeTag}
                  onChange={(e) => setExcludeTag(e.target.value)}
                  className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Aucune</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {destinatairesCount && (
            <p className="text-xs text-slate-500">
              {destinatairesCount.avecEmail} destinataire{destinatairesCount.avecEmail > 1 ? 's' : ''} avec email
              {destinatairesCount.exclus > 0 && ` — ${destinatairesCount.exclus} exclu${destinatairesCount.exclus > 1 ? 's' : ''} (email manquant)`}
            </p>
          )}

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

      <BrevoConfigModal
        open={brevoModalOpen}
        onClose={() => setBrevoModalOpen(false)}
        onSaved={handleConfigSaved}
        organisationId={organisationId}
        initial={brevoConfig}
      />

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
