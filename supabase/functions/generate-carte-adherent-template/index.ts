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

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 Mo décodés
const ALLOWED_MEDIA_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])

// Mêmes placeholders que src/lib/cartePreview.ts (frontend) — dupliqués ici
// comme le reste des constantes métier de generate-cartes-adherents, pas
// d'import possible entre le code front (Vite/TS) et cette fonction Deno.
// asset_logo/asset_signature : les deux noms conventionnels utilisés par le
// gabarit par défaut (defaultCarteAdherentTemplate.ts) — une organisation
// peut en configurer d'autres dans Paramètres > Identité visuelle, mais s'en
// tenir à ces deux-là est le choix le plus sûr pour un brouillon généré.
const PLACEHOLDER_DESCRIPTIONS = `
- organisation_nom : nom de l'organisme (ex : "Wat Velouvanaram")
- adherent_civilite : civilité de l'adhérent (ex : "Monsieur") — optionnel
- adherent_nom_complet : nom complet de l'adhérent (ex : "Jean DUPONT")
- adhesion_date_debut : date de début de validité de l'adhésion (ex : "15/01/2026")
- adhesion_date_fin : date de fin de validité de l'adhésion (ex : "15/01/2027")
- president_nom : nom du président de l'organisme — optionnel
- president_titre : titre du président (ex : "Président") — optionnel
- asset_logo : URL du logo de l'organisme, à utiliser dans <img src="{{asset_logo}}"> — optionnel
- asset_signature : URL de la signature du président, à utiliser dans <img src="{{asset_signature}}"> — optionnel
`.trim()

const GENERATE_CARTE_TEMPLATE_TOOL = {
  name: 'generate_carte_template',
  description: 'Enregistre le brouillon de gabarit de carte adhérent généré à partir du modèle fourni.',
  input_schema: {
    type: 'object',
    properties: {
      html_template: {
        type: 'string',
        description:
          'Fragment HTML de la carte, avec un unique conteneur racine de classe "carte" (ex : <div class="carte">...</div>), reproduisant la mise en page du modèle fourni, avec les placeholders {{cle}} substitués aux informations variables.',
      },
      css: {
        type: 'string',
        description: 'CSS associé, dimensionnant .carte à 85,6mm x 54mm (format carte de crédit ISO/IEC 7810).',
      },
      nom_suggestion: {
        type: 'string',
        description: 'Nom suggéré pour ce gabarit (ex : "Modèle importé — <nom association>").',
      },
    },
    required: ['html_template', 'css', 'nom_suggestion'],
  },
}

const PROMPT = `Tu reçois un modèle de carte adhérent (PDF ou image) utilisé par une association. Analyse sa mise en page et son contenu, puis génère un brouillon de gabarit HTML+CSS pour l'application Mothana.

Règles impératives :
1. Le format cible est une carte de crédit standard (ISO/IEC 7810), 85,6 x 54 mm — reproduis autant que possible la disposition visuelle et le style (couleurs, polices) du modèle fourni, adaptés à ce format compact.
2. Le conteneur racine du HTML doit être un unique élément avec la classe "carte" (ex : <div class="carte">...</div>), dimensionné à 85,6mm x 54mm dans le CSS.
3. Repère les informations variables (nom de l'adhérent, dates de validité, nom de l'organisme, logo, signature...) et remplace-les par le placeholder correspondant EXACTEMENT parmi cette liste (n'invente jamais une nouvelle clé, n'utilise que celles-ci) :

${PLACEHOLDER_DESCRIPTIONS}

4. Le HTML doit être un simple fragment (pas de <html>/<head>/<body>). Le CSS doit être autonome.
5. Utilise l'outil "generate_carte_template" pour renvoyer ta réponse — n'écris aucun texte en dehors de l'appel d'outil.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const { file_base64, media_type } = await req.json()

    if (!file_base64 || typeof file_base64 !== 'string') {
      return jsonResponse({ error: 'Fichier manquant' }, 400)
    }
    if (typeof media_type !== 'string' || !ALLOWED_MEDIA_TYPES.has(media_type)) {
      return jsonResponse({ error: 'Format de fichier non supporté (PDF, PNG ou JPEG uniquement)' }, 400)
    }

    // Taille décodée approximative (base64 gonfle ~33%)
    const approxBytes = (file_base64.length * 3) / 4
    if (approxBytes > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Le fichier dépasse la taille maximale autorisée (4 Mo).' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY non configurée')
      return jsonResponse({ error: 'Service indisponible (configuration manquante)' }, 500)
    }

    // Vérifie l'identité de l'appelant
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

    // ---------------------------------------------------------------------
    // Appel Anthropic Messages API (vision + tool use forcé)
    // ---------------------------------------------------------------------

    const contentBlock = media_type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type, data: file_base64 } }
      : { type: 'image', source: { type: 'base64', media_type, data: file_base64 } }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 8000,
        tools: [GENERATE_CARTE_TEMPLATE_TOOL],
        tool_choice: { type: 'tool', name: 'generate_carte_template' },
        messages: [
          {
            role: 'user',
            content: [contentBlock, { type: 'text', text: PROMPT }],
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, detail)
      return jsonResponse({ error: "Erreur lors de l'analyse du modèle" }, 502)
    }

    const anthropicJson = await anthropicRes.json()
    const toolUse = (anthropicJson.content ?? []).find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUse) {
      console.error('Réponse Anthropic sans tool_use:', JSON.stringify(anthropicJson))
      return jsonResponse({ error: "Réponse inattendue lors de l'analyse du modèle" }, 502)
    }

    const { html_template, css, nom_suggestion } = toolUse.input ?? {}

    if (!html_template || typeof html_template !== 'string' || !css || typeof css !== 'string') {
      return jsonResponse({ error: 'Le brouillon généré est incomplet, réessayez.' }, 502)
    }

    return jsonResponse({
      html_template,
      css,
      nom_suggestion: typeof nom_suggestion === 'string' && nom_suggestion ? nom_suggestion : 'Gabarit importé (à vérifier)',
    })
  } catch (err) {
    console.error('generate-carte-adherent-template error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
