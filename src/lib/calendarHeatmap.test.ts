import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  MIN_TIRA_CELL,
  buildYearStrip,
  columnOwnerMonth,
  computeStripCellSize,
  loadStripPreference,
  monthDividers,
  resolveStripMode,
  saveStripPreference,
  stripGap,
} from './calendarHeatmap'

describe('calendarHeatmap', () => {
  describe('buildYearStrip', () => {
    it('cubre cada día del año exactamente una vez', () => {
      for (const year of [2025, 2026, 2024]) {
        const { weeks } = buildYearStrip(year)
        const dates = weeks
          .flatMap((w) => w.cells)
          .filter((c) => c.date !== null)
          .map((c) => c.date as string)
        const daysInYear =
          new Date(year, 11, 31).getDate() === 31
            ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
              ? 366
              : 365
            : 365
        expect(new Set(dates).size).toBe(daysInYear)
        expect(dates).toContain(`${year}-01-01`)
        expect(dates).toContain(`${year}-12-31`)
      }
    })

    it('alinea las semanas de domingo a sábado', () => {
      const { weeks } = buildYearStrip(2026)
      // 2026-01-01 fue jueves: la primera columna debe tener null en Dom-Mié
      expect(weeks[0].cells[0].date).toBeNull()
      expect(weeks[0].cells[4].date).toBe('2026-01-01')
      for (const week of weeks) {
        expect(week.cells).toHaveLength(7)
      }
      // Cada columna consecutiva avanza 7 días en la misma fila
      const first = weeks[0].cells[4].date
      const second = weeks[1].cells[4].date
      expect(first).not.toBeNull()
      expect(second).not.toBeNull()
      const diff =
        (new Date(second as string).getTime() - new Date(first as string).getTime()) / 86400000
      expect(diff).toBe(7)
    })

    it('los spans de los 12 meses cubren todas las columnas en orden', () => {
      const { weeks, spans } = buildYearStrip(2026)
      expect(spans).toHaveLength(12)
      let cursor = 0
      spans.forEach((span, month) => {
        expect(span.month).toBe(month)
        expect(span.span).toBeGreaterThanOrEqual(1)
        expect(span.startCol).toBe(cursor)
        cursor += span.span
      })
      expect(cursor).toBe(weeks.length)
    })
  })

  describe('columnOwnerMonth', () => {
    it('asigna por mayoría y desempata con el miércoles', () => {
      const { weeks } = buildYearStrip(2026)
      for (const week of weeks) {
        const owner = columnOwnerMonth(week)
        expect(owner).toBeGreaterThanOrEqual(0)
        expect(owner).toBeLessThanOrEqual(11)
      }
      // Semana que contiene el 2026-03-31 (mar) y 2026-04-01 (mié):
      // 5 días de abril vs 2 de marzo -> abril
      const shared = weeks.find((w) => w.cells.some((c) => c.date === '2026-03-31'))!
      expect(shared.cells.some((c) => c.date === '2026-04-01')).toBe(true)
      expect(columnOwnerMonth(shared)).toBe(3)
    })
  })

  describe('monthDividers', () => {
    it('devuelve 11 divisores con paths ortogonales escalonados', () => {
      const { weeks, spans } = buildYearStrip(2026)
      const dividers = monthDividers(weeks, spans)
      expect(dividers).toHaveLength(11)
      dividers.forEach((d, i) => {
        expect(d.fromMonth).toBe(i)
        expect(d.toMonth).toBe(i + 1)
        // 1 punto inicial + 7 verticales + 6 conectores = 14
        expect(d.points).toHaveLength(14)
        // Ortogonal: cada paso mueve solo x o solo y
        for (let k = 1; k < d.points.length; k++) {
          const dx = d.points[k].x - d.points[k - 1].x
          const dy = d.points[k].y - d.points[k - 1].y
          expect(dx === 0 || dy === 0).toBe(true)
        }
        // Empieza arriba (y=0) y termina abajo (y=7)
        expect(d.points[0].y).toBe(0)
        expect(d.points[d.points.length - 1].y).toBe(7)
      })
    })

    it('el divisor dobla dentro de la columna compartida (no es recto)', () => {
      const { weeks, spans } = buildYearStrip(2026)
      const dividers = monthDividers(weeks, spans)
      // Mar|Abr 2026 comparte columna -> el path debe tener un jog horizontal
      const marAbr = dividers[2]
      const xs = new Set(marAbr.points.map((p) => p.x))
      expect(xs.size).toBeGreaterThan(1)
    })
  })

  describe('resolveStripMode', () => {
    it('respeta la preferencia explícita', () => {
      expect(resolveStripMode('meses', 1200, 300)).toBe('meses')
      expect(resolveStripMode('tira', 300, 900)).toBe('tira')
    })

    it('en auto, ancho > alto*1.15 va a tira', () => {
      expect(resolveStripMode('auto', 1200, 600)).toBe('tira')
    })

    it('en auto, alto >= ancho va a meses', () => {
      expect(resolveStripMode('auto', 600, 900)).toBe('meses')
      expect(resolveStripMode('auto', 600, 600)).toBe('meses')
    })

    it('en auto, la zona gris 1.0-1.15 conserva el modo anterior (histéresis)', () => {
      expect(resolveStripMode('auto', 1100, 1000, undefined, undefined, 'tira')).toBe('tira')
      expect(resolveStripMode('auto', 1100, 1000, undefined, undefined, 'meses')).toBe('meses')
    })

    it('en auto, el tamaño 1x1 siempre va a meses', () => {
      expect(resolveStripMode('auto', 2000, 200, 1, 1)).toBe('meses')
      expect(resolveStripMode('auto', 2000, 200, 2, 2)).toBe('tira')
    })
  })

  describe('computeStripCellSize', () => {
    it('nunca baja del mínimo legible', () => {
      expect(MIN_TIRA_CELL).toBe(9)
      expect(computeStripCellSize(60, 60)).toBe(MIN_TIRA_CELL)
      expect(computeStripCellSize(300, 2000)).toBe(MIN_TIRA_CELL)
    })

    it('llena el alto sin tope: celdas grandes si sobra espacio', () => {
      // Alto 200 con gap 8 (0.40): (200-16-24-48)/7 = 16 — lo que entra de verdad
      expect(computeStripCellSize(2000, 200)).toBe(16)
      // Sin tope superior: el widget manda (gap proporcional refinado)
      expect(computeStripCellSize(5000, 5000)).toBe(57)
    })

    it('la limita el ancho en widgets angostos', () => {
      // 500px de ancho: (500-124)/53 = 7 -> piso 9
      expect(computeStripCellSize(500, 300)).toBe(MIN_TIRA_CELL)
    })

    it('crece con el espacio disponible', () => {
      expect(computeStripCellSize(900, 300)).toBe(10)
      expect(computeStripCellSize(1400, 500)).toBe(16)
    })
  })

  describe('stripGap', () => {
    it('gap proporcional a la celda con piso 2', () => {
      expect(stripGap(9)).toBe(4)
      expect(stripGap(12)).toBe(5)
      expect(stripGap(21)).toBe(8)
      expect(stripGap(30)).toBe(12)
      expect(stripGap(50)).toBe(20)
    })
  })

  describe('persistencia de preferencia', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('default auto sin valor guardado', () => {
      const values = new Map<string, string>()
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
        clear: () => values.clear(),
      })
      expect(loadStripPreference()).toBe('auto')
      saveStripPreference('tira')
      expect(loadStripPreference()).toBe('tira')
    })

    it('ignora valores inválidos', () => {
      const values = new Map<string, string>([['aeon:yearcal-mode', 'diagonal']])
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
        clear: () => values.clear(),
      })
      expect(loadStripPreference()).toBe('auto')
    })

    it('no lanza sin localStorage', () => {
      vi.stubGlobal('localStorage', undefined)
      expect(() => loadStripPreference()).not.toThrow()
      expect(loadStripPreference()).toBe('auto')
      expect(() => saveStripPreference('tira')).not.toThrow()
    })
  })
})
