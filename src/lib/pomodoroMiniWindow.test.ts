import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow, type WebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  isPomodoroMiniWindow,
  openPomodoroMiniWindow,
  POMODORO_MINI_LABEL,
} from './pomodoroMiniWindow'

const { constructions, getByLabel } = vi.hoisted(() => ({
  constructions: [] as Array<{ label: string; options: Record<string, unknown> }>,
  getByLabel: vi.fn(),
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {
    static getByLabel = getByLabel
    label: string
    constructor(label: string, options: Record<string, unknown>) {
      this.label = label
      constructions.push({ label, options })
    }
  },
  getCurrentWebviewWindow: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  currentMonitor: vi.fn(),
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
    getByLabel.mockReset()
    vi.mocked(currentMonitor).mockReset()
    vi.mocked(getCurrentWebviewWindow).mockReset()
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
