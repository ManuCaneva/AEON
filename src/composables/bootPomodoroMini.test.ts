import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const h = vi.hoisted(() => ({
  track: vi.fn(),
  applyShape: vi.fn(async () => {}),
  show: vi.fn(async () => {}),
  useTheme: vi.fn(),
  uiStore: vi.fn(),
  pomodoroStore: {
    load: vi.fn(async () => {}),
    startTicker: vi.fn(),
  },
  pomodoroStoreFactory: vi.fn(),
}))

vi.mock('@/components/pomodoro/PomodoroMini.vue', () => ({
  default: { template: '<div data-testid="mini-stub">mini</div>' },
}))
vi.mock('@/composables/useTheme', () => ({ useTheme: h.useTheme }))
vi.mock('@/stores/ui', () => ({ useUiStore: h.uiStore }))
vi.mock('@/stores/pomodoro', () => ({
  usePomodoroStore: h.pomodoroStoreFactory,
}))
vi.mock('@/lib/pomodoroMiniWindow', () => ({
  trackPomodoroMiniWindow: h.track,
  applyPomodoroMiniWindowShape: h.applyShape,
  showReadyPomodoroMiniWindow: h.show,
}))

import { ORB_WINDOW_CLASS, bootPomodoroMini } from './bootPomodoroMini'

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  document.documentElement.className = ''
  h.track.mockReset()
  h.applyShape.mockReset().mockResolvedValue(undefined)
  h.show.mockReset().mockResolvedValue(undefined)
  h.useTheme.mockReset()
  h.uiStore.mockReset()
  h.pomodoroStore.load.mockReset().mockResolvedValue(undefined)
  h.pomodoroStore.startTicker.mockReset()
  h.pomodoroStoreFactory.mockReset().mockReturnValue(h.pomodoroStore)
})

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.className = ''
})

describe('bootPomodoroMini', () => {
  it('no expone el rectángulo si falla el recorte nativo', async () => {
    h.applyShape.mockRejectedValue(new Error('shape unavailable'))
    await expect(bootPomodoroMini()).rejects.toThrow('shape unavailable')
    expect(h.show).not.toHaveBeenCalled()
  })

  it('no muestra la ventana hasta cargar el reloj y aplicar el recorte', async () => {
    let finishShape!: () => void
    h.applyShape.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishShape = resolve
        })
    )

    const boot = bootPomodoroMini()
    await flushPromises()

    expect(h.show).not.toHaveBeenCalled()
    finishShape()
    await boot

    expect(h.pomodoroStore.load).toHaveBeenCalled()
    expect(h.show).toHaveBeenCalledTimes(1)
    expect(h.pomodoroStore.load.mock.invocationCallOrder[0]).toBeLessThan(
      h.show.mock.invocationCallOrder[0]
    )
    expect(h.applyShape.mock.invocationCallOrder[0]).toBeLessThan(
      h.show.mock.invocationCallOrder[0]
    )
  })

  it('marca la ventana como orb, monta el disco y carga el reloj', async () => {
    await bootPomodoroMini()
    await flushPromises()

    expect(document.documentElement.classList.contains(ORB_WINDOW_CLASS)).toBe(true)
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.applyShape).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-testid="mini-stub"]')).not.toBeNull()
    expect(h.pomodoroStore.load).toHaveBeenCalledTimes(1)
    expect(h.pomodoroStore.startTicker).toHaveBeenCalledTimes(1)
  })

  it('aplica tema y escala de texto de la ventana', async () => {
    await bootPomodoroMini()

    expect(h.useTheme).toHaveBeenCalledTimes(1)
    expect(h.uiStore).toHaveBeenCalledTimes(1)
  })
})
