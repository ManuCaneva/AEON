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
    existe(label: string): boolean {
      return estado.presencia[label] !== undefined
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

/** Consulta la dueña desde cada ventana que existe y devuelve la etiqueta de la única dueña. */
async function duena(): Promise<string | null> {
  const etiquetas = [POMODORO_MAIN_LABEL, POMODORO_MINI_LABEL].filter((etiqueta) =>
    ventanas.existe(etiqueta)
  )
  const duenas: string[] = []
  for (const etiqueta of etiquetas) {
    ventanas.estado.etiquetaActual = etiqueta
    if (await isPomodoroOwnerWindow()) duenas.push(etiqueta)
  }
  return duenas.length === 1 ? duenas[0] : null
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

  it('si la API de ventanas no responde, la dueña es la principal: nunca suenan las dos', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ventanas.abrir(POMODORO_MAIN_LABEL)
    ventanas.abrir(POMODORO_MINI_LABEL)
    ventanas.estado.falla = true

    ventanas.estado.etiquetaActual = POMODORO_MAIN_LABEL
    await expect(isPomodoroOwnerWindow()).resolves.toBe(true)
    ventanas.estado.etiquetaActual = POMODORO_MINI_LABEL
    await expect(isPomodoroOwnerWindow()).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  it('en todo escenario hay exactamente una dueña: el aviso nunca suena dos veces', async () => {
    const escenarios: Array<[string, () => void]> = [
      [
        'principal y mini',
        () => {
          ventanas.abrir(POMODORO_MAIN_LABEL)
          ventanas.abrir(POMODORO_MINI_LABEL)
        },
      ],
      ['solo la mini', () => ventanas.abrir(POMODORO_MINI_LABEL)],
      ['solo la principal', () => ventanas.abrir(POMODORO_MAIN_LABEL)],
      [
        'principal oculta',
        () => {
          ventanas.ocultar(POMODORO_MAIN_LABEL)
          ventanas.abrir(POMODORO_MINI_LABEL)
        },
      ],
      [
        'ambas ocultas',
        () => {
          ventanas.ocultar(POMODORO_MAIN_LABEL)
          ventanas.ocultar(POMODORO_MINI_LABEL)
        },
      ],
      [
        'API de ventanas caída',
        () => {
          ventanas.abrir(POMODORO_MAIN_LABEL)
          ventanas.abrir(POMODORO_MINI_LABEL)
          ventanas.estado.falla = true
        },
      ],
    ]

    for (const [nombre, abrir] of escenarios) {
      ventanas.reiniciar()
      abrir()
      expect(await duena(), `escenario: ${nombre}`).not.toBeNull()
    }
  })
})
