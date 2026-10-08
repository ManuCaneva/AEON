/**
 * Lógica de posicionamiento de la línea de la hora actual sobre la
 * Ventana visible del cronograma semanal.
 */

/** Minutos transcurridos desde medianoche en hora local. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Top en píxeles de la línea de la hora actual dentro de la Ventana visible.
 * `nowMinutes` son minutos desde medianoche y `minuteHeightPx` el alto de un
 * minuto en la grilla. La ventana es medio abierta: el fin no está incluido.
 * Devuelve null si la hora queda fuera de la ventana (la línea no se dibuja).
 */
export function nowLineTopPx(
  nowMinutes: number,
  visibleWindow: { start_minutes: number; end_minutes: number },
  minuteHeightPx: number
): number | null {
  if (nowMinutes < visibleWindow.start_minutes || nowMinutes >= visibleWindow.end_minutes) {
    return null
  }
  return (nowMinutes - visibleWindow.start_minutes) * minuteHeightPx
}
