import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow, type WebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  closePomodoroMiniWindow,
  flushPomodoroMiniWindowClosed,
  getPomodoroMiniOrbRect,
  isPomodoroMiniWindow,
  openPomodoroMiniWindow,
  restorePomodoroMiniWindow,
  setPomodoroMiniGeometry,
  setPomodoroMiniOrbOffset,
  startDraggingPomodoroMiniWindow,
  trackPomodoroMiniWindow,
  POMODORO_MINI_LABEL,
} from './pomodoroMiniWindow'
import {
  POMODORO_ORB_DEFAULT_DIAMETER,
  POMODORO_ORB_MIN_DIAMETER,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
} from './pomodoroMiniLayout'
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
    setSize = vi.fn().mockResolvedValue(undefined)
    setPosition = vi.fn().mockResolvedValue(undefined)
    startDragging = vi.fn().mockResolvedValue(undefined)
    close = vi.fn().mockResolvedValue(undefined)
    outerPosition = vi.fn()
    outerSize = vi.fn()

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

    async onResized(handler: (event: unknown) => unknown): Promise<() => void> {
      this.handlers.set('tauri://resize', handler)
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

/** Config falsa en memoria: lo que se guarda es lo que se recupera. */
let stored: Map<string, string>

function persistMini(state: unknown): void {
  stored.set('pomodoro-mini-window', JSON.stringify(state))
}

function persistedState(): unknown {
  return JSON.parse(stored.get('pomodoro-mini-window') ?? 'null')
}

function resetFakes(): void {
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
}

describe('ventana de la mascota del pomodoro', () => {
  beforeEach(() => {
    constructions.length = 0
    windows.length = 0
    getByLabel.mockReset()
    vi.mocked(currentMonitor).mockReset()
    vi.mocked(getCurrentWebviewWindow).mockReset()
    vi.mocked(db.loadConfig).mockReset().mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockReset().mockResolvedValue(undefined)
  })

  it('crea la mascota como disco cuadrado, sin decoraciones, transparente, siempre arriba y fuera de la taskbar', async () => {
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue(null)

    await openPomodoroMiniWindow()

    expect(constructions).toHaveLength(1)
    expect(constructions[0]).toEqual({
      label: 'pomodoro-mini',
      options: expect.objectContaining({
        url: 'index.html',
        title: 'AEON — Pomodoro',
        width: POMODORO_ORB_DEFAULT_DIAMETER,
        height: POMODORO_ORB_DEFAULT_DIAMETER,
        minWidth: POMODORO_ORB_MIN_DIAMETER,
        minHeight: POMODORO_ORB_MIN_DIAMETER,
        resizable: false,
        alwaysOnTop: true,
        decorations: false,
        transparent: true,
        shadow: false,
        skipTaskbar: true,
        focus: true,
      }),
    })
  })

  it('no impone máximo de ventana: la pastilla necesita crecer más allá del disco', async () => {
    getByLabel.mockResolvedValue(null)
    vi.mocked(currentMonitor).mockResolvedValue(null)

    await openPomodoroMiniWindow()

    expect(constructions[0].options.maxWidth).toBeUndefined()
    expect(constructions[0].options.maxHeight).toBeUndefined()
  })

  it('la mascota es chica de verdad: default de 200px y un mínimo de 140px', () => {
    expect(POMODORO_ORB_DEFAULT_DIAMETER).toBe(200)
    expect(POMODORO_ORB_MIN_DIAMETER).toBe(140)
    expect(POMODORO_ORB_MIN_DIAMETER).toBeLessThan(POMODORO_ORB_DEFAULT_DIAMETER)
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
      x: 1920 + 2560 - POMODORO_ORB_DEFAULT_DIAMETER,
      y: 0 + 1440 - POMODORO_ORB_DEFAULT_DIAMETER,
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
      x: 1280 - POMODORO_ORB_DEFAULT_DIAMETER,
      y: 720 - POMODORO_ORB_DEFAULT_DIAMETER,
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

describe('persistencia de la mascota entre sesiones', () => {
  beforeEach(resetFakes)

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
      x: 1920 + 2560 - POMODORO_ORB_DEFAULT_DIAMETER,
      y: 0 + 1440 - POMODORO_ORB_DEFAULT_DIAMETER,
    })
  })

  it('reabrir con diámetro guardado lo respeta, siempre como cuadrado', async () => {
    persistMini({ isOpen: true, x: 500, y: 400, width: 160, height: 180 })

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ width: 160, height: 160 })
  })

  it('un diámetro guardado imposible se recorta al mínimo en vez de crear una mini diminuta', async () => {
    persistMini({ isOpen: true, x: 500, y: 400, width: 40, height: 20 })

    await restorePomodoroMiniWindow()

    expect(windows[0].options).toMatchObject({
      width: POMODORO_ORB_MIN_DIAMETER,
      height: POMODORO_ORB_MIN_DIAMETER,
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

  it('la restauración no roba el foco: con la mascota ya abierta no la muestra ni la enfoca', async () => {
    persistMini({ isOpen: true, x: 500, y: 400 })
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabel.mockResolvedValue({ show, setFocus })

    await restorePomodoroMiniWindow()

    // Al recrear la ventana principal el foco no rebota a la mascota.
    expect(show).not.toHaveBeenCalled()
    expect(setFocus).not.toHaveBeenCalled()
    expect(constructions).toHaveLength(0)
  })

  it('la restauración la reabre sin foco: el arranque de la app no roba la atención', async () => {
    persistMini({ isOpen: true, x: 500, y: 400 })
    getByLabel.mockResolvedValue(null)

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ focus: false })
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
    expect(vi.mocked(db.loadConfig).mock.calls.map(([key]) => key)).toEqual([
      'pomodoro-mini-window',
    ])
  })

  it('abrir la mascota la deja marcada como abierta, conservando la posición guardada', async () => {
    persistMini({ isOpen: false, x: 500, y: 400 })

    await openPomodoroMiniWindow()

    expect(persistedState()).toEqual({ isOpen: true, x: 500, y: 400, width: null, height: null })
  })

  it('al abrirla con posición guardada la respeta en vez de la esquina por defecto', async () => {
    persistMini({ isOpen: false, x: 500, y: 400 })
    vi.mocked(currentMonitor).mockResolvedValue(
      monitorWith({ x: 1920, y: 0, width: 2560, height: 1440 })
    )

    await openPomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ x: 500, y: 400 })
  })
})

