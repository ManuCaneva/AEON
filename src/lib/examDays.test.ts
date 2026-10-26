import { describe, it, expect } from 'vitest'
import { daysUntil, daysLabel } from './examDays'

// Hoy fijo (día local): sábado 27 de junio de 2026. Todos los casos
// esperados son ejemplos trabajados a mano, no derivados del código.
const today = new Date(2026, 5, 27)

describe('examDays - daysUntil', () => {
  it('devuelve 0 para hoy, 1 para mañana y -1 para ayer', () => {
    expect(daysUntil('2026-06-27', today)).toBe(0)
    expect(daysUntil('2026-06-28', today)).toBe(1)
    expect(daysUntil('2026-06-26', today)).toBe(-1)
  })

  it('cuenta a través del cambio de mes', () => {
    expect(daysUntil('2026-07-01', today)).toBe(4)
    expect(daysUntil('2026-05-27', today)).toBe(-31)
  })

  it('cuenta a través del cambio de año', () => {
    expect(daysUntil('2027-01-01', today)).toBe(188)
    expect(daysUntil('2025-12-31', today)).toBe(-178)
  })
})

describe('examDays - daysLabel', () => {
  it('un examen de hoy dice "hoy"', () => {
    expect(daysLabel('2026-06-27', today)).toBe('hoy')
  })

  it('un examen de mañana dice "mañana" (no "faltan 1 días")', () => {
    expect(daysLabel('2026-06-28', today)).toBe('mañana')
  })

  it('un examen futuro lejano dice "faltan N días"', () => {
    expect(daysLabel('2026-07-18', today)).toBe('faltan 21 días')
  })

  it('un examen pasado dice "hace N días", con singular en el borde -1', () => {
    expect(daysLabel('2026-06-26', today)).toBe('hace 1 día')
    expect(daysLabel('2026-06-25', today)).toBe('hace 2 días')
  })

  it('cruza mes y año sin corrimiento', () => {
    expect(daysLabel('2026-07-01', today)).toBe('faltan 4 días')
    expect(daysLabel('2027-01-01', today)).toBe('faltan 188 días')
    expect(daysLabel('2025-12-31', today)).toBe('hace 178 días')
  })

  it('usa la fecha local de hoy por defecto', () => {
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(daysLabel(localToday)).toBe('hoy')
  })
})
