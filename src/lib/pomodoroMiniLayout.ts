/**
 * Geometría pura de la mascota del pomodoro: el disco flotante y la pastilla
 * de opciones que aparece debajo al hacer hover.
 *
 * La mascota es **una sola ventana fija**, creada desde el arranque con el
 * tamaño del disco más la franja de la pastilla. Nunca se redimensiona: el
 * arrastre nativo mueve el disco y la pastilla juntos, sin timers ni IPC.
 *
 * La pastilla vive siempre debajo del disco. Si el usuario arrastra la ventana
 * contra el borde inferior del monitor, la franja puede quedar fuera: la
 * colocación no se invierte jamás.
 */

/** Límites del disco en píxeles lógicos: por debajo el contador no entra. */
export const POMODORO_ORB_MIN_DIAMETER = 80
export const POMODORO_ORB_MAX_DIAMETER = 480
export const POMODORO_ORB_DEFAULT_DIAMETER = 100

/** Pastilla de opciones: alto fijo, separación y sombra que no debe recortarse. */
export const POMODORO_PILL_HEIGHT = 30
export const POMODORO_PILL_WIDTH = 64
export const POMODORO_PILL_GAP = 8
export const POMODORO_PILL_SHADOW_ROOM = 8

/** Grosor del anillo en el disco chico: 2.5 px se perdía contra el fondo. */
export const POMODORO_MINI_RING_WIDTH = 4

/** Separación por defecto entre la mascota y los bordes del monitor. */
export const POMODORO_MINI_WINDOW_MARGIN = 24

/** Diámetro entero y dentro del rango válido. */
export function clampOrbDiameter(diameter: number): number {
  return Math.min(
    POMODORO_ORB_MAX_DIAMETER,
    Math.max(POMODORO_ORB_MIN_DIAMETER, Math.round(diameter))
  )
}

/** Posición y tamaño del disco en píxeles lógicos. */
export interface OrbRect {
  x: number
  y: number
  diameter: number
}

/** Rectángulo de una ventana del sistema en píxeles lógicos. */
export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

/** Rectángulo del monitor en píxeles lógicos. */
export interface MonitorRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Tamaño de la ventana única: el disco arriba y, debajo, la franja de la
 * pastilla con su separación y espacio para la sombra. La superficie es
 * cuadrada para que WebKitGTK pinte completa; la ventana se crea opaca y el
 * sistema la recorta a la forma del disco y la pastilla.
 */
export function mascotWindowSize(diameter: number): { width: number; height: number } {
  const side = clampOrbDiameter(diameter)
  const surface = side + POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT + POMODORO_PILL_SHADOW_ROOM
  return { width: surface, height: surface }
}

/** Rectángulo completo de la ventana de la mascota (disco + franja). */
export function orbWindowRect(orb: OrbRect): WindowRect {
  return { x: orb.x - orbWindowOffsetX(orb.diameter), y: orb.y, ...mascotWindowSize(orb.diameter) }
}

/** Margen entre el origen nativo de la ventana y el borde izquierdo del disco. */
export function orbWindowOffsetX(diameter: number): number {
  return (mascotWindowSize(diameter).width - clampOrbDiameter(diameter)) / 2
}

/**
 * Disco por defecto: contra la esquina inferior derecha del monitor, con
 * margen. La ventana completa (disco + pastilla) queda dentro del monitor.
 */
export function defaultOrbRect(
  monitor: MonitorRect,
  diameter: number,
  margin: number = POMODORO_MINI_WINDOW_MARGIN
): OrbRect {
  const side = clampOrbDiameter(diameter)
  const { width, height } = mascotWindowSize(side)
  return {
    x: Math.max(monitor.x, monitor.x + monitor.width - width - margin) + orbWindowOffsetX(side),
    y: Math.max(monitor.y, monitor.y + monitor.height - height - margin),
    diameter: side,
  }
}

/**
 * Corrige una posición guardada que se salió del monitor: la ventana completa
 * queda adentro. El disco no cambia de tamaño y la pastilla no se invierte.
 */
export function containOrbInMonitor(orb: OrbRect, monitor: MonitorRect): OrbRect {
  const { width, height } = mascotWindowSize(orb.diameter)
  const offsetX = orbWindowOffsetX(orb.diameter)
  return {
    x: Math.max(monitor.x, Math.min(orb.x - offsetX, monitor.x + monitor.width - width)) + offsetX,
    y: Math.max(monitor.y, Math.min(orb.y, monitor.y + monitor.height - height)),
    diameter: clampOrbDiameter(orb.diameter),
  }
}

/** true si la ventana del disco se solapa con el monitor indicado. */
export function orbIntersectsMonitor(orb: OrbRect, monitor: MonitorRect): boolean {
  const rect = orbWindowRect(orb)
  return (
    rect.x + rect.width > monitor.x &&
    rect.x < monitor.x + monitor.width &&
    rect.y + rect.height > monitor.y &&
    rect.y < monitor.y + monitor.height
  )
}

/** Rectángulo de una región de forma (coordenadas locales de la ventana). */
export interface ShapeRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Región visible de la mascota: el círculo del disco y la cápsula de la
 * pastilla, expresada como rectángulos de una fila de alto. La ventana se crea
 * opaca y el sistema la recorta con esta región: WebKitGTK no pinta una
 * superficie transparente más alta que el disco, pero una ventana opaca sí
 * pinta completa y la forma nativa deja ver el escritorio alrededor.
 */
export function mascotShapeRects(diameter: number, pillReveal = 0): ShapeRect[] {
  const side = mascotWindowSize(diameter).width
  const resolvedDiameter = clampOrbDiameter(diameter)
  const radius = resolvedDiameter / 2
  const centerX = side / 2
  const centerY = radius
  const pillWidth = Math.min(POMODORO_PILL_WIDTH, side)
  const pillHeight = Math.round(POMODORO_PILL_HEIGHT * Math.max(0, Math.min(1, pillReveal)))
  const pillRadius = POMODORO_PILL_HEIGHT / 2
  const pillRadiusY = pillHeight / 2
  const pillCenterX = side / 2
  const pillTop =
    resolvedDiameter + POMODORO_PILL_GAP + Math.round((POMODORO_PILL_HEIGHT - pillHeight) / 2)
  const pillCenterY = pillTop + pillRadiusY

  const rects: ShapeRect[] = []

  for (let y = 0; y < side; y += 1) {
    const spans: Array<[number, number]> = []
    const discOffset = y + 0.5 - centerY
    if (Math.abs(discOffset) <= radius) {
      const half = Math.sqrt(radius * radius - discOffset * discOffset)
      spans.push([centerX - half, centerX + half])
    }

    const pillOffset = y + 0.5 - pillCenterY
    if (pillRadiusY > 0 && Math.abs(pillOffset) < pillRadiusY) {
      const half =
        pillWidth / 2 - pillRadius + pillRadius * Math.sqrt(1 - (pillOffset / pillRadiusY) ** 2)
      spans.push([pillCenterX - half, pillCenterX + half])
    }

    for (const [left, right] of spans) {
      // Muestrear el centro del píxel evita expandir el borde hacia el fondo
      // opaco exterior al círculo SVG (halo más notorio sobre fondos claros).
      const start = Math.max(0, Math.ceil(left - 0.5))
      const end = Math.min(side, Math.ceil(right - 0.5))
      if (end > start) rects.push({ x: start, y, width: end - start, height: 1 })
    }
  }

  return rects
}
