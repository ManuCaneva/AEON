import { describe, it, expect } from 'vitest'
import {
  computeForCols,
  computeLayout,
  initialOffsetForMonth,
  offsetForYear,
  monthFontRem,
  computeFittedLayout,
  computeScrollableLayout,
  colsForItemWidth,
  MIN_SCROLL_CELL,
  LAYOUT_CHROME,
} from './calendarLayout'

describe('calendarLayout', () => {
  describe('computeForCols', () => {
    it('returns null when container is too small', () => {
      // Very small widget width (50px) where not even 1 day cell can fit
      const result = computeForCols(1, 50, 50)
      expect(result).toBeNull()
    })

    it("shows all 12 months when there's enough space", () => {
      const result = computeForCols(4, 800, 600)
      expect(result).not.toBeNull()
      expect(result!.showsAll).toBe(true)
      expect(result!.visibleSlots).toBe(12)
      expect(result!.cols).toBe(4)
    })

    it('uses columns specified when width allows', () => {
      const result = computeForCols(3, 900, 600)
      expect(result).not.toBeNull()
      expect(result!.cols).toBe(3)
    })

    it('shows fewer months when vertical space is limited', () => {
      const result = computeForCols(2, 600, 250)
      expect(result).not.toBeNull()
      expect(result!.showsAll).toBe(false)
      expect(result!.visibleSlots).toBeLessThan(12)
    })

    it('muestra los 12 meses en 1 columna cuando hay alto suficiente', () => {
      const result = computeForCols(1, 150, 1000)
      expect(result).not.toBeNull()
      expect(result!.showsAll).toBe(true)
      expect(result!.visibleSlots).toBe(12)
    })

    it('pagina por semestre en 1 columna solo si los 12 no entran ni al mínimo', () => {
      const result = computeForCols(1, 150, 360)
      expect(result).not.toBeNull()
      expect(result!.showsAll).toBe(false)
      expect(result!.visibleSlots).toBe(6)
    })
  })

  describe('computeLayout', () => {
    it('returns null when no configuration fits', () => {
      const result = computeLayout(50, 50)
      expect(result).toBeNull()
    })

    it('returns a layout with 1 column for narrow widths', () => {
      const result = computeLayout(300, 600)
      expect(result).not.toBeNull()
      expect(result!.cols).toBe(1)
    })

    it('returns a layout with 2 columns for medium widths', () => {
      const result = computeLayout(500, 600)
      expect(result).not.toBeNull()
      expect(result!.cols).toBe(2)
    })

    it('returns a layout with 3 or 4 columns for wide widths', () => {
      const result = computeLayout(1000, 600)
      expect(result).not.toBeNull()
      expect(result!.cols).toBeGreaterThanOrEqual(3)
    })

    it('provides percentage values for styling', () => {
      const result = computeLayout(800, 600)
      expect(result).not.toBeNull()
      expect(result!.cellSizePct).toBeGreaterThan(0)
      expect(result!.cellSizePct).toBeLessThanOrEqual(1)
      expect(result!.monthWidthPct).toBeGreaterThan(0)
      expect(result!.monthWidthPct).toBeLessThanOrEqual(1)
      expect(result!.monthHeightPct).toBeGreaterThan(0)
      expect(result!.monthHeightPct).toBeLessThanOrEqual(1)
    })

    it('respects the targetCols override parameter when provided', () => {
      const result = computeLayout(800, 600, 2)
      expect(result).not.toBeNull()
      expect(result!.cols).toBe(2)

      const result1 = computeLayout(800, 600, 1)
      expect(result1).not.toBeNull()
      expect(result1!.cols).toBe(1)
    })
  })

  describe('initialOffsetForMonth', () => {
    it('muestra el primer semestre cuando el mes está en ene-jun', () => {
      expect(initialOffsetForMonth(0, 6, 2)).toBe(0)
      expect(initialOffsetForMonth(5, 6, 2)).toBe(0)
    })

    it('muestra el segundo semestre cuando el mes está en jul-dic (octubre -> jul-dic)', () => {
      expect(initialOffsetForMonth(9, 6, 2)).toBe(6)
      expect(initialOffsetForMonth(6, 6, 2)).toBe(6)
      expect(initialOffsetForMonth(11, 6, 2)).toBe(6)
    })

    it('alinea el offset a columnas completas', () => {
      // Mes 7 con 6 visibles y 4 columnas: base 6 -> alineado a 4
      expect(initialOffsetForMonth(7, 6, 4)).toBe(4)
    })

    it('devuelve 0 cuando caben los 12 meses', () => {
      expect(initialOffsetForMonth(9, 12, 4)).toBe(0)
    })

    it('siempre incluye el mes actual dentro de la ventana visible', () => {
      for (let month = 0; month < 12; month++) {
        for (const [visibleSlots, cols] of [
          [6, 1],
          [6, 2],
          [6, 3],
          [6, 4],
          [8, 4],
          [3, 3],
          [2, 2],
        ] as const) {
          const offset = initialOffsetForMonth(month, visibleSlots, cols)
          expect(offset).toBeGreaterThanOrEqual(0)
          expect(offset).toBeLessThanOrEqual(12 - visibleSlots)
          expect(month).toBeGreaterThanOrEqual(offset)
          expect(month).toBeLessThan(offset + visibleSlots)
        }
      }
    })

    it('offsetForYear recibe la fecha como parámetro (sin espiar Date)', () => {
      const oct2026 = new Date(2026, 9, 15)
      expect(offsetForYear(2026, 6, 2, oct2026)).toBe(6)
      expect(offsetForYear(2026, 6, 2, new Date(2026, 2, 10))).toBe(0)
      expect(offsetForYear(2025, 6, 2, oct2026)).toBe(0)
      expect(offsetForYear(2027, 6, 2, oct2026)).toBe(0)
    })
  })

  describe('monthFontRem', () => {
    it('es un 20% más chico que la fórmula anterior (0.075 -> 0.06, piso 0.72 -> 0.576)', () => {
      expect(monthFontRem(12)).toBeCloseTo(0.72, 5)
      expect(monthFontRem(4)).toBeCloseTo(0.576, 5)
      expect(monthFontRem(40)).toBeCloseTo(2.4, 5)
    })
  })

  describe('spacingFor', () => {
    it('la caja del título entra el texto con line-height 1.2 y text-scale máximo 1.15', async () => {
      const { spacingFor } = await import('./calendarLayout')
      for (let cs = 4; cs <= 60; cs++) {
        const space = spacingFor(cs)
        const fontPx = monthFontRem(cs) * 16
        expect(space.monthHeader).toBeGreaterThanOrEqual(Math.ceil(fontPx * 1.2 * 1.15))
      }
    })
  })

  describe('computeFittedLayout', () => {
    it('el viewport resultante nunca excede el alto disponible (diciembre no se corta)', () => {
      const sizes: Array<[number, number]> = [
        [300, 300],
        [220, 750],
        [500, 400],
        [1200, 900],
        [200, 200],
      ]
      for (const [w, h] of sizes) {
        const layout = computeFittedLayout(w, h)
        if (layout === null) continue
        const rows = Math.ceil(layout.visibleSlots / layout.cols)
        const viewportH = rows * (layout.monthHeight + layout.gridGap) - layout.gridGap
        const chromeH =
          2 * LAYOUT_CHROME.bodyPadding + LAYOUT_CHROME.colHeaderHeight + LAYOUT_CHROME.safetyMargin
        expect(viewportH).toBeLessThanOrEqual(h - chromeH)
      }
    })

    it('achica las celdas en lugar de desbordar cuando el cuerpo se encoge', () => {
      const wide = computeFittedLayout(500, 600)
      const narrow = computeFittedLayout(500, 350)
      expect(wide).not.toBeNull()
      expect(narrow).not.toBeNull()
      expect(narrow!.cellSize).toBeLessThanOrEqual(wide!.cellSize)
    })

    it('reparte el sobrante vertical para llenar el cuerpo (sin hueco bajo el último mes)', () => {
      const sizes: Array<[number, number]> = [
        [220, 750], // 1 columna alta: el caso del widget angosto
        [500, 600],
        [1200, 900],
        [300, 300],
      ]
      for (const [w, h] of sizes) {
        const layout = computeFittedLayout(w, h)
        if (layout === null) continue
        const rows = Math.ceil(layout.visibleSlots / layout.cols)
        const viewportH = rows * (layout.monthHeight + layout.gridGap) - layout.gridGap
        const contentH =
          h -
          2 * LAYOUT_CHROME.bodyPadding -
          LAYOUT_CHROME.colHeaderHeight -
          LAYOUT_CHROME.safetyMargin
        expect(viewportH).toBeLessThanOrEqual(contentH)
        expect(contentH - viewportH).toBeLessThan(1)
      }
    })

    it('reparte el sobrante horizontal abriendo las columnas (llena el ancho)', async () => {
      const { spacingFor } = await import('./calendarLayout')
      const sizes: Array<[number, number]> = [
        [220, 750],
        [500, 600],
        [1200, 900],
      ]
      for (const [w, h] of sizes) {
        const layout = computeFittedLayout(w, h)
        if (layout === null) continue
        const totalW = layout.cols * layout.monthWidth + (layout.cols - 1) * layout.gridGap
        const contentW = w - 2 * LAYOUT_CHROME.bodyPadding
        expect(totalW).toBeLessThanOrEqual(contentW)
        const space = spacingFor(layout.cellSize)
        // O llena el ancho (tolerancia por redondeo a entero) o llegó al tope
        // de cellGapX y el resto queda como margen lateral centrado.
        const tight = contentW - totalW < layout.cols * 3 + 1
        const capped = layout.cellGapX >= space.cellGap * 2
        expect(tight || capped).toBe(true)
      }
    })

    it('las columnas no se estiran: cellGapX con tope entero cerca del gap base', async () => {
      const { spacingFor } = await import('./calendarLayout')
      const layout = computeFittedLayout(220, 750)
      expect(layout).not.toBeNull()
      const space = spacingFor(layout!.cellSize)
      // Aunque sobre mucho ancho, las celdas siguen agrupadas (tope 2x base)
      expect(layout!.cellGapX).toBeLessThanOrEqual(space.cellGap * 2)
      expect(Number.isInteger(layout!.cellGapX)).toBe(true)
    })

    it('centra ópticamente el nombre del mes: gridGap y nameGap crecen parejo', async () => {
      const { spacingFor } = await import('./calendarLayout')
      const layout = computeFittedLayout(220, 750)
      expect(layout).not.toBeNull()
      const space = spacingFor(layout!.cellSize)
      // El sobrante vertical se reparte mitad arriba y mitad abajo del nombre
      expect(layout!.gridGap).toBeGreaterThan(space.gridGap)
      expect(layout!.nameGap).toBeGreaterThan(space.nameGap)
      expect(layout!.gridGap - layout!.nameGap).toBeCloseTo(space.gridGap - space.nameGap, 9)
    })

    it('al repartir no achica celdas: los gaps solo crecen y las alturas quedan consistentes', async () => {
      const { spacingFor } = await import('./calendarLayout')
      const sizes: Array<[number, number]> = [
        [220, 750],
        [500, 600],
        [1200, 900],
      ]
      for (const [w, h] of sizes) {
        const layout = computeFittedLayout(w, h)
        if (layout === null) continue
        const space = spacingFor(layout.cellSize)
        expect(layout.gridGap).toBeGreaterThanOrEqual(space.gridGap)
        expect(layout.cellGapX).toBeGreaterThanOrEqual(space.cellGap)
        expect(layout.cellGapY).toBeGreaterThanOrEqual(space.cellGap)
        expect(layout.monthHeight).toBeCloseTo(
          6 * layout.cellSize + 5 * layout.cellGapY + layout.monthHeader + layout.nameGap,
          9
        )
        expect(layout.monthWidth).toBeCloseTo(7 * layout.cellSize + 6 * layout.cellGapX, 9)
      }
    })
  })

  describe('colsForItemWidth', () => {
    it('usa el ancho del item del dashboard (w=1 -> 1, w=2 -> 2)', () => {
      expect(colsForItemWidth(1, 280)).toBe(1)
      expect(colsForItemWidth(2, 280)).toBe(2)
    })

    it('tope en 4 columnas para widgets anchos', () => {
      expect(colsForItemWidth(6, 1200)).toBe(4)
      expect(colsForItemWidth(4, 1200)).toBe(4)
    })

    it('sin item, decide por píxeles (fallback angosto -> 1)', () => {
      expect(colsForItemWidth(undefined, 280)).toBe(1)
      expect(colsForItemWidth(undefined, 500)).toBe(2)
    })
  })

  describe('computeScrollableLayout', () => {
    it('w=2 angosto y alto (caso 1920x1080 estirado) da 2 columnas legibles con los 12 meses', () => {
      const layout = computeScrollableLayout(280, 2)
      expect(layout).not.toBeNull()
      expect(layout!.cols).toBe(2)
      expect(layout!.visibleSlots).toBe(12)
      expect(layout!.showsAll).toBe(true)
      expect(layout!.cellSize).toBeGreaterThanOrEqual(MIN_SCROLL_CELL)
      expect(layout!.cellSize).toBeGreaterThanOrEqual(10)
    })

    it('w=1 angosto da 1 columna legible con los 12 meses', () => {
      const layout = computeScrollableLayout(150, 1)
      expect(layout).not.toBeNull()
      expect(layout!.cols).toBe(1)
      expect(layout!.visibleSlots).toBe(12)
      expect(layout!.cellSize).toBeGreaterThanOrEqual(10)
    })

    it('ocupa el ancho disponible (sin hueco grande lateral)', () => {
      const availW = 280
      const layout = computeScrollableLayout(availW, 2)
      expect(layout).not.toBeNull()
      const totalW = layout!.cols * layout!.monthWidth + (layout!.cols - 1) * layout!.gridGap
      const contentW = availW - 2 * LAYOUT_CHROME.bodyPadding
      expect(totalW).toBeLessThanOrEqual(contentW)
      expect(contentW - totalW).toBeLessThan(30)
    })

    it('el alto no limita la celda: alto grande y chico dan la misma celda (scroll vertical)', () => {
      const tall = computeScrollableLayout(280, 2)
      const short = computeScrollableLayout(280, 2)
      expect(tall!.cellSize).toBe(short!.cellSize)
    })

    it('nunca baja del mínimo legible aunque el ancho sea muy chico', () => {
      const layout = computeScrollableLayout(150, 1)
      expect(layout!.cellSize).toBeGreaterThanOrEqual(10)
    })

    it('widget ultra-angosto: nunca desborda el ancho (encoge celdas)', () => {
      for (const availW of [80, 60, 40, 30]) {
        for (const cols of [1, 2, 3, 4]) {
          const layout = computeScrollableLayout(availW, cols)
          expect(layout).not.toBeNull()
          const totalW = layout!.cols * layout!.monthWidth + (layout!.cols - 1) * layout!.gridGap
          const contentW = availW - 2 * LAYOUT_CHROME.bodyPadding
          expect(totalW).toBeLessThanOrEqual(contentW)
        }
      }
    })
  })
})
