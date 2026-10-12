import type { LayoutResult } from './calendarLayout'
import { monthFontRem, spacingFor } from './calendarLayout'

/**
 * Cuantiza un tamaño de celda al paso discreto INFERIOR proporcional al tamaño
 * (>=10px → paso 1, luego paso ~10%). Siempre redondea hacia abajo para que el
 * resultado nunca exceda un ajuste exacto ya verificado (ver
 * computeFittedLayout): redondear hacia arriba desbordaría el cuerpo y
 * cortaría el último mes. Garantiza al menos 1px de avance para que el
 * algoritmo nunca se congele en celdas chicas.
 */
export function quantizeCellSize(cs: number): number {
  const step = Math.max(1, Math.round(cs * 0.1))
  return Math.max(1, Math.floor(cs / step) * step)
}

/**
 * Deriva de un layout el layout "cuantizado": mismos cols/visibleSlots/showsAll
 * pero con cellSize y todas las métricas dependientes (gaps, alturas de mes)
 * recalculadas a partir del tamaño de celda en pasos discretos. Así, un cambio
 * de tamaño dentro del mismo paso deja todas las variables CSS invariantes.
 */
export function quantizeLayout(l: LayoutResult): LayoutResult {
  const cs = quantizeCellSize(l.cellSize)
  const space = spacingFor(cs)
  return {
    ...l,
    cellSize: cs,
    gridGap: space.gridGap,
    monthPadding: space.monthPadding,
    cellGap: space.cellGap,
    cellGapX: space.cellGap,
    cellGapY: space.cellGap,
    monthHeader: space.monthHeader,
    nameGap: space.nameGap,
    monthWidth: space.monthW,
    monthHeight: space.monthH,
  }
}

/**
 * Compara dos layouts por su estructura visible (columnas y slots visibles).
 * El tamaño de celda en píxeles no forma parte de la estructura: cambiar solo
 * el tamaño escala por CSS sin re-render de los meses.
 */
export function sameStructure(a: LayoutResult | null, b: LayoutResult | null): boolean {
  if (a === null || b === null) return a === b
  return a.cols === b.cols && a.visibleSlots === b.visibleSlots && a.showsAll === b.showsAll
}

export type ChangeKind = 'structure' | 'size' | 'none'

/**
 * Decide si un candidato de layout es significativo. 'structure' cambia la
 * grilla visible (columnas/slots); 'size' re-escala celdas o redistribuye el
 * sobrante en los gaps (el llenado exacto depende del tamaño medido al px).
 * Ambos actualizan el layout reactivamente — el costo de re-render del shell
 * es despreciable porque los MonthMini no cambian de props (solo variables
 * CSS). El épsilon evita updates por jitter sub-pixel del ResizeObserver.
 */
const GAP_EPSILON = 0.5

function gapDiffers(a: number, b: number): boolean {
  return Math.abs(a - b) > GAP_EPSILON
}

export function significantChange(
  prev: LayoutResult | null,
  next: LayoutResult | null
): ChangeKind {
  if (next === null) return 'none'
  if (prev === null) return 'structure'
  if (!sameStructure(prev, next)) return 'structure'
  if (quantizeCellSize(prev.cellSize) !== quantizeCellSize(next.cellSize)) return 'size'
  if (
    gapDiffers(prev.gridGap, next.gridGap) ||
    gapDiffers(prev.cellGapX, next.cellGapX) ||
    gapDiffers(prev.cellGapY, next.cellGapY)
  )
    return 'size'
  return 'none'
}

/**
 * Variables CSS completas derivadas del layout (cuantizado). Se bindean
 * reactivamente en la raíz del widget; los MonthMini no se re-renderizan
 * porque sus props quedan estables: solo el shell actualiza las variables.
 */
export function layoutVars(l: LayoutResult): Record<string, string> {
  const cs = quantizeCellSize(l.cellSize)
  const monthStep = l.monthHeight + l.gridGap
  const rows = Math.max(1, Math.ceil(l.visibleSlots / l.cols))
  return {
    '--cols': `${l.cols}`,
    '--cell-size': `${cs}px`,
    '--grid-gap': `${l.gridGap}px`,
    '--month-padding': `${l.monthPadding}px`,
    '--cell-gap-x': `${l.cellGapX}px`,
    '--cell-gap-y': `${l.cellGapY}px`,
    '--month-h': `${l.monthHeight}px`,
    '--month-step': `${monthStep}px`,
    '--month-header': `${l.monthHeader}px`,
    '--name-gap': `${l.nameGap}px`,
    '--font-size': `${monthFontRem(cs)}rem`,
    '--title-font-size': `${Math.max(0.55, cs * 0.042)}rem`,
    '--viewport-h': l.showsAll ? 'auto' : `${rows * monthStep - l.gridGap}px`,
  }
}
