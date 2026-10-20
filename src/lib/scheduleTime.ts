/** Minutos que tiene un día completo: el fin del día es 24:00. */
export const MINUTES_PER_DAY = 1440

/** Recorta un valor de minutos al rango pedido (por defecto, a un día). */
export function clampMinutes(value: number, min = 0, max = MINUTES_PER_DAY): number {
  return Math.max(min, Math.min(value, max))
}
