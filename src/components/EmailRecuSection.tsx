import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import EditorToolbarButton from './EditorToolbarButton'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { StatusNotice } from './ui/status-notice'
import type { EtatConfigBrevo } from '../lib/brevoConfig'
import { brevoConfigure } from '../lib/brevoConfig'
import {
  CHAMPS_EMAIL_RECU,
  EMAIL_RECU_MESSAGE_DEFAUT,
  EMAIL_RECU_OBJET_DEFAUT,
  rendreEmailRecu,
  rendreObjetEmailRecu,
  valeursEmailRecu,
} from '../../supabase/functions/_shared/recuEmail.ts'

// Dons › Paramètres › Email d'envoi : objet + message de l'email qui accompagne le reçu
// (send-recu-email). Même éditeur riche que l'emailing ; l'aperçu utilise le rendu de l'Edge
// Function (_shared/recuEmail.ts), donc il montre exactement l'email envoyé.

interface EmailRecuSectionProps {
  objet: string
  html: string
  organisationNom: string
  etatBrevo: EtatConfigBrevo | null
  lectureSeule: boolean
  onObjetChange: (objet: string) => void
  onHtmlChange: (html: string) => void
  // HTML normalisé par l'éditeur au chargement : sert de référence pour « modifié / enregistré ».
  onHtmlNormalise: (html: string) => void
}

