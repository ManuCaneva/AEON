import { describe, it, expect } from 'vitest'
import { blockColorVar, blockColorRgb, blockColorTint, colorWithAlpha } from './scheduleColors'

describe('scheduleColors', () => {
  describe('blockColorVar', () => {
    it('mapea cada token de bloque a su CSS var', () => {
      expect(blockColorVar('lavender')).toBe('--color-block-lavender')
      expect(blockColorVar('green')).toBe('--color-block-green')
      expect(blockColorVar('yellow')).toBe('--color-block-yellow')
      expect(blockColorVar('red')).toBe('--color-block-red')
      expect(blockColorVar('pink')).toBe('--color-block-pink')
      expect(blockColorVar('cyan')).toBe('--color-block-cyan')
      expect(blockColorVar('orange')).toBe('--color-block-orange')
      expect(blockColorVar('bone')).toBe('--color-block-bone')
    })
  })

  describe('blockColorRgb', () => {
    it('devuelve el color sólido como rgb(var(...))', () => {
      expect(blockColorRgb('cyan')).toBe('rgb(var(--color-block-cyan))')
      expect(blockColorRgb('lavender')).toBe('rgb(var(--color-block-lavender))')
    })
  })

  describe('blockColorTint', () => {
    it('devuelve el tinte translúcido como rgb(var(...) / alpha)', () => {
      expect(blockColorTint('lavender', 0.15)).toBe('rgb(var(--color-block-lavender) / 0.15)')
      expect(blockColorTint('bone', 1)).toBe('rgb(var(--color-block-bone) / 1)')
    })
  })

  describe('colorWithAlpha', () => {
    it('aplica alpha a un color de bloque rgb(var(...))', () => {
      expect(colorWithAlpha('rgb(var(--color-block-green))', 0.26)).toBe(
        'rgb(var(--color-block-green) / 0.26)'
      )
    })

    it('convierte un hex de 6 dígitos a rgba', () => {
      expect(colorWithAlpha('#7986cb', 0.4)).toBe('rgba(121, 134, 203, 0.4)')
    })

    it('convierte un hex corto a rgba', () => {
      expect(colorWithAlpha('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)')
    })

    it('devuelve el color tal cual si el formato es desconocido', () => {
      expect(colorWithAlpha('tomato', 0.3)).toBe('tomato')
    })
  })
})
