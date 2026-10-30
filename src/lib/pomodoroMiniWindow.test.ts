import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  type Moved = (event: {
    payload: { toLogical: (scale: number) => { x: number; y: number } }
  }) => void
  const windows: Array<{
    label: string
    options: Record<string, unknown>
    close: ReturnType<typeof vi.fn>
    startDragging: ReturnType<typeof vi.fn>
    scaleFactor: ReturnType<typeof vi.fn>
    onMoved: ReturnType<typeof vi.fn>
  }> = []
  const state = { current: null as (typeof windows)[number] | null, moved: null as Moved | null }

  class FakeWindow {
    label: string
    options: Record<string, unknown>
    close = vi.fn(async () => {})
    startDragging = vi.fn(async () => {})
    scaleFactor = vi.fn(async () => 1)
    onMoved = vi.fn(async (cb: Moved) => {
      state.moved = cb
      return () => {}
    })
    isVisible = vi.fn(async () => false)
    once = vi.fn()
    show = vi.fn(async () => {})
    setFocus = vi.fn(async () => {})
    emit = vi.fn(async () => {})

    constructor(label: string, options: Record<string, unknown>) {
      this.label = label
      this.options = options
      windows.push(this)
    }

    static getByLabel = vi.fn(
      async (label: string) => windows.find((window) => window.label === label) ?? null
    )
  }

  return {
    windows,
    state,
    FakeWindow,
    monitor: {
      size: { toLogical: () => ({ width: 1360, height: 768 }) },
      position: { toLogical: () => ({ x: 0, y: 0 }) },
      scaleFactor: 1,
    },
    loadState: vi.fn(),
    saveState: vi.fn(),
    windowExists: vi.fn(),
    focusWindow: vi.fn(),
  }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: h.FakeWindow,
  getCurrentWebviewWindow: () => h.state.current,
}))

vi.mock('@tauri-apps/api/window', () => ({
  currentMonitor: vi.fn(async () => h.monitor),
}))

vi.mock('@/lib/pomodoroMiniWindowState', () => ({
  loadPomodoroMiniWindowState: h.loadState,
  savePomodoroMiniWindowState: h.saveState,
}))

vi.mock('@/lib/appWindows', () => ({
  windowExists: h.windowExists,
  focusWindow: h.focusWindow,
}))

import {
  POMODORO_MINI_LABEL,
  closePomodoroMiniWindow,
  isPomodoroMiniWindow,
  openPomodoroMiniWindow,
  restorePomodoroMiniWindow,
  startDraggingPomodoroMiniWindow,
  trackPomodoroMiniWindow,
  showReadyPomodoroMiniWindow,
} from './pomodoroMiniWindow'

const FakeWindow = h.FakeWindow
const WINDOW_SIZE = 100 + 8 + 30 + 8

function makeCurrent(label = POMODORO_MINI_LABEL): InstanceType<typeof FakeWindow> {
  const win = new FakeWindow(label, {})
  h.state.current = win
  return win
}

const estadoVacio = { isOpen: false, x: null, y: null, width: null, height: null }

beforeEach(() => {
  h.windows.length = 0
  h.state.current = null
  h.state.moved = null
  h.loadState.mockReset().mockResolvedValue(estadoVacio)
  h.saveState.mockReset().mockResolvedValue(undefined)
  h.windowExists.mockReset().mockResolvedValue(false)
  h.focusWindow.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('openPomodoroMiniWindow', () => {
  it('enfoca inmediatamente una mini que ya está visible y retira la escucha temporal', async () => {
    const ventana = makeCurrent()
    const unlisten = vi.fn()
    ventana.once.mockResolvedValue(unlisten)
    ventana.isVisible.mockResolvedValue(true)
    h.windowExists.mockResolvedValue(true)
    await openPomodoroMiniWindow()
    expect(h.focusWindow).toHaveBeenCalledWith(POMODORO_MINI_LABEL)
    expect(unlisten).toHaveBeenCalled()
  })

  it('espera la preparación de una ventana existente antes de mostrarla y enfocarla', async () => {
    const ventana = makeCurrent()
    h.windowExists.mockResolvedValue(true)
    const unlisten = vi.fn()
    let ready!: () => void
    ventana.once.mockImplementation(async (_event: string, handler: () => void) => {
      ready = handler
      return unlisten
    })

    const opening = openPomodoroMiniWindow()
    await vi.waitFor(() => expect(ventana.isVisible).toHaveBeenCalled())
    expect(h.focusWindow).not.toHaveBeenCalled()
    ready()
    await opening
    expect(h.focusWindow).toHaveBeenCalledWith(POMODORO_MINI_LABEL)
    expect(unlisten).toHaveBeenCalled()
  })

  it('marca la mascota abierta y crea una sola ventana con disco y franja', async () => {
    await openPomodoroMiniWindow()
    await vi.waitFor(() => expect(h.windows).toHaveLength(1))

    expect(h.saveState).toHaveBeenCalledWith({
      ...estadoVacio,
      isOpen: true,
      width: 100,
      height: 100,
    })
    expect(h.windows[0].options).toMatchObject({
      width: WINDOW_SIZE,
      height: WINDOW_SIZE,
      minWidth: WINDOW_SIZE,
      minHeight: WINDOW_SIZE,
      maxWidth: WINDOW_SIZE,
      maxHeight: WINDOW_SIZE,
      resizable: true,
      transparent: false,
      visible: false,
      focus: false,
      decorations: false,
      shadow: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      x: 1360 - WINDOW_SIZE - 24,
      y: 768 - WINDOW_SIZE - 24,
    })
  })

  it('no crea una segunda ventana para la pastilla', async () => {
    await openPomodoroMiniWindow()
    await vi.waitFor(() => expect(h.windows).toHaveLength(1))

    expect(h.windows.map((w) => w.label)).toEqual([POMODORO_MINI_LABEL])
  })
})

describe('showReadyPomodoroMiniWindow', () => {
  it('avisa a los pop-outs pendientes solo después de mostrar la mini preparada', async () => {
    const ventana = makeCurrent()
    let finishShow!: () => void
    ventana.show.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishShow = resolve
        })
    )
    const showing = showReadyPomodoroMiniWindow()
    expect(ventana.emit).not.toHaveBeenCalled()
    finishShow()
    await showing
    expect(ventana.emit).toHaveBeenCalledWith('pomodoro-mini-ready')
  })
})