/** La ventana mini actual: la webview que se sigue a sí misma y persiste su estado. */
function registrarMiniActual() {
  type Handler = (event: unknown) => unknown
  const handlers = new Map<string, Handler>()
  const mini = {
    scaleFactorValue: 1,
    handlers,
    scaleFactor: () => Promise.resolve(mini.scaleFactorValue),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    outerPosition: vi.fn(),
    outerSize: vi.fn(),
    onMoved: (handler: Handler) => {
      handlers.set('tauri://move', handler)
      return Promise.resolve(() => {})
    },
    onResized: (handler: Handler) => {
      handlers.set('tauri://resize', handler)
      return Promise.resolve(() => {})
    },
    onCloseRequested: (handler: Handler) => {
      handlers.set('tauri://close-requested', handler)
      return Promise.resolve(() => {})
    },
    emit: (event: string, payload?: unknown) => handlers.get(event)?.({ payload }),
  }
  vi.mocked(getCurrentWebviewWindow).mockReturnValue(mini as unknown as WebviewWindow)
  trackPomodoroMiniWindow()
  return mini
}

describe('ciclo de vida de la mascota', () => {
  beforeEach(() => {
    resetFakes()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persiste la posición al mover la mascota, con una sola escritura por arrastre', async () => {
    const mini = registrarMiniActual()
    mini.scaleFactorValue = 2
    const toLogical = vi.fn().mockReturnValue({ x: 33, y: 44 })

    mini.emit('tauri://move', { toLogical })
    await vi.advanceTimersByTimeAsync(100)
    mini.emit('tauri://move', { toLogical })
    await vi.advanceTimersByTimeAsync(250)

    expect(toLogical).toHaveBeenCalledWith(2)
    expect(persistedState()).toEqual({ isOpen: true, x: 33, y: 44, width: null, height: null })
    // Una sola escritura para todo el arrastre.
    expect(vi.mocked(db.saveConfig).mock.calls).toHaveLength(1)
  })

  it('persiste el diámetro al redimensionar, con una sola escritura por gesto', async () => {
    const mini = registrarMiniActual()
    const toLogical = vi.fn().mockReturnValue({ width: 175, height: 229 })

    mini.emit('tauri://resize', { toLogical })
    await vi.advanceTimersByTimeAsync(100)
    mini.emit('tauri://resize', { toLogical })
    await vi.advanceTimersByTimeAsync(250)

    // El alto de la ventana incluye la pastilla: el ancho es el disco.
    expect(persistedState()).toEqual({ isOpen: true, x: null, y: null, width: 175, height: 175 })
    expect(vi.mocked(db.saveConfig).mock.calls).toHaveLength(1)
  })

  it('mover y redimensionar en el mismo gesto guardan posición y diámetro juntos', async () => {
    const mini = registrarMiniActual()

    mini.emit('tauri://resize', { toLogical: () => ({ width: 150, height: 204 }) })
    mini.emit('tauri://move', { toLogical: () => ({ x: 12, y: 34 }) })
    await vi.advanceTimersByTimeAsync(250)

    expect(persistedState()).toEqual({
      isOpen: true,
      x: 12,
      y: 34,
      width: 150,
      height: 150,
    })
    expect(vi.mocked(db.saveConfig).mock.calls).toHaveLength(1)
  })

  it('la posición persistida es la del disco: corrige el offset de la pastilla flipada', async () => {
    const mini = registrarMiniActual()
    const pillSpace = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT

    // Pastilla arriba: la ventana está `pillSpace` más alta que el disco.
    setPomodoroMiniOrbOffset(pillSpace)
    mini.emit('tauri://move', { toLogical: () => ({ x: 10, y: 46 }) })
    await vi.advanceTimersByTimeAsync(250)

    expect(persistedState()).toEqual({
      isOpen: true,
      x: 10,
      y: 46 + pillSpace,
      width: null,
      height: null,
    })
  })

  it('el offset se captura al moverse, no al persistir: un cambio posterior no corrompe la posición', async () => {
    const mini = registrarMiniActual()
    const pillSpace = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT

    setPomodoroMiniOrbOffset(pillSpace)
    mini.emit('tauri://move', { toLogical: () => ({ x: 10, y: 46 }) })
    // La pastilla se cierra antes de que venza el debounce.
    setPomodoroMiniOrbOffset(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(persistedState()).toEqual({
      isOpen: true,
      x: 10,
      y: 46 + pillSpace,
      width: null,
      height: null,
    })
  })

  it('el seguimiento solo escucha movimiento y tamaño: el cierre lo coordina el store', () => {
    const mini = registrarMiniActual()

    expect(mini.handlers.has('tauri://move')).toBe(true)
    expect(mini.handlers.has('tauri://resize')).toBe(true)
    expect(mini.handlers.has('tauri://close-requested')).toBe(false)
  })

  it('el botón de cerrar la marca cerrada y guarda la última posición movida', async () => {
    const mini = registrarMiniActual()

    mini.emit('tauri://move', { toLogical: () => ({ x: 700, y: 500 }) })
    await flushPomodoroMiniWindowClosed()

    expect(persistedState()).toEqual({ isOpen: false, x: 700, y: 500, width: null, height: null })
  })

  it('el cierre guarda también el último diámetro redimensionado', async () => {
    const mini = registrarMiniActual()

    mini.emit('tauri://resize', { toLogical: () => ({ width: 140, height: 194 }) })
    await flushPomodoroMiniWindowClosed()

    expect(persistedState()).toEqual({ isOpen: false, x: null, y: null, width: 140, height: 140 })
  })

  it('cerrar con el botón de la pastilla persiste el cierre y destruye la ventana', async () => {
    const mini = registrarMiniActual()
    mini.emit('tauri://move', { toLogical: () => ({ x: 700, y: 500 }) })

    await closePomodoroMiniWindow()

    expect(persistedState()).toEqual({ isOpen: false, x: 700, y: 500, width: null, height: null })
    expect(mini.close).toHaveBeenCalledOnce()
  })

  it('cerrar la app con la mascota abierta no la marca cerrada: la próxima sesión la reabre donde quedó', async () => {
    const mini = registrarMiniActual()
    mini.emit('tauri://move', { toLogical: () => ({ x: 700, y: 500 }) })
    await vi.advanceTimersByTimeAsync(250)

    // La app se cierra: la ventana se destruye sin pasar por la acción de cerrar.
    mini.emit('tauri://destroyed', undefined)

    expect(persistedState()).toEqual({ isOpen: true, x: 700, y: 500, width: null, height: null })

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ x: 700, y: 500 })
  })

  it('la sesión siguiente la reabre con el diámetro que le dejó el usuario', async () => {
    const mini = registrarMiniActual()
    mini.emit('tauri://resize', { toLogical: () => ({ width: 275, height: 329 }) })
    await vi.advanceTimersByTimeAsync(250)

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(1)
    expect(windows[0].options).toMatchObject({ width: 275, height: 275 })
  })

  it('tras cerrarla, al reabrirla vuelve a seguir su posición', async () => {
    registrarMiniActual()
    await flushPomodoroMiniWindowClosed()

    await openPomodoroMiniWindow()
    const reabierta = registrarMiniActual()
    reabierta.emit('tauri://move', { toLogical: () => ({ x: 10, y: 20 }) })
    await vi.advanceTimersByTimeAsync(250)

    expect(persistedState()).toEqual({ isOpen: true, x: 10, y: 20, width: null, height: null })
  })

  it('si el usuario la cerró, la próxima restauración no la reabre', async () => {
    registrarMiniActual()
    await flushPomodoroMiniWindowClosed()

    await restorePomodoroMiniWindow()

    expect(windows).toHaveLength(0)
    expect(getByLabel).not.toHaveBeenCalled()
  })
})

