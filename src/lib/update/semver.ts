type Parsed = [number, number, number]

/**
 * Parsea una versión tolerante: acepta "v" opcional, 2 o 3 componentes y
 * descarta cualquier sufijo (p. ej. "-beta.1"). Devuelve null si no hay
 * una versión reconocible.
 */
function parse(version: string): Parsed | null {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

function compare(a: Parsed, b: Parsed): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * Indica si `latest` es una versión más nueva que `current`.
 *
 * - Si `current` es null/undefined/vacío, cualquier `latest` válida cuenta
 *   como nueva (caso "todavía no me avisaron de nada").
 * - Si alguna de las dos no es una versión reconocible, devuelve false:
 *   ante la duda no ofrecemos una actualización.
 */
export function isNewerVersion(latest: string, current: string | null | undefined): boolean {
  const next = parse(latest)
  if (!next) return false
  if (current == null || current.trim() === '') return true
  const currentParsed = parse(current)
  if (!currentParsed) return false
  return compare(next, currentParsed) > 0
}
