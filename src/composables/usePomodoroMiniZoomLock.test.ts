import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { usePomodoroMiniZoomLock } from './usePomodoroMiniZoomLock'

let scope: EffectScope | undefined

function montar(): void {
  scope = effectScope()
  scope.run(() => usePomodoroMiniZoomLock())
}

afterEach(() => {
  scope?.stop()
  scope = undefined
})

describe('usePomodoroMiniZoomLock', () => {
  it('bloquea la rueda con Ctrl o Cmd sin interceptar la rueda común', () => {
    montar()

    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
      const event = new MouseEvent('wheel', { [modifier]: true, cancelable: true })
      expect(window.dispatchEvent(event)).toBe(false)
    }

    expect(window.dispatchEvent(new MouseEvent('wheel', { cancelable: true }))).toBe(true)
  })

  it('bloquea los atajos de zoom y deja pasar el resto del teclado', () => {
    montar()

    for (const [key, code] of [
      ['+', 'NumpadAdd'],
      ['=', 'Equal'],
      ['-', 'Minus'],
      ['_', 'Minus'],
      ['0', 'Digit0'],
    ] as const) {
      const event = new KeyboardEvent('keydown', {
        key,
        code,
        ctrlKey: true,
        cancelable: true,
      })
      expect(window.dispatchEvent(event)).toBe(false)
    }

    for (const event of [
      new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }),
      new KeyboardEvent('keydown', { key: '+', cancelable: true }),
      new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true }),
    ]) {
      expect(window.dispatchEvent(event)).toBe(true)
    }
  })

  it('bloquea los gestos nativos de pellizco y limpia las escuchas al desmontar', () => {
    montar()

    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      expect(window.dispatchEvent(new Event(type, { cancelable: true }))).toBe(false)
    }

    scope?.stop()
    const wheel = new MouseEvent('wheel', { ctrlKey: true, cancelable: true })
    expect(window.dispatchEvent(wheel)).toBe(true)
  })
})
