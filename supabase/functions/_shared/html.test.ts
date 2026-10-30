// deno test --no-lock supabase/functions/_shared/html.test.ts
import { convertirHtmlEnPdf, escapeHtmlTexte, renderTemplate } from './html.ts'

function egal(obtenu: string, attendu: string) {
  if (obtenu !== attendu) throw new Error(`attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
}

Deno.test('une valeur contenant du HTML actif est rendue en texte', () => {
  egal(
    renderTemplate('<p>{{nom}}</p>', { nom: '<img src=x onerror=alert(1)><script>alert(2)</script>' }),
    '<p>&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;</p>',
  )
})

Deno.test('une valeur ne peut pas sortir d\'un attribut', () => {
  egal(renderTemplate('<img src="{{asset_logo}}">', { asset_logo: '" onerror="alert(1)' }), '<img src="&quot; onerror=&quot;alert(1)">')
})

Deno.test('les <br> saisis dans la configuration sont conservés, sans attribut', () => {
  egal(escapeHtmlTexte('Ligne 1<br />\nLigne 2<BR>'), 'Ligne 1<br>\nLigne 2<br>')
  egal(escapeHtmlTexte('<br onclick="x">'), '&lt;br onclick=&quot;x&quot;&gt;')
})

Deno.test('les fragments HTML déclarés sont insérés tels quels, les variables inconnues vides', () => {
  egal(
    renderTemplate('{{dons_detail}}|{{nom}}|{{inconnue}}', { dons_detail: '<table></table>', nom: '<b>' }, new Set(['dons_detail'])),
    '<table></table>|&lt;b&gt;|',
  )
})

// --- convertirHtmlEnPdf : authentification Basic et délai ---

type AppelCapture = { url: string; init: RequestInit }

function fetchCapture(appels: AppelCapture[], status = 200): typeof fetch {
  return ((url: string, init: RequestInit) => {
    appels.push({ url, init })
    return Promise.resolve(new Response('%PDF', { status }))
  }) as unknown as typeof fetch
}

function envDe(valeurs: Record<string, string>) {
  return (nom: string) => valeurs[nom]
}

Deno.test('avec identifiant et mot de passe, l\'en-tête Basic est envoyé', async () => {
  const appels: AppelCapture[] = []
  await convertirHtmlEnPdf('https://gotenberg.test', new FormData(), {
    env: envDe({ GOTENBERG_USERNAME: 'mothana', GOTENBERG_PASSWORD: 'p@ss:é' }),
    fetchFn: fetchCapture(appels),
  })
  egal(appels.length.toString(), '1')
  egal(appels[0].url, 'https://gotenberg.test/forms/chromium/convert/html')
  const attendu = 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode('mothana:p@ss:é')))
  egal(new Headers(appels[0].init.headers).get('Authorization') ?? '', attendu)
  egal(attendu, 'Basic bW90aGFuYTpwQHNzOsOp')
})

for (const [cas, valeurs] of [
  ['sans aucun secret', {}],
  ['sans mot de passe', { GOTENBERG_USERNAME: 'mothana' }],
  ['sans identifiant', { GOTENBERG_PASSWORD: 'secret' }],
  ['avec un mot de passe vide', { GOTENBERG_USERNAME: 'mothana', GOTENBERG_PASSWORD: '' }],
] as const) {
  Deno.test(`${cas}, aucun en-tête n'est envoyé`, async () => {
    const appels: AppelCapture[] = []
    await convertirHtmlEnPdf('https://gotenberg.test', new FormData(), {
      env: envDe(valeurs as Record<string, string>),
      fetchFn: fetchCapture(appels),
    })
    egal(String(appels[0].init.headers), 'undefined')
    egal(appels[0].init.method ?? '', 'POST')
  })
}

function fetchQuiAttendLAnnulation(): typeof fetch {
  return ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    })) as unknown as typeof fetch
}

Deno.test('le délai passé en paramètre est respecté', async () => {
  const debut = Date.now()
  let erreur = ''
  try {
    await convertirHtmlEnPdf('https://gotenberg.test', new FormData(), {
      timeoutMs: 50,
      env: envDe({}),
      fetchFn: fetchQuiAttendLAnnulation(),
    })
  } catch (e) {
    erreur = (e as Error).name
  }
  egal(erreur, 'TimeoutError')
  const duree = Date.now() - debut
  if (duree < 40 || duree > 2_000) throw new Error(`durée inattendue : ${duree} ms`)
})

Deno.test('sans délai précisé, la conversion n\'est pas interrompue avant 60 s', async () => {
  const appels: AppelCapture[] = []
  await convertirHtmlEnPdf('https://gotenberg.test', new FormData(), { env: envDe({}), fetchFn: fetchCapture(appels) })
  egal(String(appels[0].init.signal?.aborted), 'false')
})

Deno.test('un 401 est renvoyé à l\'appelant et journalisé sans secret', async () => {
  const messages: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => { messages.push(args.join(' ')) }
  try {
    const res = await convertirHtmlEnPdf('https://gotenberg.test', new FormData(), {
      env: envDe({ GOTENBERG_USERNAME: 'mothana', GOTENBERG_PASSWORD: 'tres-secret' }),
      fetchFn: fetchCapture([], 401),
    })
    egal(res.status.toString(), '401')
  } finally {
    console.error = original
  }
  egal(messages.length.toString(), '1')
  const journal = messages[0]
  if (!journal.includes('401')) throw new Error(`message sans statut : ${journal}`)
  for (const secret of ['mothana', 'tres-secret', 'Basic ', btoa('mothana:tres-secret')]) {
    if (journal.includes(secret)) throw new Error(`secret journalisé : ${secret}`)
  }
})
