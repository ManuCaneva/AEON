import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emit, listen } from '@tauri-apps/api/event'
import {
  onShowPomodoroInMain,
  showPomodoroInMainWindow,
  requestsPomodoroView,
} from './pomodoroMainWindow'

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
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(vi.fn()),
}))

describe('ventana principal pedida desde la ventana mini', () => {
  beforeEach(() => {
    constructions.length = 0
    getByLabel.mockReset()
    vi.mocked(emit).mockClear()
  })

  it('con la ventana principal abierta, la enfoca en la página Pomodoro', async () => {
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabel.mockResolvedValue({ show, setFocus })

    await showPomodoroInMainWindow()

    expect(getByLabel).toHaveBeenCalledWith('main')
    expect(emit).toHaveBeenCalledWith('pomodoro-show-in-main')
    expect(show).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
    expect(constructions).toHaveLength(0)
  })

  it('con la ventana principal cerrada, la vuelve a crear abierta en la página Pomodoro', async () => {
    getByLabel.mockResolvedValue(null)

    await showPomodoroInMainWindow()

    expect(constructions).toEqual([
      {
        label: 'main',
        options: {
          url: 'index.html?view=pomodoro',
          title: 'AEON',
          width: 800,
          height: 600,
          minWidth: 600,
          minHeight: 400,
          maximized: true,
        },
      },
    ])
    expect(emit).not.toHaveBeenCalled()
  })

  it('reconoce el pedido de página Pomodoro en la consulta de arranque de la ventana', () => {
    expect(requestsPomodoroView('?view=pomodoro')).toBe(true)
    expect(requestsPomodoroView('')).toBe(false)
    expect(requestsPomodoroView('?view=dashboard')).toBe(false)
  })

  it('suscribe la ventana principal a los pedidos de página Pomodoro de la mini', async () => {
    const handler = vi.fn()

    await onShowPomodoroInMain(handler)

    expect(listen).toHaveBeenCalledWith('pomodoro-show-in-main', handler)
  })
})
