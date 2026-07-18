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

interface Personne {
  nom: string
  prenom: string | null
  email: string | null
  civilite: number | null
  nom2: string | null
  prenom2: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
}

interface ModeleRecu {
  rna?: string
  siren?: string
  objet_social?: string
  mention_legale?: string
  numero_recu_depart?: number
  taux_reduction?: number
}

interface Organisation {
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  modele_recu_pdf: ModeleRecu | null
}

// ---------------------------------------------------------------------------
// Helpers de formatage
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatMontant(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

// French number-to-words (integers up to 999 999, then cents)
function numberToWords(amount: number): string {
  const units = [
    '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf',
  ]

  function belowHundred(n: number): string {
    if (n < 20) return units[n]
    const t = Math.floor(n / 10)
    const u = n % 10
    if (t === 7) return 'soixante-' + units[10 + u]
    if (t === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + units[u]
    if (t === 9) return 'quatre-vingt-' + units[10 + u]
    const sep = u === 1 ? '-et-' : u > 0 ? '-' : ''
    return ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][t] + sep + (u > 0 ? units[u] : '')
  }

  function belowThousand(n: number): string {
    if (n < 100) return belowHundred(n)
    const h = Math.floor(n / 100)
    const r = n % 100
    const hundreds = h === 1 ? 'cent' : units[h] + ' cent'
    if (r === 0) return h === 1 ? 'cent' : units[h] + ' cents'
    return hundreds + ' ' + belowHundred(r)
  }

  const euros = Math.floor(amount)
  const cents = Math.round((amount - euros) * 100)

  let words = ''
  if (euros === 0) {
    words = 'zéro'
  } else if (euros < 1000) {
    words = belowThousand(euros)
  } else {
    const thousands = Math.floor(euros / 1000)
    const remainder = euros % 1000
    words = (thousands === 1 ? 'mille' : belowThousand(thousands) + ' mille')
    if (remainder > 0) words += ' ' + belowThousand(remainder)
  }

  if (cents > 0) {
    words += ' euro' + (euros > 1 ? 's' : '') + ' et ' + belowHundred(cents) + ' centime' + (cents > 1 ? 's' : '')
  } else {
    words += ' euro' + (euros > 1 ? 's' : '')
  }

  return words.charAt(0).toUpperCase() + words.slice(1)
}

function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '')
}

// ---------------------------------------------------------------------------
// Règles métier — regles-recus-fiscaux.md
// ---------------------------------------------------------------------------

function validateOrganisation(org: Organisation): string[] {
  const modele = org.modele_recu_pdf ?? {}
  const missing: string[] = []
  if (!org.nom) missing.push("nom de l'organisation")
  if (!org.adresse) missing.push('adresse')
  if (!org.code_postal) missing.push('code postal')
  if (!org.ville) missing.push('ville')
  if (!modele.rna && !modele.siren) missing.push('RNA ou SIREN')
  if (!modele.objet_social) missing.push('objet social')
  if (!modele.mention_legale) missing.push('mention légale')
  return missing
}

interface ParticipantValidation {
  blocking: boolean
  missing: string[]
  message?: string
}

function validateParticipant(p: Personne): ParticipantValidation {
  if (p.civilite === 7) {
    return {
      blocking: true,
      missing: [],
      message:
        "Les dons enregistrés au nom d'une famille ne permettent pas de générer un reçu fiscal. " +
        'Identifiez le foyer fiscal (Mr & Mme) ou le donateur individuel.',
    }
  }

  if (!p.civilite) {
    return {
      blocking: true,
      missing: [],
      message: 'Civilité du donateur manquante — impossible de déterminer le type de reçu à générer.',
    }
  }

  const missing: string[] = []
  if (!p.nom) missing.push('nom')
  if (!p.adresse) missing.push('adresse')
  if (!p.code_postal) missing.push('code postal')
  if (!p.ville) missing.push('ville')
  if ((p.civilite === 1 || p.civilite === 2 || p.civilite === 3 || p.civilite === 4) && !p.prenom) {
    missing.push('prénom')
  }

  return { blocking: missing.length > 0, missing }
}

function determineTypeCerfa(civilite: number): '11580' | '16216' {
  return civilite === 5 || civilite === 6 ? '16216' : '11580'
}

