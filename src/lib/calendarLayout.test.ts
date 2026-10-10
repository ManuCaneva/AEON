import { describe, it, expect } from 'vitest'
import { computeForCols, computeLayout, initialOffsetForMonth } from './calendarLayout'

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

    it("targets exactly 6 months (1 semester) when all 12 don't fit", () => {
      const result = computeForCols(1, 150, 360)
      expect(result).not.toBeNull()
      expect(result!.showsAll).toBe(false)
      expect(result!.visibleSlots).toBe(6)
    })

    it('always targets exactly 6 months for a 1-column layout even with plenty of space', () => {
      const result = computeForCols(1, 150, 1000)
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
  })
})
