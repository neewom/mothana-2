import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import {
  NON_ENREGISTRE,
  RAISON_EXCLUSION_LABELS,
  documentApercuMessage,
  estCampagneAnterieure,
  libelleAuteur,
  type RaisonExclusionCampagne,
} from '../lib/campagneMailingDetail'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs } from './ui/tabs'
import { DetailField } from './ui/side-panel'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'

// Détail d'une campagne de l'historique d'Emailing, dans le panneau latéral
// (carte « Emailing : détail figé et notes », 2026-11-09).

export interface CampagneHistorique {
  id: string
  sujet: string
  nombre_destinataires: number
  nombre_exclus: number
  created_at: string
  envoye_par: string | null
  selection_label: string | null
  exclusion_label: string | null
  nombre_pieces_jointes: number | null
  notes: string | null
}

interface Destinataire {
  id: string
  nom: string
  courriel: string | null
  raison_exclusion: RaisonExclusionCampagne | null
}

type Onglet = 'envoye' | 'exclu'

// Affichage par pages : une campagne peut viser plusieurs milliers d'adhérents.
const PAGE_DESTINATAIRES = 50
const NOTES_MAX = 5000

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CampagneMailingApercuTitre({ campagne }: { campagne: CampagneHistorique }) {
  return (
    <span className="block">
      <span className="block break-words">{campagne.sujet}</span>
      <span className="mt-0.5 block font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Envoyée le {formatDateHeure(campagne.created_at)}
      </span>
    </span>
  )
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

export function CampagneMailingApercuChamps({
  campagne,
  auteurs,
  onNotesSaved,
}: {
  campagne: CampagneHistorique
  auteurs: ReadonlyMap<string, string>
  onNotesSaved: (id: string, notes: string | null) => void
}) {
  const anterieure = estCampagneAnterieure(campagne)

  return (
    <>
      <DetailField label="Envoyée par">{libelleAuteur(campagne.envoye_par, auteurs)}</DetailField>

      <DetailField label="Sélection">
        {anterieure ? (
          <span className="text-ink-faint">{NON_ENREGISTRE}</span>
        ) : (
          <>
            <p className="break-words">{campagne.selection_label}</p>
            {campagne.exclusion_label && <p className="break-words text-ink-muted">{campagne.exclusion_label}</p>}
          </>
        )}
      </DetailField>

      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Envoyés"><span className="font-registre-mono">{campagne.nombre_destinataires}</span></DetailField>
        <DetailField label="Exclus"><span className="font-registre-mono">{campagne.nombre_exclus}</span></DetailField>
      </div>

      <NotesCampagne key={campagne.id} campagne={campagne} onSaved={onNotesSaved} />

      <ApercuMessage campagneId={campagne.id} sujet={campagne.sujet} />

      <DetailField label="Pièces jointes">
        {campagne.nombre_pieces_jointes === null ? (
          <span className="text-ink-faint">{NON_ENREGISTRE}</span>
        ) : campagne.nombre_pieces_jointes === 0 ? (
          'Aucune'
        ) : (
          pluriel(campagne.nombre_pieces_jointes, 'fichier')
        )}
      </DetailField>

      {anterieure ? (
        <DetailField label="Destinataires">
          <span className="text-ink-faint">{NON_ENREGISTRE}</span>
        </DetailField>
      ) : (
        <DestinatairesCampagne
          key={campagne.id}
          campagneId={campagne.id}
          attendus={campagne.nombre_destinataires + campagne.nombre_exclus}
        />
      )}
    </>
  )
}

/** Corps du message relu à l'ouverture, rendu dans un iframe `sandbox` sans scripts (jamais injecté dans la page). */
function ApercuMessage({ campagneId, sujet }: { campagneId: string; sujet: string }) {
  const [corps, setCorps] = useState<{ id: string; html: string | null; erreur: boolean } | null>(null)
  const [agrandi, setAgrandi] = useState(false)

  useEffect(() => {
    let annule = false
    supabase
      .from('campagnes_mailing')
      .select('corps_html')
      .eq('id', campagneId)
      .single()
      .then(({ data, error }) => {
        if (annule) return
        setCorps({ id: campagneId, html: (data as { corps_html: string } | null)?.corps_html ?? null, erreur: !!error })
      })
    return () => { annule = true }
  }, [campagneId])

  const courant = corps?.id === campagneId ? corps : null
  const doc = courant?.html != null ? documentApercuMessage(courant.html) : null

  return (
    <DetailField label="Message">
      {!courant ? (
        <span className="text-ink-faint">Chargement…</span>
      ) : courant.erreur || doc === null ? (
        <span className="text-stamp">Impossible de charger le message.</span>
      ) : (
        <>
          <iframe
            title={`Aperçu du message « ${sujet} »`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={doc}
            className="h-48 w-full rounded-sm border border-paper-border bg-white"
          />
          <p className="mt-1 text-xs text-ink-faint">Les images externes peuvent ne pas s'afficher dans cet aperçu.</p>
          <button
            type="button"
            onClick={() => setAgrandi(true)}
            className="mt-1.5 rounded-sm text-xs font-medium text-stamp hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
          >
            Voir en grand
          </button>
          <Dialog open={agrandi} onOpenChange={setAgrandi}>
            <DialogContent className="max-w-3xl" aria-describedby={undefined}>
              <div className="flex max-h-[85vh] flex-col p-6">
                <DialogTitle className="break-words pr-8">{sujet}</DialogTitle>
                <iframe
                  title={`Message « ${sujet} »`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={doc}
                  className="mt-4 h-[65vh] w-full rounded-sm border border-paper-border bg-white"
                />
                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => setAgrandi(false)}>Fermer</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DetailField>
  )
}

function NotesCampagne({ campagne, onSaved }: { campagne: CampagneHistorique; onSaved: (id: string, notes: string | null) => void }) {
  const id = useId()
  const [valeur, setValeur] = useState(campagne.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)

  const modifie = valeur.trim() !== (campagne.notes ?? '').trim()
  const tropLongue = valeur.length > NOTES_MAX

  async function enregistrer() {
    setSaving(true)
    setErreur(null)
    setEnregistre(false)
    const { error } = await supabase.rpc('modifier_note_campagne_mailing', { p_campagne_id: campagne.id, p_notes: valeur })
    setSaving(false)
    if (error) {
      setErreur(error.message.includes('ACCES_REFUSE') ? "Vous n'avez pas le droit de modifier cette note." : "La note n'a pas pu être enregistrée. Réessayez.")
      return
    }
    const notes = valeur.trim() || null
    setValeur(notes ?? '')
    setEnregistre(true)
    onSaved(campagne.id, notes)
  }

  return (
    <div>
      <label htmlFor={id} className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Notes</label>
      <Textarea
        id={id}
        value={valeur}
        onChange={(e) => { setValeur(e.target.value); setEnregistre(false) }}
        rows={3}
        placeholder="Pourquoi cette campagne, ce qui a changé depuis la précédente…"
        className="mt-1"
        aria-invalid={tropLongue || undefined}
      />
      {tropLongue && <p className="mt-1 text-xs text-stamp">{NOTES_MAX} caractères maximum ({valeur.length}).</p>}
      {erreur && <p role="alert" className="mt-1 text-xs text-stamp">{erreur}</p>}
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" size="sm" onClick={enregistrer} disabled={!modifie || saving || tropLongue}>
          {saving ? 'Enregistrement…' : 'Enregistrer la note'}
        </Button>
        {enregistre && !modifie && <span role="status" className="text-xs text-success">Note enregistrée</span>}
      </div>
    </div>
  )
}

function DestinatairesCampagne({ campagneId, attendus }: { campagneId: string; attendus: number }) {
  const idPrefix = useId()
  const [onglet, setOnglet] = useState<Onglet>('envoye')
  // null : en cours ; 'erreur' : comptage impossible (affiché « — », jamais 0).
  const [compteurs, setCompteurs] = useState<Record<Onglet, number> | 'erreur' | null>(null)
  const [recherche, setRecherche] = useState('')
  const rechercheDiffere = useDebouncedValue(recherche, 300)
  const [lignes, setLignes] = useState<Destinataire[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  // Seule la dernière requête lancée s'applique (onglet ou recherche changés pendant un chargement).
  const requeteRef = useRef(0)

  // Compteurs par onglet (lignes encore présentes : un adhérent supprimé emporte la sienne).
  useEffect(() => {
    let annule = false
    const compter = (statut: Onglet) =>
      supabase.from('campagnes_mailing_destinataires').select('id', { count: 'exact', head: true }).eq('campagne_id', campagneId).eq('statut', statut)
    Promise.all([compter('envoye'), compter('exclu')]).then(([envoye, exclu]) => {
      if (annule) return
      if (envoye.error || exclu.error || envoye.count === null || exclu.count === null) {
        setCompteurs('erreur')
        return
      }
      setCompteurs({ envoye: envoye.count, exclu: exclu.count })
    })
    return () => { annule = true }
  }, [campagneId])

  // Recherche serveur (RPC, sans accents ni casse), ignorée sous 2 caractères.
  const termeRecherche = rechercheDiffere.trim().length >= 2 ? rechercheDiffere.trim() : null

  const charger = useCallback(async (depuis: number) => {
    const requete = ++requeteRef.current
    setLoading(true)
    setErreur(false)
    const { data, error } = await supabase.rpc('rechercher_destinataires_campagne', {
      p_campagne_id: campagneId,
      p_statut: onglet,
      p_recherche: termeRecherche,
      p_limit: PAGE_DESTINATAIRES,
      p_offset: depuis,
    })
    if (requete !== requeteRef.current) return
    setLoading(false)
    if (error) {
      setErreur(true)
      return
    }
    const page = (data ?? []) as (Destinataire & { total_count: number })[]
    setLignes((prev) => (depuis === 0 ? page : [...prev, ...page]))
    if (page.length > 0) setTotal(Number(page[0].total_count))
    else if (depuis === 0) setTotal(0)
  }, [campagneId, onglet, termeRecherche])

  useEffect(() => {
    // Nouvel onglet ou nouvelle recherche : on vide la liste et on repart de la première page.
    setLignes([])
    setTotal(0)
    void charger(0)
  }, [charger])

  const compteursOk = compteurs !== null && compteurs !== 'erreur' ? compteurs : null
  const totalOnglet = compteursOk?.[onglet] ?? 0
  const restants = total - lignes.length
  const compteAffiche = (statut: Onglet) => (compteurs === 'erreur' ? '—' : compteursOk?.[statut])

  // Campagne enregistrée sans aucune ligne : adhérents tous supprimés, ou détail non écrit à l'envoi.
  if (compteursOk && compteursOk.envoye + compteursOk.exclu === 0) {
    return (
      <DetailField label="Destinataires">
        <span className="text-ink-faint">
          Aucun destinataire à afficher : adhérents supprimés depuis l'envoi, ou détail non enregistré lors de l'envoi.
        </span>
      </DetailField>
    )
  }

  return (
    <div>
      <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Destinataires</p>
      <Tabs
        idPrefix={idPrefix}
        aria-label="Destinataires de la campagne"
        className="mt-1"
        value={onglet}
        onChange={(v) => setOnglet(v)}
        items={[
          { value: 'envoye', label: 'Envoyés', count: compteAffiche('envoye') },
          { value: 'exclu', label: 'Exclus', count: compteAffiche('exclu') },
        ]}
      />
      <div role="tabpanel" id={`${idPrefix}-panel-${onglet}`} aria-labelledby={`${idPrefix}-tab-${onglet}`} className="pt-3">
        {compteurs === 'erreur' && (
          <p role="alert" className="mb-2 text-xs text-stamp">Impossible de compter les destinataires.</p>
        )}
        {(totalOnglet > 10 || compteurs === 'erreur' || recherche !== '') && (
          <Input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou email…"
            aria-label="Rechercher un destinataire"
            className="mb-2"
          />
        )}
        {erreur ? (
          <p role="alert" className="text-sm text-stamp">Impossible de charger les destinataires.</p>
        ) : !loading && lignes.length === 0 ? (
          <p className="text-sm text-ink-faint">
            {termeRecherche ? 'Aucun résultat.' : onglet === 'envoye' ? 'Aucun destinataire à afficher.' : 'Aucun exclu.'}
          </p>
        ) : (
          <ul className="divide-y divide-paper-border-muted">
            {lignes.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <p className="break-words font-medium text-ink">{d.nom}</p>
                {d.courriel && <p className="break-all text-xs text-ink-muted">{d.courriel}</p>}
                {d.raison_exclusion && <p className="mt-0.5 font-registre-mono text-[11px] text-warning">{RAISON_EXCLUSION_LABELS[d.raison_exclusion]}</p>}
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="py-2 text-sm text-ink-faint">Chargement…</p>}
        {!loading && !erreur && restants > 0 && (
          <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={() => void charger(lignes.length)}>
            Afficher plus ({pluriel(restants, 'restant')})
          </Button>
        )}
        {compteursOk && compteursOk.envoye + compteursOk.exclu < attendus && (
          <p className="mt-2 text-xs text-ink-faint">
            Les adhérents supprimés depuis l'envoi n'apparaissent plus ; les compteurs restent ceux de l'envoi.
          </p>
        )}
      </div>
    </div>
  )
}
