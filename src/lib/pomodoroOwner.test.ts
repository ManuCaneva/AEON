import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPomodoroOwnerWindow } from './pomodoroOwner'
import { POMODORO_MAIN_LABEL } from '@/lib/pomodoroMainWindow'
import { POMODORO_MINI_LABEL } from '@/lib/pomodoroMiniWindow'

type Presencia = 'abierta' | 'oculta'

/**
 * Ventanas de la app simuladas: `getCurrentWebviewWindow` dice desde qué
 * ventana se consulta y `getByLabel` qué ventanas existen. Una ventana oculta
 * o minimizada existe: para el dueño del pomodoro, «abierta» es existir.
 */
const ventanas = vi.hoisted(() => {
  const estado = {
    etiquetaActual: 'main',
    presencia: {} as Record<string, Presencia>,
    falla: false,
  }
  return {
    estado,
    abrir(label: string): void {
      estado.presencia[label] = 'abierta'
    },
    ocultar(label: string): void {
      estado.presencia[label] = 'oculta'
    },
    cerrar(label: string): void {
      delete estado.presencia[label]
    },
    reiniciar(): void {
      estado.etiquetaActual = 'main'
      estado.presencia = {}
      estado.falla = false
    },
  }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ label: ventanas.estado.etiquetaActual }),
  WebviewWindow: {
    getByLabel: (label: string) => {
      if (ventanas.estado.falla) {
        return Promise.reject(new Error('API de ventanas no disponible'))
      }
      const presencia = ventanas.estado.presencia[label]
      return Promise.resolve(
        presencia === undefined
          ? null
          : { isVisible: () => Promise.resolve(presencia === 'abierta') }
      )
    },
  },
}))

/** Consulta la dueña desde las dos ventanas y devuelve la etiqueta de la única dueña. */
async function duena(): Promise<string | null> {
  ventanas.estado.etiquetaActual = POMODORO_MAIN_LABEL
  const esMain = await isPomodoroOwnerWindow()
  ventanas.estado.etiquetaActual = POMODORO_MINI_LABEL
  const esMini = await isPomodoroOwnerWindow()
  if (esMain === esMini) return null
  return esMain ? POMODORO_MAIN_LABEL : POMODORO_MINI_LABEL
}

describe('dueño del pomodoro según qué ventanas están presentes', () => {
  beforeEach(() => {
    ventanas.reiniciar()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('con la principal y la mini abiertas, la dueña es la principal', async () => {
    ventanas.abrir(POMODORO_MAIN_LABEL)
    ventanas.abrir(POMODORO_MINI_LABEL)

    expect(await duena()).toBe(POMODORO_MAIN_LABEL)
  })

  it('con la mini sola, la dueña es la mini', async () => {
    ventanas.abrir(POMODORO_MINI_LABEL)

    expect(await duena()).toBe(POMODORO_MINI_LABEL)
  })

  it('con la principal sola, la dueña es la principal', async () => {
    ventanas.abrir(POMODORO_MAIN_LABEL)

    expect(await duena()).toBe(POMODORO_MAIN_LABEL)
  })

  it('la principal oculta o minimizada sigue siendo la dueña: «abierta» es existir', async () => {
    ventanas.ocultar(POMODORO_MAIN_LABEL)
    ventanas.abrir(POMODORO_MINI_LABEL)

    expect(await duena()).toBe(POMODORO_MAIN_LABEL)
  })

  it('con las dos ventanas ocultas, la dueña sigue siendo la principal', async () => {
    ventanas.ocultar(POMODORO_MAIN_LABEL)
    ventanas.ocultar(POMODORO_MINI_LABEL)

    expect(await duena()).toBe(POMODORO_MAIN_LABEL)
  })

  it('si la API de ventanas no responde, cada ventana se comporta como única', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ventanas.abrir(POMODORO_MAIN_LABEL)
    ventanas.abrir(POMODORO_MINI_LABEL)
    ventanas.estado.falla = true

    ventanas.estado.etiquetaActual = POMODORO_MAIN_LABEL
    await expect(isPomodoroOwnerWindow()).resolves.toBe(true)
    ventanas.estado.etiquetaActual = POMODORO_MINI_LABEL
    await expect(isPomodoroOwnerWindow()).resolves.toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})
