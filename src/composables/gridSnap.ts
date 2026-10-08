import { COLS, ROWS } from '@/lib/grid'

/** Zona de la grilla en celdas enteras. */
export interface Cells {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Paso de la grilla: celda útil + gap. Es la distancia entre inicios de celdas
 * contiguas y el factor que mapea píxeles a bordes de celda.
 */
export function gridStep(containerPx: number, count: number, gap: number): number {
  return (containerPx + gap) / count
}

export interface SnapOptions {
  minW?: number
  minH?: number
  /** Espacio entre celdas, en px. Por defecto 0. */
  gap?: number
  /**
   * Arista anclada en el eje horizontal: `start` mantiene el borde izquierdo,
   * `end` mantiene el derecho. Por defecto `start`.
   */
  anchorX?: 'start' | 'end'
  /**
   * Arista anclada en el eje vertical: `start` mantiene el borde superior,
   * `end` mantiene el inferior. Por defecto `start`.
   */
  anchorY?: 'start' | 'end'
}

/**
 * Ajusta un eje convirtiendo a celdas las dos aristas del rectángulo de gesto
 * (borde bajo y borde alto) por separado y derivando posición y tamaño del par.
 * Al derivar el tamaño de la diferencia de aristas, la arista opuesta a la que
 * se arrastra queda anclada y el widget se encoge de verdad en lugar de
 * deslizarse cuando llega al mínimo. El empate de media celda se resuelve con
 * `Math.round` (consistente para ambas aristas), de modo que ninguna salta una
 * celda de más.
 */
function snapAxis(
  startPx: number,
  sizePx: number,
  containerPx: number,
  count: number,
  minCells: number,
  gap: number,
  anchor: 'start' | 'end'
): { pos: number; size: number } {
  // Distancia entre inicios de celdas contiguas: celda útil + gap. Es el paso
  // real de la grilla y el que mapea píxeles a bordes de celda.
  const step = gridStep(containerPx, count, gap)
  if (!(step > 0)) return { pos: 0, size: minCells }

  const lowEdge = Math.round(startPx / step)
  const highEdge = Math.round((startPx + sizePx) / step)

  let size = highEdge - lowEdge
  size = Math.max(minCells, Math.min(size, count))

  // Con la arista opuesta anclada, la posición se deriva del borde fijo.
  const pos = anchor === 'end' ? highEdge - size : lowEdge
  return { pos: Math.max(0, Math.min(pos, count - size)), size }
}

/**
 * Convierte píxeles (left/top/width/height relativos al contenedor) a celdas
 * enteras de la grilla COLS×ROWS. Redondea las cuatro aristas por separado y
 * deriva posición y tamaño de pares de aristas: la arista opuesta a la que se
 * arrastra queda anclada. Descuenta el `gap` entre celdas y clampa al mínimo
 * (`minW`/`minH`) y a los límites de la grilla.
 */
export function pxToCells(
  leftPx: number,
  topPx: number,
  widthPx: number,
  heightPx: number,
  containerWidth: number,
  containerHeight: number,
  opts?: SnapOptions
): Cells {
  const gap = opts?.gap ?? 0
  const minW = opts?.minW ?? 1
  const minH = opts?.minH ?? 1

  const horizontal = snapAxis(
    leftPx,
    widthPx,
    containerWidth,
    COLS,
    minW,
    gap,
    opts?.anchorX ?? 'start'
  )
  const vertical = snapAxis(
    topPx,
    heightPx,
    containerHeight,
    ROWS,
    minH,
    gap,
    opts?.anchorY ?? 'start'
  )

  return { x: horizontal.pos, y: vertical.pos, w: horizontal.size, h: vertical.size }
}
