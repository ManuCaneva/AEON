import { describe, it, expect } from 'vitest'
import { nextLocalDate } from './allDayEvent'

describe('nextLocalDate', () => {
  it('avanza un día dentro del mismo mes', () => {
    expect(nextLocalDate('2026-01-15')).toBe('2026-01-16')
  })

  it('cruza el fin de mes', () => {
    expect(nextLocalDate('2026-01-31')).toBe('2026-02-01')
    expect(nextLocalDate('2026-04-30')).toBe('2026-05-01')
  })

  it('cruza el fin de año', () => {
    expect(nextLocalDate('2026-12-31')).toBe('2027-01-01')
  })

  it('respeta los años bisiestos', () => {
    expect(nextLocalDate('2028-02-28')).toBe('2028-02-29')
    expect(nextLocalDate('2028-02-29')).toBe('2028-03-01')
    expect(nextLocalDate('2026-02-28')).toBe('2026-03-01')
  })

  it('rechaza una fecha que no es YYYY-MM-DD', () => {
    expect(() => nextLocalDate('2026-1-5')).toThrow()
    expect(() => nextLocalDate('mañana')).toThrow()
  })
})
