import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootPomodoroMini } from './bootPomodoroMini'
import * as db from '@/lib/db'

const { useHabitsStore, useTasksStore, useGoalsStore, useExamsStore, showPomodoroInMainWindow } =
  vi.hoisted(() => ({
    useHabitsStore: vi.fn(),
    useTasksStore: vi.fn(),
    useGoalsStore: vi.fn(),
    useExamsStore: vi.fn(),
    showPomodoroInMainWindow: vi.fn().mockResolvedValue(undefined),
  }))

vi.mock('@/stores/habits', () => ({ useHabitsStore }))
vi.mock('@/stores/tasks', () => ({ useTasksStore }))
vi.mock('@/stores/goals', () => ({ useGoalsStore }))
vi.mock('@/stores/exams', () => ({ useExamsStore }))
vi.mock('@/lib/pomodoroMainWindow', () => ({ showPomodoroInMainWindow }))

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/pomodoroSounds', () => ({
  createPomodoroSoundPlayer: () => ({
    prepareFromUserGesture: vi.fn().mockResolvedValue(undefined),
    playFocusEndChime: vi.fn(() => true),
    playBreakEndChime: vi.fn(() => true),
    playTestChime: vi.fn(() => true),
  }),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
}))

/**
 * La ventana mini real: la que corre el JS que persiste su propio estado de
 * ventana. Vive en la misma webview que se está cerrando o moviendo, así que
 * el tracking anda aunque la ventana que la creó ya no exista. Cada test crea
 * la suya: el seguimiento se registra una sola vez por ventana.
 */
const { getCurrentWebviewWindow, crearVentanaMini } = vi.hoisted(() => {
  type Handler = (event: unknown) => unknown
  function crearVentanaMini() {
    const handlers = new Map<string, Handler[]>()
    function registrar(event: string, handler: Handler): Promise<() => void> {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
      return Promise.resolve(() => {})
    }
    return {
      label: 'pomodoro-mini',
      async emitir(event: string, payload?: unknown): Promise<void> {
        await Promise.all((handlers.get(event) ?? []).map((handler) => handler({ payload })))
      },
      scaleFactor: () => Promise.resolve(1),
      onMoved: (handler: Handler) => registrar('tauri://move', handler),
      onCloseRequested: (handler: Handler) => registrar('tauri://close-requested', handler),
    }
  }
  return { crearVentanaMini, getCurrentWebviewWindow: vi.fn() }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow,
  WebviewWindow: { getByLabel: vi.fn().mockResolvedValue(null) },
}))

function countdown(): string {
  return (
    document.querySelector('[data-testid="pomodoro-mini-countdown"]')?.textContent?.trim() ?? ''
  )
}

/** Último estado de la ventana mini escrito en la config. */
function estadoDeVentanaPersistido(): unknown {
  const escritas = vi
    .mocked(db.saveConfig)
    .mock.calls.filter(([key]) => key === 'pomodoro-mini-window')
  return JSON.parse(escritas[escritas.length - 1]?.[1] ?? 'null')
}

describe('arranque de la ventana mini', () => {
  let ventanaMini: ReturnType<typeof crearVentanaMini>

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    showPomodoroInMainWindow.mockClear()
    ventanaMini = crearVentanaMini()
    getCurrentWebviewWindow.mockReturnValue(ventanaMini)
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00.000Z'))
    // Config en memoria: lo que se guarda es lo que se recupera, como en SQLite.
    const config = new Map<string, string>()
    vi.mocked(db.loadConfig).mockImplementation(async (key) => config.get(key) ?? null)
    vi.mocked(db.saveConfig).mockImplementation(async (key, value) => {
      config.set(key, value)
    })
    vi.mocked(db.saveConfig).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('monta la réplica y arranca el reloj compartido, con tema y escala de texto propios', async () => {
    localStorage.setItem('aeon.textSize', JSON.stringify('large'))
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-session'
        ? JSON.stringify({
            phase: 'focus',
            isRunning: true,
            endsAt: '2026-09-01T12:25:00.000Z',
            remainingMs: null,
            completedFocusSessions: 0,
          })
        : null
    )

    await bootPomodoroMini()

    expect(document.querySelector('[data-testid="pomodoro-mini"]')).not.toBeNull()
    expect(countdown()).toBe('25:00')
    expect(document.documentElement.style.getPropertyValue('--color-canvas')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15')

    await vi.advanceTimersByTimeAsync(3_000)
    expect(countdown()).toBe('24:57')
  })

  it('no dispara el arranque completo de la app: ningún dominio se carga', async () => {
    await bootPomodoroMini()

    expect(useHabitsStore).not.toHaveBeenCalled()
    expect(useTasksStore).not.toHaveBeenCalled()
    expect(useGoalsStore).not.toHaveBeenCalled()
    expect(useExamsStore).not.toHaveBeenCalled()
  })

  it('el título de la mini pide la página Pomodoro en la ventana principal, con click y teclado', async () => {
    await bootPomodoroMini()
    const header = document.querySelector('[data-testid="pomodoro-mini-header"]')
    const title = document.querySelector('[data-testid="pomodoro-mini-header-title"]')

    header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    title?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    title?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    title?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))

    expect(showPomodoroInMainWindow).toHaveBeenCalledTimes(4)
  })

  it('el disco y los controles de la mini no piden navegación', async () => {
    await bootPomodoroMini()
    const click = (testId: string) =>
      document
        .querySelector(`[data-testid="${testId}"]`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    click('pomodoro-mini-disc')
    click('pomodoro-mini-reset')
    click('pomodoro-mini-toggle')
    click('pomodoro-mini-skip')

    expect(showPomodoroInMainWindow).not.toHaveBeenCalled()
  })

  it('la mini persiste su propio cierre y su posición, aunque la ventana que la creó ya no exista', async () => {
    await bootPomodoroMini()

    await ventanaMini.emitir('tauri://move', { toLogical: () => ({ x: 120, y: 340 }) })
    await vi.advanceTimersByTimeAsync(250)
    expect(estadoDeVentanaPersistido()).toEqual({ isOpen: true, x: 120, y: 340 })

    await ventanaMini.emitir('tauri://close-requested', { preventDefault: () => {} })
    expect(estadoDeVentanaPersistido()).toEqual({ isOpen: false, x: 120, y: 340 })
  })
})
