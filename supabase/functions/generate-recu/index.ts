import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatMontant(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' \u20ac'
}

interface Personne {
  nom: string
  prenom: string | null
  email: string | null
  civilite: number | null
  nom2: string | null
  prenom2: string | null
}

const CIVILITE_TITLES: Record<number, string> = {
  1: 'Monsieur',
  2: 'Madame',
  3: 'Mademoiselle',
  5: 'Soci\u00e9t\u00e9',
  6: 'Association',
  7: 'Famille',
}

function buildDonorName(p: Personne): string {
  const fullName = [p.prenom, p.nom].filter(Boolean).join(' ')

  if (p.civilite === 4) {
    if (p.nom2 || p.prenom2) {
      const coSignataire = [p.prenom2, p.nom2].filter(Boolean).join(' ')
      return `Monsieur ${fullName} et Madame ${coSignataire}`
    }
    return `Monsieur et Madame ${p.nom}`
  }

  if (p.civilite === 5 || p.civilite === 6 || p.civilite === 7) {
    return `${CIVILITE_TITLES[p.civilite]} ${p.nom}`
  }

  if (p.civilite && CIVILITE_TITLES[p.civilite]) {
    return `${CIVILITE_TITLES[p.civilite]} ${fullName}`
  }

  return fullName
}

