// navigator.clipboard n'est disponible qu'en contexte sécurisé (HTTPS/localhost) —
// indisponible sur l'URL réseau HTTP utilisée pour piloter l'instance de dev à
// distance. Repli sur execCommand('copy'), qui fonctionne aussi en HTTP.
export function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopyToClipboard(text))
  } else {
    legacyCopyToClipboard(text)
  }
}

function legacyCopyToClipboard(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand('copy')
  } catch {
    // pas de solution de repli supplémentaire — l'utilisateur devra copier manuellement
  }
  document.body.removeChild(textarea)
}
