/** Minutos que tiene un día completo: el fin del día es 24:00. */
export const MINUTES_PER_DAY = 1440

/** Espacio vertical mínimo entre etiquetas de hora, en píxeles. */
export const MIN_LABEL_SPACING_PX = 18

/**
 * Pasos de etiqueta admitidos. Las etiquetas base son cada hora; cuando la
 * grilla se comprime se muestran cada 2, 3, 4, 6 o 12 horas. La granularidad
 * de edición no cambia: solo cambia cada cuánto se rotula.
 */
const LABEL_STEP_CANDIDATES = [60, 120, 180, 240, 360, 720] as const

/**
 * Paso de etiqueta que deja al menos `minSpacingPx` entre rótulos sin tocar la
 * granularidad de edición. Si ni el paso máximo entra, se queda en 12 horas:
 * la grilla no scrollea, solo rotula menos.
 */
export function adaptiveLabelStepMinutes(
  granularityMinutes: number,
  rowHeightPx: number,
  minSpacingPx = MIN_LABEL_SPACING_PX
): number {
  const granularity = Math.max(1, granularityMinutes)
  const rowHeight = Number.isFinite(rowHeightPx) ? Math.max(0, rowHeightPx) : 0
  for (const step of LABEL_STEP_CANDIDATES) {
    if (step < granularity) continue
    if ((step / granularity) * rowHeight >= minSpacingPx) return step
  }
  return LABEL_STEP_CANDIDATES[LABEL_STEP_CANDIDATES.length - 1]
}

/** Recorta un valor de minutos al rango pedido (por defecto, a un día). */
export function clampMinutes(value: number, min = 0, max = MINUTES_PER_DAY): number {
  return Math.max(min, Math.min(value, max))
}