describe('restorePomodoroMiniWindow', () => {
  it('no crea nada si estaba cerrada', async () => {
    h.loadState.mockResolvedValue({ ...estadoVacio, isOpen: false })

    await restorePomodoroMiniWindow()

    expect(h.windows).toHaveLength(0)
  })

  it('reabre la ventana en la posición guardada, ignorando el tamaño viejo', async () => {
    h.loadState.mockResolvedValue({
      ...estadoVacio,
      isOpen: true,
      x: 100,
      y: 120,
      width: 200,
      height: 200,
    })

    await restorePomodoroMiniWindow()
    await vi.waitFor(() => expect(h.windows).toHaveLength(1))

    expect(h.windows[0].options).toMatchObject({
      x: 77,
      y: 120,
      width: WINDOW_SIZE,
      height: WINDOW_SIZE,
    })
    expect(h.windowExists).toHaveBeenCalledWith(POMODORO_MINI_LABEL)
  })

  it('corrige una posición guardada que dejaría la pastilla fuera del monitor', async () => {
    h.loadState.mockResolvedValue({
      ...estadoVacio,
      isOpen: true,
      x: 100,
      y: 760,
    })

    await restorePomodoroMiniWindow()
    await vi.waitFor(() => expect(h.windows).toHaveLength(1))

    expect(h.windows[0].options).toMatchObject({
      x: 77,
      y: 768 - WINDOW_SIZE,
    })
  })

  it('si la ventana ya existe no crea otra ni roba el foco', async () => {
    h.loadState.mockResolvedValue({ ...estadoVacio, isOpen: true })
    h.windowExists.mockResolvedValue(true)

    await restorePomodoroMiniWindow()

    expect(h.focusWindow).not.toHaveBeenCalled()
    expect(h.windows).toHaveLength(0)
  })
})

describe('closePomodoroMiniWindow', () => {
  it('persiste el cierre y cierra la única ventana', async () => {
    const ventana = makeCurrent()

    await closePomodoroMiniWindow()

    expect(h.saveState).toHaveBeenCalledWith({
      isOpen: false,
      x: null,
      y: null,
      width: 100,
      height: 100,
    })
    expect(ventana.close).toHaveBeenCalled()
  })
})

describe('startDraggingPomodoroMiniWindow', () => {
  it('delega el arrastre nativo a la ventana actual', async () => {
    const ventana = makeCurrent()

    startDraggingPomodoroMiniWindow()

    expect(ventana.startDragging).toHaveBeenCalled()
  })
})

describe('isPomodoroMiniWindow', () => {
  it('distingue la mascota de la ventana principal', () => {
    makeCurrent(POMODORO_MINI_LABEL)
    expect(isPomodoroMiniWindow()).toBe(true)

    makeCurrent('main')
    expect(isPomodoroMiniWindow()).toBe(false)
  })
})

describe('trackPomodoroMiniWindow', () => {
  it('guarda el borde visible del disco y no el margen izquierdo de la ventana', async () => {
    vi.useFakeTimers()
    makeCurrent()
    await trackPomodoroMiniWindow()
    h.state.moved?.({ payload: { toLogical: () => ({ x: 200, y: 300 }) } })
    await vi.advanceTimersByTimeAsync(250)
    expect(h.saveState).toHaveBeenLastCalledWith(expect.objectContaining({ x: 223, y: 300 }))
  })

  it('persiste la última posición después del debounce', async () => {
    vi.useFakeTimers()
    makeCurrent()
    await trackPomodoroMiniWindow()

    h.state.moved?.({ payload: { toLogical: () => ({ x: 5, y: 6 }) } })
    vi.advanceTimersByTime(250)
    await vi.runAllTimersAsync()

    expect(h.saveState).toHaveBeenLastCalledWith({
      isOpen: true,
      x: 28,
      y: 6,
      width: 100,
      height: 100,
    })
  })

  it('no vuelve a registrar la misma ventana', async () => {
    makeCurrent()
    await trackPomodoroMiniWindow()
    await trackPomodoroMiniWindow()

    expect(h.state.current?.onMoved).toHaveBeenCalledTimes(1)
  })
})
