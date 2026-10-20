import { describe, it, expect } from 'vitest'
import { MINUTES_PER_DAY, clampMinutes } from './scheduleTime'

describe('MINUTES_PER_DAY', () => {
  it('es la cantidad de minutos de un día completo', () => {
    expect(MINUTES_PER_DAY).toBe(24 * 60)
  })
})

describe('clampMinutes', () => {
  it('recorta al día completo por defecto', () => {
    expect(clampMinutes(-30)).toBe(0)
    expect(clampMinutes(725)).toBe(725)
    expect(clampMinutes(1500)).toBe(MINUTES_PER_DAY)
  })

  it('respeta los límites explícitos de un rango', () => {
    const maxStart = MINUTES_PER_DAY - 45

    expect(clampMinutes(9999, 0, maxStart)).toBe(maxStart)
    expect(clampMinutes(1000, 1020, MINUTES_PER_DAY)).toBe(1020)
  })
})
