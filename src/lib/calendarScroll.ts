/** Posición vertical del calendario anual como fracción (0 = arriba, 1 = abajo). */
export const YEARCAL_SCROLL_KEY = 'aeon:yearcal-scroll'

export function clampScrollFraction(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Lee la posición guardada o null si no hay, es inválida o no hay storage. */
export function loadScrollFraction(): number | null {
  try {
    const raw = localStorage.getItem(YEARCAL_SCROLL_KEY)
    if (raw === null) return null
    const v = parseFloat(raw)
    if (!Number.isFinite(v)) return null
    return clampScrollFraction(v)
  } catch {
    return null
  }
}

/** Guarda la posición (siempre clampeada a 0..1). */
export function saveScrollFraction(f: number): void {
  try {
    localStorage.setItem(YEARCAL_SCROLL_KEY, String(clampScrollFraction(f)))
  } catch {
    // Si no se puede persistir, el scroll vive solo en memoria.
  }
}
