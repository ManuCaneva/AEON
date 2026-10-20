import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow, type WebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  isPomodoroMiniWindow,
  openPomodoroMiniWindow,
  restorePomodoroMiniWindow,
  POMODORO_MINI_LABEL,
} from './pomodoroMiniWindow'
import * as db from '@/lib/db'

const { constructions, windows, getByLabel } = vi.hoisted(() => ({
  constructions: [] as Array<{ label: string; options: Record<string, unknown> }>,
  windows: [] as FakeMiniWindow[],
  getByLabel: vi.fn(),
}))

/** Superficie de ventana que usa el módulo: listeners, escala y ciclo de vida. */
interface FakeMiniWindow {
  label: string
  options: Record<string, unknown>
  scaleFactorValue: number
  emit: (event: string, payload?: unknown) => unknown
}

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {
    static getByLabel = getByLabel
    label: string
    options: Record<string, unknown>
    scaleFactorValue = 1
    handlers = new Map<string, (event: unknown) => unknown>()

    constructor(label: string, options: Record<string, unknown>) {
      this.label = label
      this.options = options
      constructions.push({ label, options })
      windows.push(this as unknown as FakeMiniWindow)
    }

    async scaleFactor(): Promise<number> {
      return this.scaleFactorValue
    }

    async onMoved(handler: (event: unknown) => unknown): Promise<() => void> {
      this.handlers.set('tauri://move', handler)
      return () => {}
    }

    async onCloseRequested(handler: (event: unknown) => unknown): Promise<() => void> {
      this.handlers.set('tauri://close-requested', handler)
      return () => {}
    }

    async listen(event: string, handler: (event: unknown) => unknown): Promise<() => void> {
      this.handlers.set(event, handler)
      return () => {}
    }

    async once(event: string, handler: (event: unknown) => unknown): Promise<() => void> {
      this.handlers.set(event, handler)
      return () => {}
    }

    async show(): Promise<void> {}

    async setFocus(): Promise<void> {}

    emit(event: string, payload?: unknown): unknown {
      return this.handlers.get(event)?.({ payload })
    }
  },
  getCurrentWebviewWindow: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  currentMonitor: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}))

function monitorWith(rect: { x: number; y: number; width: number; height: number }): Monitor {
  return {
    scaleFactor: 1,
    size: { toLogical: () => ({ width: rect.width, height: rect.height }) },
    position: { toLogical: () => ({ x: rect.x, y: rect.y }) },
  } as unknown as Monitor
}

describe('ventana mini del pomodoro', () => {
  beforeEach(() => {
    constructions.length = 0
    windows.length = 0
    getByLabel.mockReset()
    vi.mocked(currentMonitor).mockReset()
    vi.mocked(getCurrentWebviewWindow).mockReset()
    vi.mocked(db.loadConfig).mockReset().mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockReset().mockResolvedValue(undefined)
  })

  it('crea la ventana mini con geometría fija, siempre arriba y decoración del sistema', async () => {
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue(null)

    await openPomodoroMiniWindow()

    expect(constructions).toHaveLength(1)
    expect(constructions[0]).toEqual({
      label: 'pomodoro-mini',
      options: expect.objectContaining({
        url: 'index.html',
        title: 'AEON — Pomodoro',
        width: 300,
        height: 320,
        resizable: false,
        alwaysOnTop: true,
        decorations: true,
      }),
    })
  })

  it('si la ventana ya existe la enfoca y no crea una segunda', async () => {
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabel.mockResolvedValue({ show, setFocus })

    await openPomodoroMiniWindow()

    expect(getByLabel).toHaveBeenCalledWith('pomodoro-mini')
    expect(constructions).toHaveLength(0)
    expect(show).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
  })

  it('la abre en la esquina inferior derecha del monitor de la ventana principal', async () => {
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue(
      monitorWith({ x: 1920, y: 0, width: 2560, height: 1440 })
    )

    await openPomodoroMiniWindow()

    expect(constructions[0].options).toMatchObject({
      x: 1920 + 2560 - 300,
      y: 0 + 1440 - 320,
    })
  })

  it('usa píxeles lógicos según la escala del monitor', async () => {
    const toLogical = vi.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 720 })
    const sizeToLogical = vi.fn().mockReturnValue({ width: 1280, height: 720 })
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 2,
      size: { toLogical: sizeToLogical },
      position: { toLogical },
    } as unknown as Monitor)

    await openPomodoroMiniWindow()

    expect(sizeToLogical).toHaveBeenCalledWith(2)
    expect(toLogical).toHaveBeenCalledWith(2)
    expect(constructions[0].options).toMatchObject({
      x: 1280 - 300,
      y: 720 - 320,
    })
  })

  it('deja la posición al sistema cuando no hay monitor disponible', async () => {
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue(null)

    await openPomodoroMiniWindow()

    expect(constructions[0].options.x).toBeUndefined()
    expect(constructions[0].options.y).toBeUndefined()
  })

  it('reconoce cuándo esta webview es la ventana mini', () => {
    vi.mocked(getCurrentWebviewWindow).mockReturnValue({
      label: POMODORO_MINI_LABEL,
    } as unknown as WebviewWindow)
    expect(isPomodoroMiniWindow()).toBe(true)

    vi.mocked(getCurrentWebviewWindow).mockReturnValue({
      label: 'main',
    } as unknown as WebviewWindow)
    expect(isPomodoroMiniWindow()).toBe(false)
  })
})

