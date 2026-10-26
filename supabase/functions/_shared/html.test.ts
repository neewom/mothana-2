// deno test --no-lock supabase/functions/_shared/html.test.ts
import { escapeHtmlTexte, renderTemplate } from './html.ts'

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
