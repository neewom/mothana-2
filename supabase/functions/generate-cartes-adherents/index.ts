import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Adherent {
  id: string
  civilite: number
  nom: string
  prenom: string | null
  id_externe: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

interface AdhesionRow {
  adherent_id: string
  date_debut: string
  date_fin: string | null
}

interface ModeleRecu {
  president_nom?: string
  president_titre?: string
}

interface Organisation {
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  modele_recu_pdf: ModeleRecu | null
}

interface OrganisationAsset {
  identifiant: string
  url: string
}

// ---------------------------------------------------------------------------
// Constantes / helpers
// ---------------------------------------------------------------------------

const MAX_ADHERENTS = 200
// Grille 2 colonnes x 5 rangées de cartes 85,6x54mm sur une page A4 (marges 10mm).
const CARDS_PER_PAGE = 10

const CIVILITE_ADHERENT_LABELS: Record<number, string> = {
  0: '',
  1: 'Monsieur',
  2: 'Madame',
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '')
}

// Mise en page planche A4 fixe, non éditable — distincte du gabarit de
// l'organisation (qui ne définit que le contenu/style d'une carte `.carte`).
const GRID_CSS = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.page { display: grid; grid-template-columns: repeat(2, 85.6mm); grid-auto-rows: 54mm; row-gap: 1.4mm; column-gap: 4mm; justify-content: center; align-content: start; page-break-after: always; }
.page:last-child { page-break-after: auto; }
`

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const { adherent_ids } = await req.json()
    if (!Array.isArray(adherent_ids) || adherent_ids.length === 0) {
      return jsonResponse({ error: 'Aucun adhérent sélectionné' }, 400)
    }
    if (adherent_ids.length > MAX_ADHERENTS) {
      return jsonResponse({ error: `Trop d'adhérents sélectionnés (maximum ${MAX_ADHERENTS})` }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const gotenbergUrl = Deno.env.get('GOTENBERG_URL')!

    // Verify caller's identity
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

    // Caller must be admin for an organisation
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
    // 1. Gabarit actif
    // ---------------------------------------------------------------------

    const { data: template } = await adminClient
      .from('templates_carte_adherent')
      .select('html_template, css')
      .eq('organisation_id', organisationId)
      .eq('is_active', true)
      .eq('is_archived', false)
      .maybeSingle()

    if (!template) {
      return jsonResponse(
        { error: 'Aucun gabarit de carte actif configuré. Contactez votre administrateur.' },
        422,
      )
    }

    // ---------------------------------------------------------------------
    // 2. Organisation + assets
    // ---------------------------------------------------------------------

    const { data: org } = await adminClient
      .from('organisations')
      .select('nom, adresse, code_postal, ville, modele_recu_pdf')
      .eq('id', organisationId)
      .single()

    if (!org) {
      return jsonResponse({ error: 'Organisation introuvable' }, 404)
    }

    const organisation = org as unknown as Organisation
    const modele = organisation.modele_recu_pdf ?? {}

    const { data: assetsData } = await adminClient
      .from('organisation_assets')
      .select('identifiant, url')
      .eq('organisation_id', organisationId)

    const assetPlaceholders: Record<string, string> = {}
    for (const asset of (assetsData ?? []) as OrganisationAsset[]) {
      assetPlaceholders[`asset_${asset.identifiant}`] = asset.url
    }

    // ---------------------------------------------------------------------
    // 3. Adhérents demandés — filtrés par organisation, jamais de confiance
    //    aveugle dans les ids fournis par le client.
    // ---------------------------------------------------------------------

    const { data: adherentsData } = await adminClient
      .from('adherents')
      .select('id, civilite, nom, prenom, id_externe, adresse, code_postal, ville')
      .eq('organisation_id', organisationId)
      .in('id', adherent_ids)

    const adherents = (adherentsData ?? []) as Adherent[]

    if (adherents.length === 0) {
      return jsonResponse({ error: 'Aucun adhérent trouvé pour cette organisation' }, 404)
    }

    const { data: adhesionsData } = await adminClient
      .from('adhesions')
      .select('adherent_id, date_debut, date_fin')
      .in('adherent_id', adherents.map((a) => a.id))
      .order('date_debut', { ascending: false })

    const latestAdhesionByAdherent = new Map<string, AdhesionRow>()
    for (const adhesion of (adhesionsData ?? []) as AdhesionRow[]) {
      if (!latestAdhesionByAdherent.has(adhesion.adherent_id)) {
        latestAdhesionByAdherent.set(adhesion.adherent_id, adhesion)
      }
    }

    // ---------------------------------------------------------------------
    // 4. Rendu de chaque carte + assemblage en planche A4
    // ---------------------------------------------------------------------

    const cardsHtml = adherents.map((adherent) => {
      const adhesion = latestAdhesionByAdherent.get(adherent.id)
      const nomComplet = adherent.prenom
        ? `${adherent.prenom} ${adherent.nom.toUpperCase()}`
        : adherent.nom.toUpperCase()

      const placeholders: Record<string, string> = {
        organisation_nom: organisation.nom ?? '',
        organisation_adresse: organisation.adresse ?? '',
        organisation_code_postal: organisation.code_postal ?? '',
        organisation_ville: organisation.ville ?? '',
        adherent_civilite: CIVILITE_ADHERENT_LABELS[adherent.civilite] ?? '',
        adherent_nom_complet: nomComplet,
        adherent_id_externe: adherent.id_externe ?? '',
        adherent_adresse: adherent.adresse ?? '',
        adherent_code_postal: adherent.code_postal ?? '',
        adherent_ville: adherent.ville ?? '',
        adhesion_date_debut: adhesion ? formatDate(adhesion.date_debut) : '',
        adhesion_date_fin: adhesion?.date_fin ? formatDate(adhesion.date_fin) : '',
        president_nom: modele.president_nom ?? '',
        president_titre: modele.president_titre ?? '',
        ...assetPlaceholders,
      }

      return renderTemplate(template.html_template, placeholders)
    })

    const pages: string[] = []
    for (let i = 0; i < cardsHtml.length; i += CARDS_PER_PAGE) {
      pages.push(`<div class="page">${cardsHtml.slice(i, i + CARDS_PER_PAGE).join('')}</div>`)
    }

    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${GRID_CSS}${template.css ?? ''}</style></head><body>${pages.join('')}</body></html>`

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

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cartes-adherents.pdf"',
      },
    })
  } catch (err) {
    console.error('generate-cartes-adherents error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
