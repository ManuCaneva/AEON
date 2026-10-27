/**
 * Geometría pura de la mascota del pomodoro: el disco flotante y la pastilla
 * de opciones que aparece bajo él al hacer hover. Toda la matemática vive acá
 * (sin Tauri ni DOM) para poder testearla sola; la ventana y los componentes
 * solo traducen estos rectángulos a llamadas de la API de ventanas.
 *
 * Modelo: la ventana del sistema contiene el disco (un cuadrado de lado
 * `diameter`) más, cuando la pastilla está visible, una franja de
 * `POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT` que crece hacia abajo, o hacia
 * arriba si abajo no entra en el monitor (el disco nunca se mueve).
 */

/** Límites del disco en píxeles lógicos: por debajo el contador no entra. */
export const POMODORO_ORB_MIN_DIAMETER = 140
export const POMODORO_ORB_MAX_DIAMETER = 480
export const POMODORO_ORB_DEFAULT_DIAMETER = 200

/** Pastilla de opciones: alto fijo y separación respecto del disco. */
export const POMODORO_PILL_HEIGHT = 44
export const POMODORO_PILL_GAP = 10

/** Diámetro entero y dentro del rango válido. */
export function clampOrbDiameter(diameter: number): number {
  return Math.min(
    POMODORO_ORB_MAX_DIAMETER,
    Math.max(POMODORO_ORB_MIN_DIAMETER, Math.round(diameter))
  )
}

/**
 * Diámetro con el que se abre la mascota: el guardado del usuario (el ancho;
 * los estados de la mini rectangular guardaban ancho y alto distintos) o el
 * default, nunca fuera del rango.
 */
export function resolveOrbDiameter(state: { width: number | null; height: number | null }): number {
  const guardado = state.width ?? state.height
  return guardado === null ? POMODORO_ORB_DEFAULT_DIAMETER : clampOrbDiameter(guardado)
}

/**
 * Delta acumulado del mouse desde el inicio del gesto de resize → diámetro:
 * derecha o arriba agrandan, izquierda o abajo achican. Al ser acumulado, el
 * mismo delta da siempre el mismo tamaño y el gesto no se va de madre.
 */
export function resizedDiameter(diameter: number, deltaX: number, deltaY: number): number {
  return clampOrbDiameter(diameter + deltaX - deltaY)
}

/** Posición y tamaño del disco en píxeles lógicos. */
export interface OrbRect {
  x: number
  y: number
  diameter: number
}

/** Dónde vive la pastilla respecto del disco. */
export type PillPlacement = 'none' | 'below' | 'above'

/** Rectángulo de la ventana del sistema en píxeles lógicos. */
export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

/** Franja vertical que ocupa la pastilla (separación + alto). */
function pillSpace(placement: PillPlacement): number {
  return placement === 'none' ? 0 : POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT
}

/** Rectángulo de la ventana para el disco dado y la colocación de la pastilla. */
export function orbWindowRect(orb: OrbRect, placement: PillPlacement): WindowRect {
  return {
    x: orb.x,
    y: placement === 'above' ? orb.y - pillSpace(placement) : orb.y,
    width: orb.diameter,
    height: orb.diameter + pillSpace(placement),
  }
}

/** Offset vertical del disco dentro de la ventana (0, o la franja si flipa arriba). */
export function orbOffsetY(placement: PillPlacement): number {
  return placement === 'above' ? pillSpace(placement) : 0
}

/** Disco que representa la ventana dada, dada la colocación vigente. */
export function orbFromWindowRect(rect: WindowRect, placement: PillPlacement): OrbRect {
  return { x: rect.x, y: rect.y + orbOffsetY(placement), diameter: rect.width }
}

/** Centro del disco: el punto que el resize deja fijo. */
export function orbCenter(orb: OrbRect): { x: number; y: number } {
  return { x: orb.x + orb.diameter / 2, y: orb.y + orb.diameter / 2 }
}

/** Disco redimensionado alrededor de su centro: el centro no se mueve. */
export function resizedOrbAroundCenter(orb: OrbRect, diameter: number): OrbRect {
  const centro = orbCenter(orb)
  const lado = clampOrbDiameter(diameter)
  return { x: centro.x - lado / 2, y: centro.y - lado / 2, diameter: lado }
}

/** Colocación de la pastilla: abajo si entra en el monitor; si no, arriba. */
export function choosePillPlacement(
  orb: OrbRect,
  monitor: { x: number; y: number; width: number; height: number } | null
): Exclude<PillPlacement, 'none'> {
  if (monitor === null) return 'below'
  const franja = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT
  return orb.y + orb.diameter + franja <= monitor.y + monitor.height ? 'below' : 'above'
}
