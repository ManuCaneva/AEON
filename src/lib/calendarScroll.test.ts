import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  YEARCAL_SCROLL_KEY,
  clampScrollFraction,
  loadScrollFraction,
  saveScrollFraction,
} from './calendarScroll'

describe('calendarScroll', () => {
  let values: Map<string, string>

  beforeEach(() => {
    values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
      clear: () => values.clear(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expone la clave con prefijo aeon:', () => {
    expect(YEARCAL_SCROLL_KEY).toBe('aeon:yearcal-scroll')
  })

  it('sin nada guardado devuelve null', () => {
    expect(loadScrollFraction()).toBeNull()
  })

  it('guarda y lee la fracción (ida y vuelta)', () => {
    saveScrollFraction(0.5)
    expect(loadScrollFraction()).toBe(0.5)
  })

  it('clampea fuera de rango al guardar y al leer', () => {
    saveScrollFraction(2)
    expect(loadScrollFraction()).toBe(1)
    saveScrollFraction(-3)
    expect(loadScrollFraction()).toBe(0)
    values.set(YEARCAL_SCROLL_KEY, '7')
    expect(loadScrollFraction()).toBe(1)
  })

  it('valor corrupto devuelve null', () => {
    values.set(YEARCAL_SCROLL_KEY, 'no-un-numero')
    expect(loadScrollFraction()).toBeNull()
  })

  it('no lanza sin localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => loadScrollFraction()).not.toThrow()
    expect(loadScrollFraction()).toBeNull()
    expect(() => saveScrollFraction(0.5)).not.toThrow()
  })

  it('clampScrollFraction tolera NaN e infinitos', () => {
    expect(clampScrollFraction(Number.NaN)).toBe(0)
    expect(clampScrollFraction(Number.POSITIVE_INFINITY)).toBe(1)
    expect(clampScrollFraction(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
