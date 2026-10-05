import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './semver'

describe('isNewerVersion', () => {
  it('detecta un patch más nuevo', () => {
    expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true)
  })

  it('detecta un minor más nuevo', () => {
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
  })

  it('detecta un major más nuevo', () => {
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
  })

  it('no considera nueva una versión igual', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
  })

  it('no considera nueva una versión menor', () => {
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(false)
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false)
  })

  it('compara numéricamente y no lexicográficamente', () => {
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true)
    expect(isNewerVersion('0.9.0', '0.10.0')).toBe(false)
    expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true)
  })

  it('ignora el prefijo v', () => {
    expect(isNewerVersion('v0.1.1', '0.1.0')).toBe(true)
    expect(isNewerVersion('0.1.1', 'v0.1.0')).toBe(true)
    expect(isNewerVersion('v0.1.0', 'v0.1.0')).toBe(false)
  })

  it('tolera versiones de dos componentes tratando el patch como 0', () => {
    expect(isNewerVersion('0.2', '0.1.0')).toBe(true)
    expect(isNewerVersion('0.1', '0.1.0')).toBe(false)
  })

  it('sin versión actual, cualquier versión válida es nueva', () => {
    expect(isNewerVersion('0.1.0', null)).toBe(true)
    expect(isNewerVersion('0.1.0', undefined)).toBe(true)
    expect(isNewerVersion('0.1.0', '')).toBe(true)
    expect(isNewerVersion('0.1.0', '   ')).toBe(true)
  })

  it('devuelve false ante strings inválidos', () => {
    expect(isNewerVersion('basura', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.1.0', 'basura')).toBe(false)
    expect(isNewerVersion('', '0.1.0')).toBe(false)
    expect(isNewerVersion('v', '0.1.0')).toBe(false)
  })
})
