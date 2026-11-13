import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCanonicalSiteUrl } from '../lib/environment'
import { correspondRecherche } from '../lib/textSearch'
import { doublonsDemande, type DemandeComparable } from '../lib/inscription'
import type { DemandeInscription } from '../types'
import ScrollShadowX from './ScrollShadowX'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ListToolbar } from './ui/list-toolbar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const COLONNES =
  'id, nom_association, ville, rna, siren, prenom, nom, email, message, cgu_acceptees_le, statut, organisation_id, traitee_par, traitee_le, admin_utilisateur_id, invitation_envoyee_le, erreur_invitation, created_at'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Demande acceptée dont l'invitation reste à (re)envoyer. */
function invitationARelancer(d: DemandeInscription) {
  return d.statut === 'acceptee' && !d.invitation_envoyee_le
}

interface Props {
  /** Organisation créée (liste des organisations à recharger) et message de confirmation. */
  onOrganisationCreee: (message: string) => void
  onMessage: (message: string) => void
}

/**
 * Demandes d'inscription (carte hNqpdZXL) : demandes en attente, et demandes acceptées dont
 * l'invitation a échoué. « Créer l'organisation » passe par l'Edge Function
 * valider-demande-inscription ; « Refuser » met la demande en `refusee`, sans email. Les demandes
 * `a_confirmer` (adresse pas encore confirmée par le lien envoyé par email) n'apparaissent ni dans
 * la liste, ni dans le compteur, ni dans les doublons : les requêtes ne lisent que les statuts
 * en_attente et acceptee.
 */