describe('persistencia de la ventana mini entre sesiones', () => {
  let stored: Map<string, string>

  function persistMini(state: unknown): void {
    stored.set('pomodoro-mini-window', JSON.stringify(state))
  }

  function persistedState(): unknown {
    return JSON.parse(stored.get('pomodoro-mini-window') ?? 'null')
  }

  beforeEach(() => {
    stored = new Map()
    constructions.length = 0
    windows.length = 0
    getByLabel.mockReset().mockResolvedValue(null)
    vi.mocked(currentMonitor).mockReset().mockResolvedValue(null)
    vi.mocked(db.loadConfig)
      .mockReset()
      .mockImplementation(async (key) => stored.get(key) ?? null)
    vi.mocked(db.saveConfig)
      .mockReset()
      .mockImplementation(async (key, value) => {
        stored.set(key, value)
      })
  })

  it('si estaba abierta al cerrar la app, la reabre en la posición donde quedó', async () => {
    persistMini({ isOpen: true, x: 1620, y: 1120 })

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ x: 1620, y: 1120 })
  })

  it('sin posición guardada la reabre en la esquina inferior derecha del monitor', async () => {
    persistMini({ isOpen: true, x: null, y: null })
    vi.mocked(currentMonitor).mockResolvedValue(
      monitorWith({ x: 1920, y: 0, width: 2560, height: 1440 })
    )

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({
      x: 1920 + 2560 - 300,
      y: 0 + 1440 - 320,
    })
  })

  it('si el usuario la cerró, no la reabre', async () => {
    persistMini({ isOpen: false, x: 1620, y: 1120 })

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(0)
    expect(getByLabel).not.toHaveBeenCalled()
  })

  it('primera ejecución sin datos persistidos: no abre nada', async () => {
    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(0)
    expect(getByLabel).not.toHaveBeenCalled()
  })

  it('un estado persistido corrupto no abre nada (fallback a cerrada)', async () => {
    stored.set('pomodoro-mini-window', '{roto')

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(0)
    expect(getByLabel).not.toHaveBeenCalled()
  })

  it.each([
    [
      'idle',
      {
        phase: 'focus',
        isRunning: false,
        endsAt: null,
        remainingMs: 25 * 60_000,
        completedFocusSessions: 0,
      },
    ],
    [
      'corriendo',
      {
        phase: 'focus',
        isRunning: true,
        endsAt: '2026-09-01T12:25:00.000Z',
        remainingMs: null,
        completedFocusSessions: 0,
      },
    ],
    [
      'en pausa',
      {
        phase: 'shortBreak',
        isRunning: false,
        endsAt: null,
        remainingMs: 5 * 60_000,
        completedFocusSessions: 1,
      },
    ],
  ])('la reapertura no depende del temporizador (%s)', async (_label, session) => {
    persistMini({ isOpen: true, x: 10, y: 20 })
    stored.set('pomodoro-session', JSON.stringify(session))

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ x: 10, y: 20 })
    // Solo consulta el estado de la ventana, nunca la sesión del temporizador.
    expect(vi.mocked(db.loadConfig).mock.calls.map(([key]) => key)).toEqual(['pomodoro-mini-window'])
  })

  it('abrir la mini la deja marcada como abierta, conservando la posición guardada', async () => {
    persistMini({ isOpen: false, x: 500, y: 400 })

    await openPomodoroMiniWindow()

    expect(persistedState()).toEqual({ isOpen: true, x: 500, y: 400 })
  })

  it('al abrir la mini con posición guardada la respeta en vez de la esquina por defecto', async () => {
    persistMini({ isOpen: false, x: 500, y: 400 })
    vi.mocked(currentMonitor).mockResolvedValue(
      monitorWith({ x: 1920, y: 0, width: 2560, height: 1440 })
    )

    await openPomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ x: 500, y: 400 })
  })
})