function wrapText(text: string, charWidth: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length * charWidth > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
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
    words = 'zero'
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
      return new Response(
        JSON.stringify({ error: 'Non autorise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { profil_participant_id, annee } = await req.json()
    if (!profil_participant_id || !annee) {
      return new Response(
        JSON.stringify({ error: 'Parametres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller's identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
      return new Response(
        JSON.stringify({ error: 'Acces refuse' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const organisationId = profilOrg.organisation_id

    // Verify participant belongs to this org and get their info
    const { data: participant } = await adminClient
      .from('profils_participant')
      .select('id, organisation_id, personnes(nom, prenom, email, civilite, nom2, prenom2)')
      .eq('id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .single()

    if (!participant) {
      return new Response(
        JSON.stringify({ error: 'Participant non trouve' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch dons for this participant in the given year
    const { data: dons } = await adminClient
      .from('dons')
      .select('montant, date, mode_paiement')
      .eq('profil_participant_id', profil_participant_id)
      .gte('date', `${annee}-01-01`)
      .lte('date', `${annee}-12-31`)
      .order('date', { ascending: true })

    if (!dons || dons.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun don pour cette annee' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const totalMontant = dons.reduce((sum, d) => sum + Number(d.montant), 0)

    // Fetch organisation info
    const { data: org } = await adminClient
      .from('organisations')
      .select('nom')
      .eq('id', organisationId)
      .single()

    const orgNom = org?.nom ?? ''
    const personne = participant.personnes as unknown as Personne
    const donorName = buildDonorName(personne)

    // ---------------------------------------------------------------------------
    // Generate PDF
    // ---------------------------------------------------------------------------

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 in points
    const { width, height } = page.getSize()

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const M = 50 // margin
    const colRight = width / 2 + 10
    const black = rgb(0, 0, 0)
    const darkGray = rgb(0.25, 0.25, 0.25)
    const lightGray = rgb(0.92, 0.92, 0.92)
    const midGray = rgb(0.6, 0.6, 0.6)
    const white = rgb(1, 1, 1)
    const indigo = rgb(0.24, 0.32, 0.71)

    let y = height - M

    // --- Header bar ---
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: indigo })
    page.drawText('RECU FISCAL', { x: M, y: height - 40, size: 20, font: fontBold, color: white })
    page.drawText('Article 200 du Code General des Impots', { x: M, y: height - 60, size: 9, font: fontReg, color: rgb(0.8, 0.85, 1) })
    page.drawText(`Annee ${annee}`, {
      x: width - M - fontBold.widthOfTextAtSize(`Annee ${annee}`, 14),
      y: height - 48,
      size: 14,
      font: fontBold,
      color: white,
    })

    y = height - 100

    // --- Two-column info block ---
    y -= 20
    page.drawText('Association', { x: M, y, size: 8, font: fontReg, color: midGray })
    page.drawText('Donateur', { x: colRight, y, size: 8, font: fontReg, color: midGray })

    y -= 18
    page.drawText(orgNom, { x: M, y, size: 12, font: fontBold, color: black })

    const donorColWidth = width - M - colRight
    const donorNameLines = wrapText(donorName, 7.2, donorColWidth)
    let donorY = y
    for (const line of donorNameLines) {
      page.drawText(line, { x: colRight, y: donorY, size: 12, font: fontBold, color: black })
      donorY -= 15
    }

    if (personne.email) {
      page.drawText(personne.email, { x: colRight, y: donorY, size: 9, font: fontReg, color: midGray })
      donorY -= 16
    }

    y = Math.min(y - 16, donorY) - 14

    // Separator
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: lightGray })

    y -= 24

    // --- Certification paragraph ---
    const certText =
      `Nous soussignes, certifions que les versements effectues par ${donorName} ` +
      `au cours de l'annee ${annee} ont ete regus par notre association. ` +
      `Ces dons ouvrent droit a reduction d'impot au titre de l'article 200 du CGI.`

    const certLines = wrapText(certText, 5.6, width - 2 * M)
    for (const line of certLines) {
      page.drawText(line, { x: M, y, size: 9.5, font: fontReg, color: darkGray })
      y -= 15
    }

    y -= 20

    // --- Donations table ---
    const tableWidth = width - 2 * M
    const colDate = M + 10
    const colMode = M + 130
    const colMontant = width - M - 10

    // Table header
    page.drawRectangle({ x: M, y: y - 22, width: tableWidth, height: 26, color: rgb(0.15, 0.18, 0.35) })
    page.drawText('Date', { x: colDate, y: y - 14, size: 8.5, font: fontBold, color: white })
    page.drawText('Mode de paiement', { x: colMode, y: y - 14, size: 8.5, font: fontBold, color: white })
    page.drawText('Montant', { x: colMontant - fontBold.widthOfTextAtSize('Montant', 8.5), y: y - 14, size: 8.5, font: fontBold, color: white })
    y -= 26

    const modeLabels: Record<number, string> = {
      1: 'Espèces',
      2: 'Chèque',
      3: 'Prélèvement - virement',
      4: 'Autres',
    }

    for (let i = 0; i < dons.length; i++) {
      const don = dons[i]
      const rowColor = i % 2 === 0 ? white : lightGray
      page.drawRectangle({ x: M, y: y - 20, width: tableWidth, height: 24, color: rowColor })

      const dateStr = formatDate(don.date)
      const modeStr = modeLabels[don.mode_paiement] ?? 'Autres'
      const montantStr = formatMontant(Number(don.montant))

      page.drawText(dateStr, { x: colDate, y: y - 12, size: 9, font: fontReg, color: black })
      page.drawText(modeStr, { x: colMode, y: y - 12, size: 9, font: fontReg, color: black })
      page.drawText(montantStr, {
        x: colMontant - fontReg.widthOfTextAtSize(montantStr, 9),
        y: y - 12,
        size: 9,
        font: fontReg,
        color: black,
      })
      y -= 24
    }

    // Total row
    page.drawRectangle({ x: M, y: y - 22, width: tableWidth, height: 26, color: rgb(0.93, 0.94, 0.98) })
    page.drawText('TOTAL', { x: colDate, y: y - 14, size: 9, font: fontBold, color: black })
    const totalStr = formatMontant(totalMontant)
    page.drawText(totalStr, {
      x: colMontant - fontBold.widthOfTextAtSize(totalStr, 10),
      y: y - 14,
      size: 10,
      font: fontBold,
      color: indigo,
    })
    y -= 32

    // Amount in words
    const wordsLine = `Soit : ${numberToWords(totalMontant)}`
    page.drawText(wordsLine, { x: M, y, size: 9, font: fontReg, color: midGray })

    y -= 50

    // --- Signature area ---
    const todayStr = formatDate(new Date().toISOString().split('T')[0])
    page.drawText(`Fait le ${todayStr}`, { x: M, y, size: 9, font: fontReg, color: black })
    page.drawText('Signature et cachet :', {
      x: width - M - 170,
      y,
      size: 9,
      font: fontReg,
      color: black,
    })
    page.drawRectangle({
      x: width - M - 170,
      y: y - 70,
      width: 160,
      height: 62,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 1,
    })

    // --- Footer ---
    page.drawLine({ start: { x: M, y: 52 }, end: { x: width - M, y: 52 }, thickness: 0.5, color: lightGray })
    const footerText =
      'Ce recu fiscal est etabli conformement aux dispositions de l\'article 200 du Code General des Impots. ' +
      'Il vous permet de beneficier d\'une reduction d\'impot egale a 66% des sommes versees, ' +
      'dans la limite de 20% de votre revenu imposable.'
    const footerLines = wrapText(footerText, 4.2, width - 2 * M)
    let fy = 44
    for (const line of footerLines) {
      page.drawText(line, { x: M, y: fy, size: 6.5, font: fontReg, color: midGray })
      fy -= 10
    }

    const pdfBytes = await pdfDoc.save()

    // ---------------------------------------------------------------------------
    // Upload to Storage
    // ---------------------------------------------------------------------------

    const storagePath = `${organisationId}/${annee}/${profil_participant_id}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('recus-fiscaux')
      .upload(storagePath, pdfBytes.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Erreur upload PDF', detail: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ---------------------------------------------------------------------------
    // Upsert recus_fiscaux record
    // ---------------------------------------------------------------------------

    const { error: upsertError } = await adminClient
      .from('recus_fiscaux')
      .upsert(
        {
          profil_participant_id,
          organisation_id: organisationId,
          annee,
          montant_total: totalMontant,
          fichier_url: storagePath,
          date_generation: new Date().toISOString(),
        },
        { onConflict: 'profil_participant_id,annee' },
      )

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      // Non-blocking: PDF was uploaded, return success anyway
    }

    return new Response(
      JSON.stringify({ fichier_url: storagePath }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-recu error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