export default function EmailRecuSection({
  objet,
  html,
  organisationNom,
  etatBrevo,
  lectureSeule,
  onObjetChange,
  onHtmlChange,
  onHtmlNormalise,
}: EmailRecuSectionProps) {
  const [champsOuverts, setChampsOuverts] = useState(false)
  const champsRef = useRef<HTMLDivElement>(null)
  const objetRef = useRef<HTMLInputElement>(null)
  // Dernier champ édité : le bouton « Insérer un champ » insère dans l'objet ou dans le message.
  const cibleInsertionRef = useRef<'objet' | 'message'>('message')

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: html,
    editable: !lectureSeule,
    onCreate: ({ editor }) => onHtmlNormalise(editor.getHTML()),
    onUpdate: ({ editor }) => onHtmlChange(editor.getHTML()),
    onFocus: () => { cibleInsertionRef.current = 'message' },
  })

  // Valeur pilotée par la page (bouton Annuler de la barre d'enregistrement, modèle par défaut).
  useEffect(() => {
    if (editor && editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])

  useEffect(() => {
    editor?.setEditable(!lectureSeule)
  }, [editor, lectureSeule])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (champsRef.current && !champsRef.current.contains(e.target as Node)) setChampsOuverts(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function insererChamp(cle: string) {
    const texte = `{{${cle}}}`
    if (cibleInsertionRef.current === 'objet' && objetRef.current) {
      const input = objetRef.current
      const debut = input.selectionStart ?? objet.length
      const fin = input.selectionEnd ?? objet.length
      onObjetChange(objet.slice(0, debut) + texte + objet.slice(fin))
    } else {
      editor?.chain().focus().insertContent({ type: 'text', text: texte }).run()
    }
    setChampsOuverts(false)
  }

  const valeursExemple = useMemo(
    () => valeursEmailRecu({
      prenom: 'Marie',
      nom: 'Dupont',
      annee: new Date().getFullYear() - 1,
      organisation: organisationNom,
      montant: 150,
    }),
    [organisationNom],
  )
  const apercuObjet = rendreObjetEmailRecu(objet, valeursExemple)
  const apercuHtml = rendreEmailRecu(html, valeursExemple)
  const parDefaut = objet === EMAIL_RECU_OBJET_DEFAUT && html === EMAIL_RECU_MESSAGE_DEFAUT

  return (
    <div className="space-y-6">
      {etatBrevo && !brevoConfigure(etatBrevo) && (
        <StatusNotice tone="warning" heading="Les reçus partent depuis Samakan">
          Brevo n'est pas configuré pour votre organisation : les reçus sont envoyés depuis noreply@samakan.fr et les
          réponses de vos donateurs ne vous parviennent pas. Configurez Brevo dans{' '}
          <Link to="/admin/parametres/integrations" className="font-medium underline underline-offset-2">Paramètres › Intégrations</Link>{' '}
          pour les envoyer depuis votre propre adresse. L'envoi en lot des reçus («&nbsp;Envoyer les reçus non envoyés&nbsp;»)
          exige Brevo : sans Brevo, chaque reçu s'envoie depuis son détail.
        </StatusNotice>
      )}
      {etatBrevo && brevoConfigure(etatBrevo) && (
        <div className="space-y-3">
          {/* Même modèle que la ligne Brevo d'Emailing ; « Voir » en lecture seule (même règle que peutModifierBrevo). */}
          <p className="text-sm text-ink-muted">
            Envoi via Brevo
            {etatBrevo.expediteurEmail && (
              <> (expéditeur <span className="font-medium text-ink [overflow-wrap:anywhere]">{etatBrevo.expediteurNom ? `${etatBrevo.expediteurNom} <${etatBrevo.expediteurEmail}>` : etatBrevo.expediteurEmail}</span>)</>
            )}
            {' · '}
            <Link to="/admin/parametres/integrations" className="font-medium text-stamp underline underline-offset-2 hover:no-underline">
              {lectureSeule ? 'Voir' : 'Modifier'}
            </Link>
          </p>
          <StatusNotice tone="warning">
            Si cet expéditeur n'est pas validé chez Brevo, un reçu envoyé depuis son détail part depuis noreply@samakan.fr
            et l'envoi en lot échoue.
          </StatusNotice>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div>
            <Label htmlFor="email-recu-objet">Objet</Label>
            <Input
              ref={objetRef}
              id="email-recu-objet"
              type="text"
              value={objet}
              onChange={(e) => onObjetChange(e.target.value)}
              onFocus={() => { cibleInsertionRef.current = 'objet' }}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Message</Label>
            <div className="mt-1 rounded-sm border border-paper-border bg-white">
              <div className="flex flex-wrap items-center gap-1 border-b border-paper-border px-2 py-1.5">
                <EditorToolbarButton
                  label="Gras"
                  disabled={lectureSeule}
                  active={editor?.isActive('bold') ?? false}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <span className="font-bold">G</span>
                </EditorToolbarButton>
                <EditorToolbarButton
                  label="Lien"
                  disabled={lectureSeule}
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
                <div ref={champsRef} className="relative">
                  <EditorToolbarButton
                    label="Insérer un champ"
                    disabled={lectureSeule}
                    active={champsOuverts}
                    onClick={() => setChampsOuverts((o) => !o)}
                  >
                    {'{{ }}'}
                  </EditorToolbarButton>
                  {champsOuverts && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-sm border border-paper-border bg-white py-1 shadow-lg">
                      {CHAMPS_EMAIL_RECU.map((c) => (
                        <button
                          key={c.cle}
                          type="button"
                          // mousedown : garde la sélection de l'objet ou de l'éditeur au moment du clic.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insererChamp(c.cle)}
                          className="block w-full px-3 py-1.5 text-left font-registre text-sm text-ink hover:bg-paper"
                        >
                          {c.libelle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none px-3 py-2 font-registre text-ink [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Champs : {CHAMPS_EMAIL_RECU.map((c) => `{{${c.cle}}}`).join(', ')}. Le reçu est joint en PDF.
            </p>
          </div>

          {!lectureSeule && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={parDefaut}
              onClick={() => {
                onObjetChange(EMAIL_RECU_OBJET_DEFAUT)
                onHtmlChange(EMAIL_RECU_MESSAGE_DEFAUT)
              }}
            >
              Revenir au modèle par défaut
            </Button>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-muted">Aperçu</p>
          <p className="mt-1 text-xs text-ink-faint">Exemple pour Marie Dupont, 150,00 € de dons.</p>
          <div className="mt-2 overflow-hidden rounded-sm border border-paper-border">
            <p className="border-b border-paper-border bg-paper px-3 py-2 text-sm text-ink break-words">
              <span className="text-ink-faint">Objet : </span>{apercuObjet}
            </p>
            {/* sandbox sans droits : aucun script ni navigation depuis l'aperçu. */}
            <iframe title="Aperçu de l'email du reçu" sandbox="" srcDoc={apercuHtml} className="block h-[360px] w-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
