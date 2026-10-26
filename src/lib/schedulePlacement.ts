import { MINUTES_PER_DAY, clampMinutes } from './scheduleTime'

/** Rango ocupado del día, en minutos desde la medianoche. */
export interface OccupiedRange {
  start_minutes: number
  end_minutes: number
}

/** Límites del día o de la ventana visible donde se puede ubicar. */
export interface PlacementBounds {
  start_minutes: number
  end_minutes: number
}

const FULL_DAY: PlacementBounds = { start_minutes: 0, end_minutes: MINUTES_PER_DAY }

interface Interval {
  start: number
  end: number
}

/**
 * Busca el inicio libre más cercano al preferido donde entra una unidad completa.
 *
 * Se apoya en los huecos reales del día (no en filas de la grilla), así una unidad
 * entra también en huecos que no empiezan en una fila. Devuelve `null` si no entra.
 */
export function findFreePlacement(
  preferredStart: number,
  unitMinutes: number,
  occupied: readonly OccupiedRange[],
  bounds: PlacementBounds = FULL_DAY
): number | null {
  const windowStart = clampMinutes(bounds.start_minutes)
  const windowEnd = clampMinutes(bounds.end_minutes)
  const unit = Math.max(0, Math.round(unitMinutes))
  if (unit === 0 || windowEnd - windowStart < unit) return null

  const intervals: Interval[] = []
  for (const range of occupied) {
    const start = Math.max(windowStart, clampMinutes(range.start_minutes))
    const end = Math.min(windowEnd, clampMinutes(range.end_minutes))
    if (end > start) intervals.push({ start, end })
  }
  intervals.sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }

  const preferred = clampMinutes(preferredStart, windowStart, windowEnd)
  let best: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let gapStart = windowStart

  // El centinela al final cierra el último hueco del día.
  for (const interval of [...merged, { start: windowEnd, end: windowEnd }]) {
    const gapEnd = interval.start
    if (gapEnd - gapStart >= unit) {
      const candidate = clampMinutes(preferred, gapStart, gapEnd - unit)
      const distance = Math.abs(candidate - preferred)
      if (distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
    gapStart = Math.max(gapStart, interval.end)
  }

  return best
}
