// Tracks which modals are currently open, in open order, so that nested
// modals (e.g. ParticipantModal opened from within DonModal) only let the
// topmost one respond to Escape/Tab — otherwise both would react to the
// same keydown event.
let stack: symbol[] = []

export function pushModal(): symbol {
  const id = Symbol()
  stack = [...stack, id]
  return id
}

export function popModal(id: symbol) {
  stack = stack.filter((s) => s !== id)
}

export function isTopModal(id: symbol): boolean {
  return stack[stack.length - 1] === id
}
