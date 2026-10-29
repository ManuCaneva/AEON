import { describe, it, expect } from 'vitest'
import { fitScale } from './fitScale'

describe('fitScale', () => {
  it('devuelve 1 cuando el diseño entra holgado en el viewport', () => {
    expect(fitScale(1024, 840, 1920, 1080)).toBe(1)
    expect(fitScale(1024, 840, 1366, 900)).toBe(1)
  })

  it('achica por altura cuando el viewport es más bajo que el diseño', () => {
    const scale = fitScale(1024, 840, 1366, 488)
    expect(scale).toBeCloseTo((488 - 32) / 840)
  })

  it('achica por ancho cuando el viewport es más angosto que el diseño', () => {
    const scale = fitScale(1024, 840, 544, 1080)
    expect(scale).toBeCloseTo((544 - 32) / 1024)
  })

  it('usa el margen recibido por parámetro', () => {
    const scale = fitScale(1000, 1000, 500, 500, 100)
    expect(scale).toBeCloseTo(400 / 1000)
  })

  it('nunca devuelve más de 1 ni valores negativos', () => {
    expect(fitScale(1024, 840, 2560, 1440)).toBe(1)
    expect(fitScale(1024, 840, 16, 16)).toBeGreaterThanOrEqual(0)
  })

  it('proporciona el mismo factor de escala en ancho y alto', () => {
    const scale = fitScale(800, 600, 432, 332)
    expect(scale).toBeCloseTo(0.5)
    expect(scale).toBeCloseTo((432 - 32) / 800)
    expect(scale).toBeCloseTo((332 - 32) / 600)
  })
})
