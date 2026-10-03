import { describe, expect, it } from 'vitest'
import { TEXT_SIZES, isTextSize, textSizeScale } from './textSize'

describe('textSize', () => {
  it('expone los tres tamaños válidos', () => {
    expect(TEXT_SIZES).toEqual(['small', 'medium', 'large'])
  })

  it('mapea cada opción a su factor', () => {
    expect(textSizeScale('small')).toBe(0.9)
    expect(textSizeScale('medium')).toBe(1)
    expect(textSizeScale('large')).toBe(1.15)
  })

  it('cae al factor por defecto (Mediano) con valores inválidos', () => {
    expect(textSizeScale('huge')).toBe(1)
    expect(textSizeScale('')).toBe(1)
    expect(textSizeScale(null)).toBe(1)
    expect(textSizeScale(undefined)).toBe(1)
    expect(textSizeScale(42)).toBe(1)
    expect(textSizeScale({})).toBe(1)
  })

  it('isTextSize solo acepta los tamaños conocidos', () => {
    expect(isTextSize('small')).toBe(true)
    expect(isTextSize('medium')).toBe(true)
    expect(isTextSize('large')).toBe(true)
    expect(isTextSize('enorme')).toBe(false)
    expect(isTextSize(7)).toBe(false)
    expect(isTextSize(null)).toBe(false)
  })
})
