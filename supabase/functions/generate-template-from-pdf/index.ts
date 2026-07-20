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

const MAX_PDF_BYTES = 4 * 1024 * 1024 // 4 Mo décodés

// Mêmes 19 placeholders que src/lib/cerfaPreview.ts (frontend) — dupliqués
// ici comme le reste des constantes métier de generate-recu, pas d'import
// possible entre le code front (Vite/TS) et cette fonction Deno.
const PLACEHOLDER_DESCRIPTIONS = `
- organisation_nom : nom de l'organisme (ex : "Wat Velouvanaram")
- organisation_adresse : adresse de l'organisme
- organisation_code_postal : code postal de l'organisme
- organisation_ville : ville de l'organisme
- organisation_rna : numéro RNA de l'organisme (format W + 9 chiffres)
- organisation_siren : numéro SIREN de l'organisme
- organisation_objet_social : objet social de l'organisme
- organisation_mention_legale : mention légale d'éligibilité au mécénat (ex : article 200 du CGI)
- donateur_civilite : civilité du donateur (ex : "Monsieur") — optionnel, déjà inclus dans donateur_nom_complet
- donateur_nom_complet : nom complet formaté du donateur (ex : "M. Jean DUPONT")
- donateur_adresse : adresse du donateur
- donateur_code_postal : code postal du donateur
- donateur_ville : ville du donateur
- don_montant_chiffres : montant du don en chiffres (ex : "150,00 €")
- don_montant_lettres : montant du don en toutes lettres (ex : "Cent cinquante euros")
- don_annee : année du don (ex : "2026")
- recu_numero_ordre : numéro d'ordre du reçu (ex : "2026-042")
- recu_date_generation : date de génération du reçu (ex : "18/07/2026")
- type_reduction : taux de réduction d'impôt applicable (ex : "66%") — optionnel, informatif
`.trim()

const GENERATE_TEMPLATE_TOOL = {
  name: 'generate_template',
  description: 'Enregistre le brouillon de template de reçu Cerfa généré à partir du PDF fourni.',
  input_schema: {
    type: 'object',
    properties: {
      html_template: {
        type: 'string',
        description:
          "Fragment HTML du reçu (sans balises <html>/<body>), reproduisant la mise en page du PDF fourni, avec les placeholders {{cle}} substitués aux informations variables.",
      },
      css: {
        type: 'string',
        description: 'CSS associé au fragment HTML (format A4 imprimable).',
      },
      nom_suggestion: {
        type: 'string',
        description: 'Nom suggéré pour ce template (ex : "Modèle importé — <nom association>").',
      },
    },
    required: ['html_template', 'css', 'nom_suggestion'],
  },
}

function buildPrompt(typeCerfa: '11580' | '16216'): string {
  const typeLabel =
    typeCerfa === '11580'
      ? 'Cerfa 11580 (reçu pour dons de particuliers, articles 200 et 200 bis du CGI)'
      : 'Cerfa 16216 (reçu pour dons d’entreprises, article 238 bis du CGI)'

  return `Tu reçois un PDF de reçu fiscal ${typeLabel} utilisé par une association. Analyse sa mise en page et son contenu, puis génère un brouillon de template HTML+CSS pour l'application Mothana.

Règles impératives :
1. Reproduis autant que possible la structure visuelle, l'ordre des sections et le texte fixe (mentions légales, intitulés) du PDF fourni.
2. Repère les informations variables du reçu (nom/adresse de l'organisme, RNA/SIREN, nom/adresse du donateur, montant en chiffres et en lettres, numéro de reçu, date, taux de réduction...) et remplace-les par le placeholder correspondant EXACTEMENT parmi cette liste (n'invente jamais une nouvelle clé, n'utilise que celles-ci) :

${PLACEHOLDER_DESCRIPTIONS}

3. Si le PDF est un formulaire vierge (sans donnée réelle remplie), place les placeholders aux emplacements logiques d'après les libellés de champs.
4. Le HTML doit être un simple fragment (pas de <html>/<head>/<body>), utilisable tel quel dans un conteneur. Le CSS doit être autonome, pensé pour un rendu A4 imprimable.
5. Utilise l'outil "generate_template" pour renvoyer ta réponse — n'écris aucun texte en dehors de l'appel d'outil.`
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

    const { pdf_base64, type_cerfa } = await req.json()

    if (!pdf_base64 || typeof pdf_base64 !== 'string') {
      return jsonResponse({ error: 'PDF manquant' }, 400)
    }
    if (type_cerfa !== '11580' && type_cerfa !== '16216') {
      return jsonResponse({ error: 'Type Cerfa invalide' }, 400)
    }

    // Taille décodée approximative (base64 gonfle ~33%)
    const approxBytes = (pdf_base64.length * 3) / 4
    if (approxBytes > MAX_PDF_BYTES) {
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
        tools: [GENERATE_TEMPLATE_TOOL],
        tool_choice: { type: 'tool', name: 'generate_template' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 },
              },
              { type: 'text', text: buildPrompt(type_cerfa) },
            ],
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, detail)
      return jsonResponse({ error: "Erreur lors de l'analyse du PDF" }, 502)
    }

    const anthropicJson = await anthropicRes.json()
    const toolUse = (anthropicJson.content ?? []).find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUse) {
      console.error('Réponse Anthropic sans tool_use:', JSON.stringify(anthropicJson))
      return jsonResponse({ error: "Réponse inattendue lors de l'analyse du PDF" }, 502)
    }

    const { html_template, css, nom_suggestion } = toolUse.input ?? {}

    if (!html_template || typeof html_template !== 'string' || !css || typeof css !== 'string') {
      return jsonResponse({ error: "Le brouillon généré est incomplet, réessayez." }, 502)
    }

    return jsonResponse({
      html_template,
      css,
      nom_suggestion: typeof nom_suggestion === 'string' && nom_suggestion ? nom_suggestion : 'Template importé (à vérifier)',
    })
  } catch (err) {
    console.error('generate-template-from-pdf error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
