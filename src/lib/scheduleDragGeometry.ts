export interface ScheduleDragGeometry {
  /** Días habilitados, en el orden de las columnas visibles. */
  enabledDays: number[]
  /** Minuto del borde superior de la grilla. */
  windowStart: number
  /** Píxeles por minuto según la Ventana visible vigente. */
  minuteHeightPx: number
}

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
