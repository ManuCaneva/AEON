import { MINUTES_PER_DAY } from './scheduleTime'

export interface ScheduleDragGeometry {
  /** Días habilitados, en el orden de las columnas visibles. */
  enabledDays: number[]
  /** Minuto del borde superior de la grilla. */
  windowStart: number
  /** Píxeles por minuto según la Ventana visible vigente. */
  minuteHeightPx: number
}

/** Una hora visible más cada vez que el puntero se acerca a un borde. */
export const WINDOW_GROWTH_STEP_MINUTES = 60

/** Cada cuánto vuelve a crecer la ventana mientras el puntero sigue en la banda. */
export const WINDOW_GROWTH_INTERVAL_MS = 350

/** Distancia al borde superior o inferior que dispara el crecimiento. */
export const WINDOW_GROWTH_EDGE_PX = 40

/** Banda de borde en la que el puntero pide crecer la ventana. */
export type WindowGrowthEdge = 'top' | 'bottom'

export interface ScheduleDragPoint {
  /** `day_of_week` real (0 = lunes … 6 = domingo). */
  day: number
  /** Minuto del día, sin cuantizar a la granularidad. */
  minutes: number
  clientX: number
  clientY: number
}

/** Minuto del día que corresponde a una altura de puntero sobre la grilla. */
export function pointerToScheduleMinutes(
  clientY: number,
  rect: { top: number },
  geometry: Pick<ScheduleDragGeometry, 'windowStart' | 'minuteHeightPx'>
): number {
  return geometry.minuteHeightPx > 0
    ? Math.round(geometry.windowStart + (clientY - rect.top) / geometry.minuteHeightPx)
    : geometry.windowStart
}

export function pointerToSchedulePosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  geometry: ScheduleDragGeometry
): ScheduleDragPoint {
  const count = Math.max(1, geometry.enabledDays.length)
  const columnWidth = rect.width > 0 ? rect.width / count : 0
  const column =
    columnWidth > 0
      ? Math.min(count - 1, Math.max(0, Math.floor((clientX - rect.left) / columnWidth)))
      : 0

  return {
    day: geometry.enabledDays[column],
    minutes: pointerToScheduleMinutes(clientY, rect, geometry),
    clientX,
    clientY,
  }
}

/** Banda de borde que alcanza el puntero, o `null` si está lejos de ambas. */
export function growthEdgeAt(
  pointerY: number,
  rect: { top: number; bottom: number }
): WindowGrowthEdge | null {
  if (pointerY - rect.top <= WINDOW_GROWTH_EDGE_PX) return 'top'
  if (rect.bottom - pointerY <= WINDOW_GROWTH_EDGE_PX) return 'bottom'
  return null
}

/**
 * Ventana visible durante un gesto: crece una hora hacia la banda alcanzada.
 * La cantidad de horas la decide quien llama (una por acercamiento); esta
 * función solo aplica un paso. La ventana base no se toca: al soltar se vuelve
 * a derivar del rango de los horarios.
 */
export function growWindowAtEdge(
  window: { start_minutes: number; end_minutes: number },
  edge: WindowGrowthEdge | null
): { start_minutes: number; end_minutes: number } {
  if (edge === 'top') {
    return {
      start_minutes: Math.max(0, window.start_minutes - WINDOW_GROWTH_STEP_MINUTES),
      end_minutes: window.end_minutes,
    }
  }
  if (edge === 'bottom') {
    return {
      start_minutes: window.start_minutes,
      end_minutes: Math.min(MINUTES_PER_DAY, window.end_minutes + WINDOW_GROWTH_STEP_MINUTES),
    }
  }
  return { start_minutes: window.start_minutes, end_minutes: window.end_minutes }
}
