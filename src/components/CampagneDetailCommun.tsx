import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs } from './ui/tabs'
import { DetailField } from './ui/side-panel'

// Éléments communs du panneau de détail d'une campagne de l'historique, Emailing et Courrier
// (cartes « détail figé et notes », 2026-11-09 et 2026-11-10) : notes et liste des destinataires
// / exclus (onglets, recherche serveur, pagination). Chaque canal fournit sa table, ses RPC et
// ses libellés.

// Affichage par pages : une campagne peut viser plusieurs milliers d'adhérents.
const PAGE_DESTINATAIRES = 50
const NOTES_MAX = 5000

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

export function NotesCampagne({
  campagneId,
  notes,
  rpc,
  onSaved,
}: {
  campagneId: string
  notes: string | null
  rpc: 'modifier_note_campagne_mailing' | 'modifier_note_campagne_courrier'
  onSaved: (id: string, notes: string | null) => void
}) {
  const id = useId()
  const [valeur, setValeur] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)

  const modifie = valeur.trim() !== (notes ?? '').trim()
  const tropLongue = valeur.length > NOTES_MAX

  async function enregistrer() {
    setSaving(true)
    setErreur(null)
    setEnregistre(false)
    const { error } = await supabase.rpc(rpc, { p_campagne_id: campagneId, p_notes: valeur })
    setSaving(false)
    if (error) {
      setErreur(error.message.includes('ACCES_REFUSE') ? "Vous n'avez pas le droit de modifier cette note." : "La note n'a pas pu être enregistrée. Réessayez.")
      return
    }
    const nouvelles = valeur.trim() || null
    setValeur(nouvelles ?? '')
    setEnregistre(true)
    onSaved(campagneId, nouvelles)
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

/** Table, RPC et libellés de la liste des destinataires d'un canal. */
export interface ConfigDestinataires {
  table: 'campagnes_mailing_destinataires' | 'campagnes_courrier_destinataires'
  rpc: 'rechercher_destinataires_campagne' | 'rechercher_destinataires_campagne_courrier'
  /** Statut des destinataires retenus en base (`envoye` pour l'Emailing, `genere` pour le Courrier). */
  statutRetenus: string
  /** Libellé de l'onglet des destinataires retenus (« Envoyés », « Destinataires »). */
  libelleRetenus: string
  /** Information figée affichée sous le nom (email ou adresse), renvoyée par la RPC. */
  champSecondaire: 'courriel' | 'adresse'
  placeholderRecherche: string
  raisons: Record<string, string>
  /** Message quand la campagne n'a plus aucune ligne. */
  messageAucuneLigne: string
  /** Note sous la liste quand des adhérents ont été supprimés depuis la campagne. */
  noteSupprimes: string
}

interface Destinataire {
  id: string
  nom: string
  courriel?: string | null
  adresse?: string | null
  raison_exclusion: string | null
}

type Onglet = 'retenus' | 'exclu'

export function DestinatairesCampagne({ campagneId, attendus, config }: { campagneId: string; attendus: number; config: ConfigDestinataires }) {
  const idPrefix = useId()
  const [onglet, setOnglet] = useState<Onglet>('retenus')
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
  const { table, rpc, statutRetenus } = config
  const statutOnglet = onglet === 'retenus' ? statutRetenus : 'exclu'

  // Compteurs par onglet (lignes encore présentes : un adhérent supprimé emporte la sienne).
  useEffect(() => {
    let annule = false
    const compter = (statut: string) =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('campagne_id', campagneId).eq('statut', statut)
    Promise.all([compter(statutRetenus), compter('exclu')]).then(([retenus, exclu]) => {
      if (annule) return
      if (retenus.error || exclu.error || retenus.count === null || exclu.count === null) {
        setCompteurs('erreur')
        return
      }
      setCompteurs({ retenus: retenus.count, exclu: exclu.count })
    })
    return () => { annule = true }
  }, [campagneId, table, statutRetenus])

  // Recherche serveur (RPC, sans accents ni casse), ignorée sous 2 caractères.
  const termeRecherche = rechercheDiffere.trim().length >= 2 ? rechercheDiffere.trim() : null

  const charger = useCallback(async (depuis: number) => {
    const requete = ++requeteRef.current
    setLoading(true)
    setErreur(false)
    const { data, error } = await supabase.rpc(rpc, {
      p_campagne_id: campagneId,
      p_statut: statutOnglet,
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
  }, [campagneId, rpc, statutOnglet, termeRecherche])

  useEffect(() => {
    // Nouvel onglet ou nouvelle recherche : on vide la liste et on repart de la première page.
    setLignes([])
    setTotal(0)
    void charger(0)
  }, [charger])

  const compteursOk = compteurs !== null && compteurs !== 'erreur' ? compteurs : null
  const totalOnglet = compteursOk?.[onglet] ?? 0
  const restants = total - lignes.length
  const compteAffiche = (o: Onglet) => (compteurs === 'erreur' ? '—' : compteursOk?.[o])

  // Campagne enregistrée sans aucune ligne : adhérents tous supprimés, ou détail non écrit à l'envoi.
  if (compteursOk && compteursOk.retenus + compteursOk.exclu === 0) {
    return (
      <DetailField label="Destinataires">
        <span className="text-ink-faint">{config.messageAucuneLigne}</span>
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
          { value: 'retenus', label: config.libelleRetenus, count: compteAffiche('retenus') },
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
            placeholder={config.placeholderRecherche}
            aria-label="Rechercher un destinataire"
            className="mb-2"
          />
        )}
        {erreur ? (
          <p role="alert" className="text-sm text-stamp">Impossible de charger les destinataires.</p>
        ) : !loading && lignes.length === 0 ? (
          <p className="text-sm text-ink-faint">
            {termeRecherche ? 'Aucun résultat.' : onglet === 'retenus' ? 'Aucun destinataire à afficher.' : 'Aucun exclu.'}
          </p>
        ) : (
          <ul className="divide-y divide-paper-border-muted">
            {lignes.map((d) => {
              const secondaire = d[config.champSecondaire]
              return (
                <li key={d.id} className="py-2 text-sm">
                  <p className="break-words font-medium text-ink">{d.nom}</p>
                  {secondaire && (
                    <p className={`${config.champSecondaire === 'courriel' ? 'break-all' : 'break-words'} text-xs text-ink-muted`}>{secondaire}</p>
                  )}
                  {d.raison_exclusion && (
                    <p className="mt-0.5 font-registre-mono text-[11px] text-warning">{config.raisons[d.raison_exclusion] ?? d.raison_exclusion}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {loading && <p className="py-2 text-sm text-ink-faint">Chargement…</p>}
        {!loading && !erreur && restants > 0 && (
          <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={() => void charger(lignes.length)}>
            Afficher plus ({pluriel(restants, 'restant')})
          </Button>
        )}
        {compteursOk && compteursOk.retenus + compteursOk.exclu < attendus && (
          <p className="mt-2 text-xs text-ink-faint">{config.noteSupprimes}</p>
        )}
      </div>
    </div>
  )
}
