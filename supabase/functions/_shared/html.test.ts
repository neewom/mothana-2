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

Deno.test('un <br> saisi est échappé comme toute autre balise', () => {
  egal(escapeHtmlTexte('Ligne 1<br />Ligne 2<BR>'), 'Ligne 1&lt;br /&gt;Ligne 2&lt;BR&gt;')
  egal(renderTemplate('<p>{{objet}}</p>', { objet: '<br onclick="x">' }), '<p>&lt;br onclick=&quot;x&quot;&gt;</p>')
})

Deno.test('les retours à la ligne saisis sont rendus en <br> après échappement', () => {
  egal(escapeHtmlTexte('Ligne 1\nLigne 2\r\nLigne 3\rLigne 4'), 'Ligne 1<br>Ligne 2<br>Ligne 3<br>Ligne 4')
  egal(renderTemplate('<p>{{objet}}</p>', { objet: '<script>alert(1)</script>\nsuite' }), '<p>&lt;script&gt;alert(1)&lt;/script&gt;<br>suite</p>')
})

Deno.test('les fragments HTML déclarés sont insérés tels quels, les variables inconnues vides', () => {
  egal(
    renderTemplate('{{dons_detail}}|{{nom}}|{{inconnue}}', { dons_detail: '<table>\n<tr><td>a<br>b</td></tr></table>', nom: '<b>' }, new Set(['dons_detail'])),
    '<table>\n<tr><td>a<br>b</td></tr></table>|&lt;b&gt;|',
  )
})

Deno.test('une variable au nom d’une propriété héritée (constructor, toString) est vide, sans planter', () => {
  egal(renderTemplate('[{{constructor}}][{{toString}}][{{nom}}]', { nom: 'A' }), '[][][A]')
})
