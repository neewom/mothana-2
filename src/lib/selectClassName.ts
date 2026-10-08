// ui/select enveloppe le <select> dans un wrapper (pour l'icône chevron) : les classes de mise
// en page (largeur, marges, comportement flex/grid) doivent s'appliquer à ce wrapper, sinon
// `w-full` n'élargit que le <select> à l'intérieur d'un wrapper resté à sa taille naturelle.
const LAYOUT_CLASS = /^(?:[a-z0-9-]+:)*!?(?:-?m[trblxy]?-|w-|min-w-|max-w-|flex-|grow|shrink|basis-|self-|justify-self-|col-|row-|order-)/

export function splitSelectClassName(className: string | undefined): { wrapper: string; select: string } {
  const wrapper: string[] = []
  const select: string[] = []
  for (const token of (className ?? '').split(/\s+/).filter(Boolean)) {
    ;(LAYOUT_CLASS.test(token) ? wrapper : select).push(token)
  }
  return { wrapper: wrapper.join(' '), select: select.join(' ') }
}
