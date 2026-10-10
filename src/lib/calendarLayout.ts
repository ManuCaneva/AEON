import { quantizeCellSize } from './calendarResize'

export interface LayoutResult {
  cols: number
  cellSizePct: number
  monthWidthPct: number
  monthHeightPct: number
  visibleSlots: number
  showsAll: boolean
  // Dynamic pixel spacing
  gridGap: number
  monthPadding: number
  cellGap: number
  cellGapX: number
  cellGapY: number
  monthHeader: number
  nameGap: number
  // Absolute pixels
  cellSize: number
  monthWidth: number
  monthHeight: number
}

// Cromado vertical/horizontal que el algoritmo descuenta del cuerpo medido:
// padding del cuerpo (CSS .ycw__body), alto real de la fila de etiquetas de día
// (0.65rem + margin-bottom) y margen de seguridad.
export const LAYOUT_CHROME = {
  bodyPadding: 4,
  colHeaderHeight: 17,
  safetyMargin: 4,
} as const

// Inner DOM metrics
const MIN_CELL_SIZE = 4 // minimum readable day cell size in pixels
const MAX_CELL_SIZE = 120 // upper bound - algorithm iterates down from here

/** Tamaño de fuente del nombre del mes en rem según el tamaño de celda. */
export function monthFontRem(cs: number): number {
  return Math.max(0.576, cs * 0.06)
}

export function spacingFor(cs: number) {
  const cellGap = cs < 10 ? 1 : Math.max(1, Math.round(cs * 0.12))
  const monthPadding = 0
  const gridGap = Math.max(3, Math.round(cs * 0.5))
  const nameGap = Math.max(3, Math.round(cs * 0.35))
  // La caja entra el texto con line-height 1.2 y text-scale máximo 1.15.
  const textBox = Math.ceil(monthFontRem(cs) * 16 * 1.2 * 1.15)
  const monthHeader = Math.max(12, Math.round(cs * 1.3), textBox)

  // Width of 1 month card
  const monthW = 7 * cs + 6 * cellGap + 2 * monthPadding
  // Height of 1 month card
  const monthH = 6 * cs + 5 * cellGap + 2 * monthPadding + monthHeader + nameGap

  return { cellGap, monthPadding, gridGap, monthHeader, nameGap, monthW, monthH }
}

export function computeForCols(c: number, rawW: number, rawH: number): LayoutResult | null {
  if (rawW <= 0 || rawH <= 0) return null

  // Subtract container paddings, top-level day-of-week headers height, and a 4px safety margin
  const bodyPadding = LAYOUT_CHROME.bodyPadding
  const colHeaderHeight = LAYOUT_CHROME.colHeaderHeight

  const availW = rawW - 2 * bodyPadding
  const availH = rawH - 2 * bodyPadding - colHeaderHeight - LAYOUT_CHROME.safetyMargin

  if (availW <= 0 || availH <= 0) return null

  // 1. Try to fit all 12 months (skip if c === 1 to force semester view)
  const rowsAll = Math.ceil(12 / c)
  let bestCs = -1
  let showsAll = false
  let visibleSlots = 12

  if (c > 1) {
    for (let cs = MAX_CELL_SIZE; cs >= MIN_CELL_SIZE; cs--) {
      const space = spacingFor(cs)
      const totalW = c * space.monthW + (c - 1) * space.gridGap
      const totalH = rowsAll * space.monthH + (rowsAll - 1) * space.gridGap

      if (totalW <= availW && totalH <= availH) {
        bestCs = cs
        showsAll = true
        visibleSlots = 12
        break
      }
    }
  }

  // 2. If 12 months cannot fit, target exactly 6 months (1 semester)
  if (bestCs === -1) {
    const targetMonths = c === 4 ? 8 : 6
    const rowsSix = Math.ceil(targetMonths / c)

    for (let cs = MAX_CELL_SIZE; cs >= MIN_CELL_SIZE; cs--) {
      const space = spacingFor(cs)
      const totalW = c * space.monthW + (c - 1) * space.gridGap
      const totalH = rowsSix * space.monthH + (rowsSix - 1) * space.gridGap

      if (totalW <= availW && totalH <= availH) {
        bestCs = cs
        showsAll = false
        visibleSlots = targetMonths
        break
      }
    }

    // Force fit at MIN_CELL_SIZE if we are in 1-column layout to prevent falling back to empty screen!
    if (bestCs === -1 && c === 1 && availW >= 34 && availH >= 40) {
      bestCs = MIN_CELL_SIZE
      showsAll = false
      visibleSlots = 6
    }
  }

  // 3. Fallback: at least 1 row fits
  if (bestCs === -1) {
    for (let cs = MAX_CELL_SIZE; cs >= MIN_CELL_SIZE; cs--) {
      const space = spacingFor(cs)
      const totalW = c * space.monthW + (c - 1) * space.gridGap
      const totalH = space.monthH

      if (totalW <= availW && totalH <= availH) {
        bestCs = cs
        showsAll = false
        visibleSlots = c
        break
      }
    }
  }

  if (bestCs === -1) return null

  const cs = bestCs
  const space = spacingFor(cs)

  return {
    cols: c,
    cellSizePct: cs / rawW,
    monthWidthPct: space.monthW / rawW,
    monthHeightPct: space.monthH / rawH,
    visibleSlots,
    showsAll,
    gridGap: space.gridGap,
    monthPadding: space.monthPadding,
    cellGap: space.cellGap,
    cellGapX: space.cellGap,
    cellGapY: space.cellGap,
    monthHeader: space.monthHeader,
    nameGap: space.nameGap,
    cellSize: cs,
    monthWidth: space.monthW,
    monthHeight: space.monthH,
  }
}