// Règles de formatage du nom du donateur — brief-cerfa.md §4
function buildDonorName(p: Personne): string {
  const nomMaj = p.nom.toUpperCase()

  if (p.civilite === 4) {
    if (p.nom2 || p.prenom2) {
      const coSignataire = [p.prenom2, p.nom2?.toUpperCase()].filter(Boolean).join(' ')
      return `M. ${p.prenom} ${nomMaj} et Mme ${coSignataire}`
    }
    return `M. et Mme ${p.prenom} ${nomMaj}`
  }

  if (p.civilite === 5 || p.civilite === 6) {
    return p.nom
  }

  const titles: Record<number, string> = { 1: 'M.', 2: 'Mme', 3: 'Mlle' }
  const title = p.civilite ? titles[p.civilite] : ''
  return [title, p.prenom, nomMaj].filter(Boolean).join(' ')
}

function buildDonorCivilite(civilite: number): string {
  const labels: Record<number, string> = {
    1: 'Monsieur',
    2: 'Madame',
    3: 'Mademoiselle',
    4: 'Monsieur et Madame',
    5: '',
    6: '',
  }
  return labels[civilite] ?? ''
}

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

    const { profil_participant_id, annee } = await req.json()
    const anneeNum = Number(annee)
    if (!profil_participant_id || !annee || Number.isNaN(anneeNum)) {
      return jsonResponse({ error: 'Paramètres manquants' }, 400)
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
    // 1. Valider l'organisation
    // ---------------------------------------------------------------------

    const { data: org } = await adminClient
      .from('organisations')
      .select('nom, adresse, code_postal, ville, pays, modele_recu_pdf')
      .eq('id', organisationId)
      .single()

    if (!org) {
      return jsonResponse({ error: 'Organisation introuvable' }, 404)
    }

    const organisation = org as unknown as Organisation
    const orgMissing = validateOrganisation(organisation)
    if (orgMissing.length > 0) {
      return jsonResponse(
        {
          error: `Paramètres de l'organisation incomplets : ${orgMissing.join(', ')}. Complétez-les dans Paramètres.`,
          missing_fields: orgMissing,
        },
        422,
      )
    }

    // ---------------------------------------------------------------------
    // 2. Valider le participant
    // ---------------------------------------------------------------------

    const { data: participant } = await adminClient
      .from('profils_participant')
      .select('id, organisation_id, personnes(nom, prenom, email, civilite, nom2, prenom2, adresse, code_postal, ville, pays)')
      .eq('id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .single()

    if (!participant) {
      return jsonResponse({ error: 'Participant non trouvé' }, 404)
    }

    const personne = participant.personnes as unknown as Personne
    const participantValidation = validateParticipant(personne)
    if (participantValidation.blocking) {
      return jsonResponse(
        {
          error: participantValidation.message ?? `Champs manquants pour le donateur : ${participantValidation.missing.join(', ')}`,
          missing_fields: participantValidation.missing,
        },
        422,
      )
    }

    // ---------------------------------------------------------------------
    // 3. Dons de l'année
    // ---------------------------------------------------------------------

    const { data: dons } = await adminClient
      .from('dons')
      .select('montant, date, mode_paiement')
      .eq('profil_participant_id', profil_participant_id)
      .gte('date', `${anneeNum}-01-01`)
      .lte('date', `${anneeNum}-12-31`)
      .order('date', { ascending: true })

    if (!dons || dons.length === 0) {
      return jsonResponse({ error: 'Aucun don pour cette année' }, 404)
    }

    const totalMontant = dons.reduce((sum, d) => sum + Number(d.montant), 0)

    // ---------------------------------------------------------------------
    // 4. Type de Cerfa + template actif
    // ---------------------------------------------------------------------

    const typeCerfa = determineTypeCerfa(personne.civilite!)

    const { data: template } = await adminClient
      .from('templates_recu')
      .select('id, html_template, css')
      .eq('organisation_id', organisationId)
      .eq('type_cerfa', typeCerfa)
      .eq('is_active', true)
      .eq('is_archived', false)
      .maybeSingle()

    if (!template) {
      return jsonResponse(
        { error: `Aucun modèle de reçu actif configuré pour le type ${typeCerfa}. Contactez le support.` },
        422,
      )
    }

    // ---------------------------------------------------------------------
    // 5. Numéro d'ordre — conservé si régénération
    // ---------------------------------------------------------------------

    const { data: existingRecu } = await adminClient
      .from('recus_fiscaux')
      .select('numero_ordre')
      .eq('profil_participant_id', profil_participant_id)
      .eq('annee', anneeNum)
      .maybeSingle()

    let numeroOrdre = existingRecu?.numero_ordre as string | null

    if (!numeroOrdre) {
      const { data: numeroData, error: numeroError } = await adminClient.rpc('next_numero_recu', {
        org_id: organisationId,
        annee: anneeNum,
      })
      if (numeroError || !numeroData) {
        console.error('next_numero_recu error:', numeroError)
        return jsonResponse({ error: "Erreur lors de l'attribution du numéro de reçu" }, 500)
      }
      numeroOrdre = numeroData as string
    }

    // ---------------------------------------------------------------------
    // 6. Snapshots + placeholders
    // ---------------------------------------------------------------------

    const modele = organisation.modele_recu_pdf ?? {}
    const tauxReduction = typeCerfa === '16216' ? 60 : modele.taux_reduction ?? 66

    const snapshotDonateur = {
      nom: personne.nom,
      prenom: personne.prenom,
      civilite: personne.civilite,
      nom2: personne.nom2,
      prenom2: personne.prenom2,
      adresse: personne.adresse,
      code_postal: personne.code_postal,
      ville: personne.ville,
      pays: personne.pays,
      email: personne.email,
    }

    const snapshotOrganisation = {
      nom: organisation.nom,
      adresse: organisation.adresse,
      code_postal: organisation.code_postal,
      ville: organisation.ville,
      pays: organisation.pays,
      rna: modele.rna ?? null,
      siren: modele.siren ?? null,
      objet_social: modele.objet_social ?? null,
      mention_legale: modele.mention_legale ?? null,
      taux_reduction: tauxReduction,
    }

    const placeholders: Record<string, string> = {
      organisation_nom: organisation.nom ?? '',
      organisation_adresse: organisation.adresse ?? '',
      organisation_code_postal: organisation.code_postal ?? '',
      organisation_ville: organisation.ville ?? '',
      organisation_rna: modele.rna ?? '',
      organisation_siren: modele.siren ?? '',
      organisation_objet_social: modele.objet_social ?? '',
      organisation_mention_legale: modele.mention_legale ?? '',
      donateur_civilite: buildDonorCivilite(personne.civilite!),
      donateur_nom_complet: buildDonorName(personne),
      donateur_adresse: personne.adresse ?? '',
      donateur_code_postal: personne.code_postal ?? '',
      donateur_ville: personne.ville ?? '',
      don_montant_chiffres: formatMontant(totalMontant),
      don_montant_lettres: numberToWords(totalMontant),
      don_annee: String(anneeNum),
      recu_numero_ordre: numeroOrdre,
      recu_date_generation: formatDate(new Date().toISOString().split('T')[0]),
      type_reduction: `${tauxReduction}%`,
    }

    const bodyHtml = renderTemplate(template.html_template, placeholders)
    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${template.css ?? ''}</style></head><body>${bodyHtml}</body></html>`

    // ---------------------------------------------------------------------
    // 7. Conversion HTML -> PDF via Gotenberg
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
    // 8. Upload Storage
    // ---------------------------------------------------------------------

    const storagePath = `${organisationId}/${anneeNum}/${numeroOrdre}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('recus-fiscaux')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return jsonResponse({ error: 'Erreur upload PDF', detail: uploadError.message }, 500)
    }

    // ---------------------------------------------------------------------
    // 9. Upsert recus_fiscaux
    // ---------------------------------------------------------------------

    const { error: upsertError } = await adminClient
      .from('recus_fiscaux')
      .upsert(
        {
          profil_participant_id,
          organisation_id: organisationId,
          annee: anneeNum,
          montant_total: totalMontant,
          fichier_url: storagePath,
          date_generation: new Date().toISOString(),
          numero_ordre: numeroOrdre,
          type_cerfa: typeCerfa,
          template_id: template.id,
          snapshot_donateur: snapshotDonateur,
          snapshot_organisation: snapshotOrganisation,
        },
        { onConflict: 'profil_participant_id,annee' },
      )

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      // Non-blocking: PDF was uploaded, return success anyway
    }

    return jsonResponse({ fichier_url: storagePath, numero_ordre: numeroOrdre, type_cerfa: typeCerfa })
  } catch (err) {
    console.error('generate-recu error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
