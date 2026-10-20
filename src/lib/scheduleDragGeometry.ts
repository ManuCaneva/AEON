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

/** Distancia al borde superior o inferior que dispara el crecimiento. */
export const WINDOW_GROWTH_EDGE_PX = 40

export interface ScheduleDragPoint {
  /** `day_of_week` real (0 = lunes … 6 = domingo). */
  day: number
  /** Minuto del día, sin cuantizar a la granularidad. */
  minutes: number
  clientX: number
  clientY: number
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
  const minutes =
    geometry.minuteHeightPx > 0
      ? Math.round(geometry.windowStart + (clientY - rect.top) / geometry.minuteHeightPx)
      : geometry.windowStart

  return { day: geometry.enabledDays[column], minutes, clientX, clientY }
}

/**
 * Ventana visible durante un gesto: si el puntero se acerca al borde superior
 * o al inferior crece una hora hacia ese lado. La ventana base no se toca: al
 * soltar se vuelve a derivar del rango de los horarios.
 */
export function growWindowAtEdge(
  window: { start_minutes: number; end_minutes: number },
  pointerY: number,
  rect: { top: number; bottom: number }
): { start_minutes: number; end_minutes: number } {
  const nearTop = pointerY - rect.top <= WINDOW_GROWTH_EDGE_PX
  const nearBottom = rect.bottom - pointerY <= WINDOW_GROWTH_EDGE_PX

  return {
    start_minutes: nearTop
      ? Math.max(0, window.start_minutes - WINDOW_GROWTH_STEP_MINUTES)
      : window.start_minutes,
    end_minutes: nearBottom
      ? Math.min(1440, window.end_minutes + WINDOW_GROWTH_STEP_MINUTES)
      : window.end_minutes,
  }
}
