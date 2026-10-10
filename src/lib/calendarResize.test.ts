import { describe, it, expect } from 'vitest'
import {
  quantizeCellSize,
  sameStructure,
  significantChange,
  layoutVars,
  quantizeLayout,
} from './calendarResize'
import type { LayoutResult } from './calendarLayout'

const base: LayoutResult = {
  cols: 4,
  cellSizePct: 0.01,
  monthWidthPct: 0.2,
  monthHeightPct: 0.2,
  visibleSlots: 12,
  showsAll: true,
  gridGap: 6,
  monthPadding: 0,
  cellGap: 2,
  cellGapX: 2,
  cellGapY: 2,
  monthHeader: 14,
  nameGap: 4,
  cellSize: 12,
  monthWidth: 100,
  monthHeight: 100,
}

describe('quantizeCellSize', () => {
  it('cuantiza a un paso proporcional al tamaño de celda (mínimo 1px)', () => {
    expect(quantizeCellSize(9)).toBe(9)
    expect(quantizeCellSize(12)).toBe(12)
  })

  it('agrupa tamaños cercanos en el mismo paso discreto', () => {
    expect(quantizeCellSize(20)).toBe(20)
    expect(quantizeCellSize(21)).toBe(20)
    expect(quantizeCellSize(22)).toBe(22)
  })

  it('nunca redondea hacia arriba: el cuantizado siempre entra en el ajuste exacto', () => {
    for (let cs = 1; cs <= 120; cs++) {
      expect(quantizeCellSize(cs)).toBeLessThanOrEqual(cs)
    }
  })

  it('nunca devuelve un paso de 0 (se mantiene estable en celdas chicas)', () => {
    expect(quantizeCellSize(2)).toBe(2)
    expect(quantizeCellSize(1)).toBe(1)
  })
})

describe('sameStructure', () => {
  it('trata dos layouts nulos como iguales', () => {
    expect(sameStructure(null, null)).toBe(true)
  })

  it('un layout nulo y otro no difieren en estructura', () => {
    expect(sameStructure(null, base)).toBe(false)
    expect(sameStructure(base, null)).toBe(false)
  })

  it('dos layouts con mismas columnas/slots son estructuralmente iguales aunque cambie el tamaño de celda', () => {
    expect(sameStructure(base, { ...base, cellSize: 24, gridGap: 12 })).toBe(true)
  })

  it('cambiar columnas o slots visibles cambia la estructura', () => {
    expect(sameStructure(base, { ...base, cols: 3 })).toBe(false)
    expect(sameStructure(base, { ...base, visibleSlots: 6, showsAll: false })).toBe(false)
  })
})

describe('significantChange', () => {
  it('un candidato nulo nunca es un cambio significativo', () => {
    expect(significantChange(base, null)).toBe('none')
  })

  it('sin layout previo, el primer candidato es un cambio de estructura', () => {
    expect(significantChange(null, base)).toBe('structure')
  })

  it('cambiar columnas o slots visibles es un cambio de estructura', () => {
    expect(significantChange(base, { ...base, cols: 2 })).toBe('structure')
    expect(significantChange(base, { ...base, visibleSlots: 6, showsAll: false })).toBe('structure')
  })

  it('misma estructura pero tamaño de celda en otro paso es un cambio de tamaño (sin re-render)', () => {
    expect(significantChange(base, { ...base, cellSize: 25 })).toBe('size')
  })

  it('misma estructura y tamaño dentro del mismo paso no es un cambio', () => {
    const big: LayoutResult = { ...base, cellSize: 41 }
    expect(significantChange(big, { ...big, cellSize: 40 })).toBe('none')
  })

  it('el paso del tamaño de celda crece con el tamaño (es proporcional)', () => {
    expect(quantizeCellSize(21)).toBe(20)
    expect(quantizeCellSize(39)).toBe(36)
    expect(quantizeCellSize(41)).toBe(40)
    expect(quantizeCellSize(50)).toBe(50)
  })
})

describe('quantizeLayout', () => {
  it('recalcula todas las métricas dependientes del tamaño a partir del tamaño cuantizado', () => {
    const q = quantizeLayout({ ...base, cellSize: 41 })
    expect(q.cellSize).toBe(40)
    // monthHeight = 6*40 + 5*cellGap + monthHeader + nameGap
    // cellGap = round(40*0.12)=5, gridGap = round(40*0.5)=20
    // monthHeader = max(12, round(40*1.3)=52, techo del texto)=53, nameGap = round(40*0.35)=14
    // monthH = 240 + 25 + 53 + 14 = 332
    expect(q.monthHeight).toBe(332)
    expect(q.gridGap).toBe(20)
    expect(q.cellGap).toBe(5)
    expect(q.monthHeader).toBe(53)
    expect(q.nameGap).toBe(14)
    expect(q.cols).toBe(4)
    expect(q.visibleSlots).toBe(12)
  })

  it('mantiene la estructura y el tamaño de un layout ya cuantizado invariantes', () => {
    const q = quantizeLayout({ ...base, cellSize: 40 })
    expect(quantizeLayout(q)).toEqual(q)
  })
})

describe('layoutVars', () => {
  it('deriva las variables CSS completas del layout en pasos discretos del tamaño', () => {
    const vars = layoutVars(base)
    expect(vars['--cell-size']).toBe('12px')
    expect(vars['--month-h']).toBe('100px')
    expect(vars['--month-step']).toBe('106px')
    expect(vars['--font-size']).toBe(`${Math.max(0.576, 12 * 0.06)}rem`)
    expect(vars['--title-font-size']).toBe(`${Math.max(0.55, 12 * 0.042)}rem`)
    expect(vars['--grid-gap']).toBe('6px')
  })

  it('el paso del mes suma la altura del mes más el gap de la grilla', () => {
    const vars = layoutVars({ ...base, monthHeight: 80, gridGap: 4 })
    expect(vars['--month-step']).toBe('84px')
  })
})
