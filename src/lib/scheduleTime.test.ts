import { describe, it, expect } from 'vitest'
import { MINUTES_PER_DAY, adaptiveLabelStepMinutes, clampMinutes } from './scheduleTime'

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

describe('adaptiveLabelStepMinutes', () => {
  it('mantiene etiquetas cada hora cuando la grilla es holgada', () => {
    expect(adaptiveLabelStepMinutes(30, 150)).toBe(60)
    expect(adaptiveLabelStepMinutes(15, 60)).toBe(60)
  })

  it('salta a 2 horas cuando dos filas de 30 minutos no alcanzan el espacio mínimo', () => {
    expect(adaptiveLabelStepMinutes(30, 5)).toBe(120)
  })

  it('sigue subiendo el paso a 3, 4, 6 y 12 horas a medida que la grilla se comprime', () => {
    expect(adaptiveLabelStepMinutes(30, 2)).toBe(360)
    expect(adaptiveLabelStepMinutes(30, 1)).toBe(720)
  })

  it('nunca elige un paso menor a la granularidad de edición', () => {
    expect(adaptiveLabelStepMinutes(60, 100)).toBe(60)
    expect(adaptiveLabelStepMinutes(60, 1)).toBe(720)
  })

  it('respeta un espaciado mínimo explícito', () => {
    expect(adaptiveLabelStepMinutes(30, 5, 9)).toBe(60)
    expect(adaptiveLabelStepMinutes(30, 5, 11)).toBe(120)
  })

  it('cae en 12 horas cuando ni el paso máximo entra en el alto disponible', () => {
    expect(adaptiveLabelStepMinutes(30, 0)).toBe(720)
    expect(adaptiveLabelStepMinutes(30, Number.NaN)).toBe(720)
  })
})
