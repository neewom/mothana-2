// navigator.clipboard n'est disponible qu'en contexte sécurisé (HTTPS/localhost) —
// indisponible sur l'URL réseau HTTP utilisée pour piloter l'instance de dev à
// distance. Repli sur execCommand('copy'), qui fonctionne aussi en HTTP.
// Résout à true si la copie a réussi, pour ne pas confirmer une copie ratée.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return legacyCopyToClipboard(text)
    }
  }
  return legacyCopyToClipboard(text)
}

function legacyCopyToClipboard(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  // Une modale ouverte piège le focus : un champ ajouté hors de la modale ne
  // peut pas être sélectionné, et execCommand ne copie alors rien.
  const container = document.activeElement?.closest('[role="dialog"]') ?? document.body
  container.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    // pas de solution de repli supplémentaire — l'utilisateur devra copier manuellement
  }
  container.removeChild(textarea)
  return copied
}