describe('geometría de la ventana en vivo', () => {
  beforeEach(() => {
    resetFakes()
    setPomodoroMiniOrbOffset(0)
  })

  it('setPomodoroMiniGeometry mueve y redimensiona la ventana a la geometría del disco', async () => {
    const mini = registrarMiniActual()

    await setPomodoroMiniGeometry({ x: 10, y: 20, width: 200, height: 254 })

    expect(mini.setSize).toHaveBeenCalledOnce()
    expect(mini.setSize.mock.calls[0][0]).toMatchObject({ width: 200, height: 254 })
    expect(mini.setPosition).toHaveBeenCalledOnce()
    expect(mini.setPosition.mock.calls[0][0]).toMatchObject({ x: 10, y: 20 })
  })

  it('el arrastre nativo mueve la ventana con el disco', async () => {
    const mini = registrarMiniActual()

    startDraggingPomodoroMiniWindow()

    expect(mini.startDragging).toHaveBeenCalledOnce()
  })

  it('getPomodoroMiniOrbRect devuelve el disco actual, corregido por el offset de la pastilla', async () => {
    const mini = registrarMiniActual()
    const pillSpace = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT
    const scale = 2
    mini.scaleFactorValue = scale
    mini.outerPosition.mockReturnValue({
      toLogical: (s: number) => {
        expect(s).toBe(scale)
        return { x: 10, y: 46 }
      },
    })
    mini.outerSize.mockReturnValue({
      toLogical: (s: number) => {
        expect(s).toBe(scale)
        return { width: 160, height: 214 }
      },
    })

    setPomodoroMiniOrbOffset(pillSpace)
    await expect(getPomodoroMiniOrbRect()).resolves.toEqual({
      x: 10,
      y: 46 + pillSpace,
      diameter: 160,
    })

    setPomodoroMiniOrbOffset(0)
    await expect(getPomodoroMiniOrbRect()).resolves.toEqual({ x: 10, y: 46, diameter: 160 })
  })
})