export default function DemandesInscriptionSection({ onOrganisationCreee, onMessage }: Props) {
  const [demandes, setDemandes] = useState<DemandeInscription[]>([])
  // Demandes en attente ou acceptées (toutes), pour signaler les doublons possibles.
  const [comparables, setComparables] = useState<DemandeComparable[]>([])
  const [loading, setLoading] = useState(true)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [ouverte, setOuverte] = useState<DemandeInscription | null>(null)
  const [nomOrganisation, setNomOrganisation] = useState('')
  const [confirmerRefus, setConfirmerRefus] = useState(false)
  const [action, setAction] = useState<'creation' | 'refus' | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setErreurChargement(null)
    const { data, error } = await supabase
      .from('demandes_inscription')
      .select(COLONNES)
      .or('statut.eq.en_attente,and(statut.eq.acceptee,invitation_envoyee_le.is.null)')
      .order('created_at', { ascending: true })
    const { data: autres } = await supabase
      .from('demandes_inscription')
      .select('id, nom_association, email, statut')
      .in('statut', ['en_attente', 'acceptee'])
    if (error) setErreurChargement(error.message)
    else setDemandes((data ?? []) as DemandeInscription[])
    setComparables((autres ?? []) as DemandeComparable[])
    setLoading(false)
  }, [])

  useEffect(() => { charger() }, [charger])

  const enAttente = demandes.filter((d) => d.statut === 'en_attente').length
  const trouvees = demandes.filter((d) => correspondRecherche([d.nom_association, d.ville, d.email, `${d.prenom} ${d.nom}`], recherche))

  function ouvrir(d: DemandeInscription) {
    setOuverte(d)
    setNomOrganisation(d.nom_association)
    setConfirmerRefus(false)
    setErreurAction(null)
  }

  function fermer() {
    if (action) return
    setOuverte(null)
  }

  async function creerOrganisation() {
    if (!ouverte) return
    setAction('creation')
    setErreurAction(null)
    const { data: sessionData } = await supabase.auth.getSession()
    let res: Response
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/valider-demande-inscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ demande_id: ouverte.id, nom: nomOrganisation, site_url: getCanonicalSiteUrl() }),
      })
    } catch {
      setErreurAction('Serveur injoignable, réessaie dans un instant.')
      setAction(null)
      return
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string; invitation_envoyee?: boolean; erreur_invitation?: string | null }
    setAction(null)
    if (!res.ok) {
      setErreurAction(json.error ?? `Erreur lors de la création (${res.status})`)
      await charger()
      return
    }
    const nom = invitationARelancer(ouverte) ? ouverte.nom_association : nomOrganisation.trim()
    if (json.invitation_envoyee) {
      onOrganisationCreee(
        invitationARelancer(ouverte)
          ? `Invitation renvoyée à ${ouverte.email}`
          : `« ${nom} » créée, invitation envoyée à ${ouverte.email}`,
      )
      setOuverte(null)
      await charger()
      return
    }
    // Organisation créée mais invitation en échec : la fiche reste ouverte avec l'erreur.
    onOrganisationCreee(`« ${nom} » créée, mais l’invitation n’est pas partie`)
    await charger()
    setOuverte((d) => (d ? { ...d, statut: 'acceptee', erreur_invitation: json.erreur_invitation ?? 'Invitation non envoyée' } : d))
  }

  async function refuser() {
    if (!ouverte) return
    setAction('refus')
    setErreurAction(null)
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('demandes_inscription')
      .update({ statut: 'refusee', traitee_par: userData.user?.id ?? null, traitee_le: new Date().toISOString() })
      .eq('id', ouverte.id)
      .eq('statut', 'en_attente')
      .select('id')
    setAction(null)
    if (error || !data || data.length === 0) {
      setErreurAction(error?.message ?? 'Cette demande a déjà été traitée.')
      await charger()
      return
    }
    onMessage(`Demande de « ${ouverte.nom_association} » refusée (aucun email envoyé)`)
    setOuverte(null)
    await charger()
  }

  const nomValide = nomOrganisation.trim().length >= 2 && nomOrganisation.trim().length <= 150

  return (
    <div className="rounded-sm border border-paper-border bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">Demandes d’inscription</h2>
        {enAttente > 0 && (
          <Badge variant="warning" aria-label={`${enAttente} demande${enAttente > 1 ? 's' : ''} en attente`}>
            {enAttente} en attente
          </Badge>
        )}
      </div>
      {demandes.length > 0 && (
        <ListToolbar
          search={{ value: recherche, onChange: setRecherche, placeholder: 'Association, ville, email…', label: 'Rechercher une demande' }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-ink-faint">Chargement…</div>
      ) : erreurChargement ? (
        <div className="m-6 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{erreurChargement}</div>
      ) : demandes.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">Aucune demande en attente.</p>
      ) : trouvees.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">Aucune demande ne correspond à cette recherche.</p>
      ) : (
        <ScrollShadowX>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Association</TableHead>
                <TableHead className="hidden md:table-cell">Demandeur</TableHead>
                <TableHead>Reçue le</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trouvees.map((d) => (
                <TableRow
                  key={d.id}
                  tabIndex={0}
                  onClick={() => ouvrir(d)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(d) } }}
                  className="cursor-pointer hover:bg-paper-border/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stamp/70"
                >
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium text-ink">{d.nom_association}</div>
                    <div className="flex items-center gap-2 text-xs text-ink-faint">
                      {d.ville}
                      {invitationARelancer(d) && <Badge variant="warning">Invitation à relancer</Badge>}
                      {doublonsDemande(d, comparables).length > 0 && <Badge variant="warning">Doublon possible</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">
                    <div className="text-ink-muted">{d.prenom} {d.nom}</div>
                    <div className="text-xs text-ink-faint">{d.email}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-muted">{formatDate(d.created_at)}</TableCell>
                  <TableCell className="text-ink-faint" aria-hidden="true">›</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollShadowX>
      )}

      <Dialog open={!!ouverte} onOpenChange={(next) => { if (!next) fermer() }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          {ouverte && (
            <>
              <DialogHeader>
                <div className="pr-8">
                  <DialogTitle>{ouverte.nom_association}</DialogTitle>
                  <p className="mt-0.5 font-registre text-xs text-ink-faint">Demande reçue le {formatDate(ouverte.created_at)}</p>
                </div>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                {invitationARelancer(ouverte) && (
                  <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
                    <p className="font-medium">Organisation créée, invitation non envoyée.</p>
                    {ouverte.erreur_invitation && <p className="mt-1 break-words">{ouverte.erreur_invitation}</p>}
                    <p className="mt-1">Tu peux relancer l’invitation ici, ou ajouter un compte depuis la fiche de l’organisation.</p>
                  </div>
                )}

                {doublonsDemande(ouverte, comparables).length > 0 && (
                  <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
                    <p className="font-medium">Doublon possible</p>
                    <ul className="mt-1 space-y-0.5">
                      {doublonsDemande(ouverte, comparables).map((a) => (
                        <li key={a.id} className="break-words">
                          {a.nom_association} · {a.email} ({a.statut === 'acceptee' ? 'acceptée' : 'en attente'})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink-faint">Ville</dt>
                  <dd className="text-ink">{ouverte.ville}</dd>
                  <dt className="text-ink-faint">RNA</dt>
                  <dd className="font-registre-mono text-ink">{ouverte.rna ?? '—'}</dd>
                  <dt className="text-ink-faint">SIREN</dt>
                  <dd className="font-registre-mono text-ink">{ouverte.siren ?? '—'}</dd>
                  <dt className="text-ink-faint">Demandeur</dt>
                  <dd className="text-ink">{ouverte.prenom} {ouverte.nom}</dd>
                  <dt className="text-ink-faint">Email</dt>
                  <dd className="break-all text-ink">{ouverte.email}</dd>
                  {ouverte.cgu_acceptees_le && (
                    <>
                      <dt className="text-ink-faint">CGU</dt>
                      <dd className="text-ink">Acceptées le {formatDate(ouverte.cgu_acceptees_le)}</dd>
                    </>
                  )}
                </dl>

                {ouverte.message && (
                  <div>
                    <p className="text-sm text-ink-faint">Message</p>
                    <p className="mt-1 whitespace-pre-line break-words rounded-sm border border-paper-border bg-paper px-3 py-2 text-sm text-ink-muted">{ouverte.message}</p>
                  </div>
                )}

                {ouverte.statut === 'en_attente' && (
                  <div className="space-y-1.5 border-t border-paper-border pt-5">
                    <Label htmlFor="demande-nom-organisation">Nom de l’organisation à créer</Label>
                    <Input
                      id="demande-nom-organisation"
                      type="text"
                      value={nomOrganisation}
                      maxLength={150}
                      onChange={(e) => setNomOrganisation(e.target.value)}
                    />
                    <p className="text-xs text-ink-faint">
                      Dons et adhérents activés{ouverte.rna || ouverte.siren ? ', RNA / SIREN reportés' : ''}. L’admin reçoit son invitation à {ouverte.email}.
                    </p>
                  </div>
                )}

                {erreurAction && (
                  <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{erreurAction}</div>
                )}
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-paper-border bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                {ouverte.statut === 'en_attente' ? (
                  confirmerRefus ? (
                    <>
                      <p className="text-sm text-ink-muted">Refuser cette demande ? Aucun email n’est envoyé.</p>
                      <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => setConfirmerRefus(false)} disabled={!!action}>
                          Annuler
                        </Button>
                        <Button type="button" variant="destructive" onClick={refuser} disabled={!!action}>
                          {action === 'refus' ? 'Refus…' : 'Refuser'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="danger" onClick={() => setConfirmerRefus(true)} disabled={!!action}>
                        Refuser
                      </Button>
                      <Button type="button" onClick={creerOrganisation} disabled={!!action || !nomValide}>
                        {action === 'creation' ? 'Création…' : 'Créer l’organisation'}
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={fermer} disabled={!!action}>
                      Fermer
                    </Button>
                    <Button type="button" onClick={creerOrganisation} disabled={!!action}>
                      {action === 'creation' ? 'Envoi…' : 'Relancer l’invitation'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
