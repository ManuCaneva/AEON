import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Guard de configuración: `onCloseRequested` de Tauri delega el cierre a JS.
 * Cuando hay un listener de `tauri://close-requested`, Tauri previene el
 * cierre nativo y la API llama `destroy()` sola. Sin el permiso
 * `core:window:allow-destroy` ese destroy se rechaza y la ventana queda
 * abierta para siempre: la X no cierra ni la mini ni la app.
 */
describe('permisos de cierre de ventanas', () => {
  const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf-8')) as {
    windows: string[]
    permissions: Array<string | { identifier: string }>
  }

  function granted(identifier: string): boolean {
    return capability.permissions.some((permission) =>
      typeof permission === 'string'
        ? permission === identifier
        : permission.identifier === identifier
    )
  }

  it('cubre las dos ventanas que registran el listener de cierre', () => {
    expect(capability.windows).toEqual(expect.arrayContaining(['main', 'pomodoro-mini']))
  })

  it('las deja destruirse desde JS: sin este permiso la X no cierra', () => {
    expect(granted('core:window:allow-destroy')).toBe(true)
  })
})
