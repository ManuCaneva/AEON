import { describe, it, expect } from 'vitest'
import { monthGrid, formatYyyyMmDd, yearBounds, DAY_LABELS, dayIndexOfWeek } from './calendarDates'

describe('calendarDates', () => {
  describe('DAY_LABELS', () => {
    it('tiene 7 días empezando por domingo', () => {
      expect(DAY_LABELS).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S'])
    })
  })

  describe('formatYyyyMmDd', () => {
    it('formatea una fecha en YYYY-MM-DD', () => {
      expect(formatYyyyMmDd(new Date(2026, 0, 1))).toBe('2026-01-01')
      expect(formatYyyyMmDd(new Date(2026, 11, 31))).toBe('2026-12-31')
      expect(formatYyyyMmDd(new Date(2026, 6, 4))).toBe('2026-07-04')
    })
  })

  describe('yearBounds', () => {
    it('retorna inicio y fin del año en ISO', () => {
      const { start, end } = yearBounds(2026)
      expect(start).toMatch(/^2026-01-01/)
      expect(end).toMatch(/^2027-01-01/)
    })
  })

  describe('dayIndexOfWeek', () => {
    it('retorna 0 para lunes y 6 para domingo (week_starts_monday)', () => {
      expect(dayIndexOfWeek(new Date(2026, 0, 5))).toBe(0) // lunes
      expect(dayIndexOfWeek(new Date(2026, 0, 6))).toBe(1) // martes
      expect(dayIndexOfWeek(new Date(2026, 0, 10))).toBe(5) // sábado
      expect(dayIndexOfWeek(new Date(2026, 0, 11))).toBe(6) // domingo
    })

    it('cubre los 7 días de la semana con el mismo orden que DAYS del grid', () => {
      const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      // 2026-01-05 es lunes: recorre la semana completa
      for (let i = 0; i < 7; i++) {
        const index = dayIndexOfWeek(new Date(2026, 0, 5 + i))
        expect(index).toBe(i)
        expect(labels[index]).toBeDefined()
      }
    })
  })

  describe('monthGrid', () => {
    it('retorna 6 semanas × 7 columnas', () => {
      const grid = monthGrid(2026, 0) // enero 2026
      expect(grid).toHaveLength(6)
      for (const week of grid) {
        expect(week).toHaveLength(7)
      }
    })

    it('empieza en domingo y termina en sábado', () => {
      const grid = monthGrid(2026, 0) // enero 2026
      // grid[0][0] is padding from Dec 28
      expect(grid[0][0].dayOfMonth).toBe(28)
      expect(grid[0][6].dayOfMonth).toBe(3)
    })

    it('el 1 del mes cae en la columna correcta (jueves = índice 4)', () => {
      const grid = monthGrid(2026, 0) // enero 2026 empieza jueves
      // Find Jan 1
      for (let w = 0; w < 6; w++) {
        for (let d = 0; d < 7; d++) {
          const cell = grid[w][d]
          if (cell.date === '2026-01-01') {
            expect(d).toBe(4) // jueves
          }
        }
      }
    })

    it('las celdas fuera del mes tienen date=null', () => {
      const grid = monthGrid(2026, 0)
      // Antes del 1 de enero: padding del mes anterior
      expect(grid[0][0].date).toBeNull()
      // Después del 31 de enero: padding del mes siguiente
      expect(grid[5][6].date).toBeNull()
    })

    it('febrero 2026 no bisiesto -> 28 días', () => {
      const grid = monthGrid(2026, 1) // febrero
      let currentMonthCount = 0
      for (const week of grid) {
        for (const cell of week) {
          if (cell.date !== null) currentMonthCount++
        }
      }
      expect(currentMonthCount).toBe(28)
    })

    it('funciona con diciembre donde el grid cruza años', () => {
      const grid = monthGrid(2026, 11) // diciembre 2026
      // 31 Dec 2026 is Thursday
      const daysInMonth = grid.flat().filter((c) => c.date !== null)
      expect(daysInMonth).toHaveLength(31)
      // El primer día (dec 1) es martes
      expect(grid[0][2].dayOfMonth).toBe(1)
      expect(grid[0][2].date).toBe('2026-12-01')
    })
  })
})
