import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import qrcodeGenerator from 'https://esm.sh/qrcode-generator@1.4.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Adherent {
  civilite: number
  nom: string
  prenom: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  tags: string[]
}

interface Organisation {
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

interface Activite {
  id: string
  nom: string
}

const CIVILITE_LABELS: Record<number, string> = {
  0: '',
  1: 'Monsieur',
  2: 'Madame',
}

// Planche Avery L7163 et équivalents (référence mesurée sur l'exemple fourni
// par l'utilisateur) : 99,1 x 38,1mm, 2 colonnes x 7 lignes = 14 étiquettes/A4.
const LABELS_PER_PAGE = 14

// Mise en page fixe, non éditable (contrainte physique de la planche
// adhésive, cf. cadrage) — distincte du gabarit Cerfa/carte adhérent.
const GRID_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
.page {
  display: grid;
  grid-template-columns: repeat(2, 99.1mm);
  grid-auto-rows: 38.1mm;
  column-gap: 2.5mm;
  row-gap: 0mm;
  justify-content: center;
  padding-top: 15.1mm;
  page-break-after: always;
}
.page:last-child { page-break-after: auto; }
.label {
  width: 99.1mm;
  height: 38.1mm;
  padding: 3mm;
  overflow: hidden;
  font-size: 8.5pt;
  line-height: 1.25;
}
.label-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2mm;
  background: #e5e5e5;
  margin: -3mm -3mm 2mm -3mm;
  padding: 1.5mm 2mm;
}
.label-header .expediteur {
  font-size: 6.5pt;
  line-height: 1.3;
  min-width: 0;
}
.label-header .qr {
  width: 9mm;
  height: 9mm;
  flex-shrink: 0;
}
.label-header .qr svg { display: block; width: 100%; height: 100%; }
.label-dest-nom {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 9.5pt;
  margin-bottom: 1mm;
}
`

function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function selectionLabel(filtreStatut: string, tagEnvoi: string | null): string {
  if (tagEnvoi) return `Liste : ${tagEnvoi}`
  if (filtreStatut === 'archive') return 'Adhérents archivés'
  if (filtreStatut === 'tous') return 'Tous les adhérents'
  return 'Adhérents actifs'
}

function buildQrSvg(text: string): string {
  const qr = qrcodeGenerator(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ scalable: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const { activite_id, filtre_statut, tag_envoi, exclude_tag } = await req.json()

    if (!activite_id || typeof activite_id !== 'string') {
      return jsonResponse({ error: 'Activité requise' }, 400)
    }
    if (!['actif', 'archive', 'tous'].includes(filtre_statut)) {
      return jsonResponse({ error: 'Filtre de statut invalide' }, 400)
    }
    if (tag_envoi !== null && tag_envoi !== undefined && typeof tag_envoi !== 'string') {
      return jsonResponse({ error: 'Liste de diffusion invalide' }, 400)
    }
    if (exclude_tag !== null && exclude_tag !== undefined && typeof exclude_tag !== 'string') {
      return jsonResponse({ error: "Liste d'exclusion invalide" }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const gotenbergUrl = Deno.env.get('GOTENBERG_URL')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: profilOrg } = await adminClient
      .from('profils_organisation')
      .select('organisation_id, role')
      .eq('utilisateur_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!profilOrg) {
      return jsonResponse({ error: 'Accès refusé' }, 403)
    }

    const organisationId = profilOrg.organisation_id

    // ---------------------------------------------------------------------
    // 1. Organisation (expéditeur) + activité
    // ---------------------------------------------------------------------

    const { data: orgData } = await adminClient
      .from('organisations')
      .select('nom, adresse, code_postal, ville')
      .eq('id', organisationId)
      .single()

    if (!orgData) {
      return jsonResponse({ error: 'Organisation introuvable' }, 404)
    }
    const organisation = orgData as Organisation

    const { data: activiteData } = await adminClient
      .from('activites')
      .select('id, nom')
      .eq('organisation_id', organisationId)
      .eq('id', activite_id)
      .single()

    if (!activiteData) {
      return jsonResponse({ error: 'Activité introuvable pour cette organisation' }, 404)
    }
    const activite = activiteData as Activite

    // ---------------------------------------------------------------------
    // 2. Destinataires — même logique de filtre que send-mailing-brevo
    // ---------------------------------------------------------------------

    let query = adminClient
      .from('adherents')
      .select('civilite, nom, prenom, adresse, code_postal, ville, tags')
      .eq('organisation_id', organisationId)

    if (tag_envoi) {
      query = query.contains('tags', [tag_envoi])
    } else if (filtre_statut !== 'tous') {
      query = query.eq('statut', filtre_statut)
    }

    const { data: adherentsData, error: adherentsError } = await query

    if (adherentsError) {
      console.error('adherents query error:', adherentsError)
      return jsonResponse({ error: 'Erreur lors du chargement des adhérents' }, 500)
    }

    const tousAdherents = ((adherentsData ?? []) as Adherent[]).filter(
      (a) => !exclude_tag || !(a.tags ?? []).includes(exclude_tag),
    )
    const destinataires = tousAdherents.filter(
      (a) => a.adresse?.trim() && a.code_postal?.trim() && a.ville?.trim(),
    )
    const nombreExclus = tousAdherents.length - destinataires.length

    if (destinataires.length === 0) {
      return jsonResponse({ error: 'Aucun destinataire avec une adresse postale complète' }, 422)
    }

    // ---------------------------------------------------------------------
    // 3. QR code (identique sur toutes les étiquettes de cette génération :
    //    identifie la campagne, pas le destinataire individuel)
    // ---------------------------------------------------------------------

    const qrText = `${activite.nom} — ${formatDateFr(new Date())}`
    const qrSvg = buildQrSvg(qrText)

    // ---------------------------------------------------------------------
    // 4. Rendu de chaque étiquette + assemblage en planche A4
    // ---------------------------------------------------------------------

    const expediteurHtml = `<div class="expediteur">Expéditeur : ${organisation.nom}<br>${[organisation.adresse, organisation.code_postal, organisation.ville].filter(Boolean).join(' ')}</div>`

    const labelsHtml = destinataires.map((a) => {
      const civilite = CIVILITE_LABELS[a.civilite] ?? ''
      const nomComplet = [civilite, a.nom, a.prenom].filter(Boolean).join(' ')
      return `<div class="label">
        <div class="label-header">${expediteurHtml}<div class="qr">${qrSvg}</div></div>
        <div class="label-dest-nom">${nomComplet}</div>
        <div>${a.adresse}</div>
        <div>${a.code_postal} ${a.ville}</div>
      </div>`
    })

    const pages: string[] = []
    for (let i = 0; i < labelsHtml.length; i += LABELS_PER_PAGE) {
      pages.push(`<div class="page">${labelsHtml.slice(i, i + LABELS_PER_PAGE).join('')}</div>`)
    }

    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${GRID_CSS}</style></head><body>${pages.join('')}</body></html>`

    // ---------------------------------------------------------------------
    // 5. Conversion HTML -> PDF via Gotenberg
    // ---------------------------------------------------------------------

    const gotenbergForm = new FormData()
    gotenbergForm.append('files', new Blob([fullHtml], { type: 'text/html' }), 'index.html')

    const gotenbergRes = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: gotenbergForm,
    })

    if (!gotenbergRes.ok) {
      const detail = await gotenbergRes.text()
      console.error('Gotenberg error:', gotenbergRes.status, detail)
      return jsonResponse({ error: 'Erreur lors de la génération du PDF' }, 500)
    }

    const pdfBuffer = new Uint8Array(await gotenbergRes.arrayBuffer())

    // ---------------------------------------------------------------------
    // 6. Historique
    // ---------------------------------------------------------------------

    const { error: historiqueError } = await adminClient.from('campagnes_courrier').insert({
      organisation_id: organisationId,
      activite_id: activite.id,
      selection_label: selectionLabel(filtre_statut, tag_envoi ?? null),
      nombre_destinataires: destinataires.length,
      nombre_exclus: nombreExclus,
      genere_par: user.id,
    })

    if (historiqueError) {
      console.error('Historique insert error:', historiqueError)
      // Non-bloquant : la génération a réussi, seul l'historique échoue
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="campagne-courrier.pdf"',
        'X-Nombre-Destinataires': String(destinataires.length),
        'X-Nombre-Exclus': String(nombreExclus),
      },
    })
  } catch (err) {
    console.error('generate-campagne-courrier error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