export function computeLayout(
  availW: number,
  availH: number,
  targetCols?: number
): LayoutResult | null {
  if (availW <= 0 || availH <= 0) return null

  // If a specific number of columns is requested, enforce it strictly
  if (targetCols !== undefined && targetCols > 0) {
    return computeForCols(targetCols, availW, availH)
  }

  // Determine max columns based on width constraint
  let maxCols = 1
  if (availW >= 900) {
    maxCols = 4
  } else if (availW >= 600) {
    maxCols = 3
  } else if (availW >= 340) {
    maxCols = 2
  }

  let best: LayoutResult | null = null

  // Scan columns up to maxCols to find the layout with the largest day cells
  for (let c = 1; c <= maxCols; c++) {
    const cand = computeForCols(c, availW, availH)
    if (!cand) continue

    if (best === null) {
      best = cand
      continue
    }

    // Prefer larger day cells (more readable)
    if (cand.cellSizePct > best.cellSizePct) {
      best = cand
      continue
    }

    // If cells are the same size, prefer showing more months
    if (cand.cellSizePct === best.cellSizePct && cand.visibleSlots > best.visibleSlots) {
      best = cand
    }
  }

  return best
}

/**
 * Offset inicial del viewport de meses para que el mes dado quede visible.
 * Agrupa por páginas de `visibleSlots` y alinea a filas completas (`cols`).
 */
export function initialOffsetForMonth(
  monthIndex: number,
  visibleSlots: number,
  cols: number
): number {
  if (visibleSlots >= 12) return 0
  const safeCols = Math.max(1, cols)
  const maxOffset = Math.max(0, 12 - visibleSlots)
  const base = Math.floor(monthIndex / visibleSlots) * visibleSlots
  const clamped = Math.min(Math.max(0, base), maxOffset)
  return Math.floor(clamped / safeCols) * safeCols
}

function fittedContentHeight(slots: number, cols: number, cs: number): number {
  const space = spacingFor(cs)
  const monthH = 6 * cs + 5 * space.cellGap + space.monthHeader + space.nameGap
  const rows = Math.max(1, Math.ceil(slots / cols))
  return rows * monthH + (rows - 1) * space.gridGap
}

function fittedContentWidth(cols: number, cs: number): number {
  const space = spacingFor(cs)
  const monthW = 7 * cs + 6 * space.cellGap
  return cols * monthW + (cols - 1) * space.gridGap
}

/**
 * Ajuste exacto que garantiza que el viewport resultante entra en el cuerpo
 * medido: parte del ajuste exacto, lo baja al paso discreto inferior (nunca
 * redondea hacia arriba) y, si ni el tamaño mínimo entra, pagina menos meses.
 * Así el último mes visible nunca queda cortado por el footer.
 */
export function computeFittedLayout(
  availW: number,
  availH: number,
  targetCols?: number
): LayoutResult | null {
  const exact = computeLayout(availW, availH, targetCols)
  if (!exact) return null

  const contentW = availW - 2 * LAYOUT_CHROME.bodyPadding
  const contentH =
    availH -
    2 * LAYOUT_CHROME.bodyPadding -
    LAYOUT_CHROME.colHeaderHeight -
    LAYOUT_CHROME.safetyMargin

  let cs = quantizeCellSize(Math.min(exact.cellSize, MAX_CELL_SIZE))
  const slots = exact.visibleSlots
  const cols = exact.cols

  while (cs >= MIN_CELL_SIZE) {
    if (
      fittedContentHeight(slots, cols, cs) <= contentH &&
      fittedContentWidth(cols, cs) <= contentW
    ) {
      const space = spacingFor(cs)
      const monthH = 6 * cs + 5 * space.cellGap + space.monthHeader + space.nameGap
      const monthW = 7 * cs + 6 * space.cellGap
      return {
        cols,
        cellSizePct: cs / availW,
        monthWidthPct: monthW / availW,
        monthHeightPct: monthH / availH,
        visibleSlots: slots,
        showsAll: slots >= 12,
        gridGap: space.gridGap,
        monthPadding: space.monthPadding,
        cellGap: space.cellGap,
        cellGapX: space.cellGap,
        cellGapY: space.cellGap,
        monthHeader: space.monthHeader,
        nameGap: space.nameGap,
        cellSize: cs,
        monthWidth: monthW,
        monthHeight: monthH,
      }
    }
    cs--
  }

  // Ni el tamaño mínimo entra: reducir meses visibles hasta que entren.
  let reduced = Math.max(cols, slots - cols)
  while (reduced >= cols) {
    if (
      fittedContentHeight(reduced, cols, MIN_CELL_SIZE) <= contentH &&
      fittedContentWidth(cols, MIN_CELL_SIZE) <= contentW
    ) {
      const space = spacingFor(MIN_CELL_SIZE)
      const monthH = 6 * MIN_CELL_SIZE + 5 * space.cellGap + space.monthHeader + space.nameGap
      const monthW = 7 * MIN_CELL_SIZE + 6 * space.cellGap
      return {
        cols,
        cellSizePct: MIN_CELL_SIZE / availW,
        monthWidthPct: monthW / availW,
        monthHeightPct: monthH / availH,
        visibleSlots: reduced,
        showsAll: false,
        gridGap: space.gridGap,
        monthPadding: space.monthPadding,
        cellGap: space.cellGap,
        cellGapX: space.cellGap,
        cellGapY: space.cellGap,
        monthHeader: space.monthHeader,
        nameGap: space.nameGap,
        cellSize: MIN_CELL_SIZE,
        monthWidth: monthW,
        monthHeight: monthH,
      }
    }
    reduced -= cols
  }
  return null
}
