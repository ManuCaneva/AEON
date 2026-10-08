import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PomodoroView from '@/views/PomodoroView.vue'
import PomodoroWidget from '@/components/dashboard/PomodoroWidget.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/pomodoroSounds', () => ({
  createPomodoroSoundPlayer: () => ({
    prepareFromUserGesture: vi.fn().mockResolvedValue(undefined),
    playFocusEndChime: vi.fn(() => true),
    playBreakEndChime: vi.fn(() => true),
  }),
}))

const start = '2026-09-01T12:00:00.000Z'

describe('pomodoro: una sola fuente de verdad para el tiempo', () => {
  let store: ReturnType<typeof usePomodoroStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    store = usePomodoroStore()
    await store.load()
    store.startTicker()
    await store.start()
  })

  afterEach(() => {
    store.stopTicker()
    vi.useRealTimers()
  })

  it('la sección dedicada y el widget muestran exactamente el mismo tiempo en todo momento', async () => {
    const view = mount(PomodoroView)
    const widget = mount(PomodoroWidget)

    const tiempos = () => [
      view.get('[data-testid="pomodoro-countdown"]').text(),
      widget.get('[data-testid="pomodoro-widget-countdown"]').text(),
    ]

    expect(tiempos()).toEqual(['25:00', '25:00'])

    await vi.advanceTimersByTimeAsync(3_000)
    await view.vm.$nextTick()
    await widget.vm.$nextTick()
    expect(tiempos()).toEqual(['24:57', '24:57'])

    await store.pause()
    await view.vm.$nextTick()
    await widget.vm.$nextTick()
    const congelados = tiempos()
    expect(congelados).toEqual(['24:57', '24:57'])

    await vi.advanceTimersByTimeAsync(5_000)
    await view.vm.$nextTick()
    await widget.vm.$nextTick()
    expect(tiempos()).toEqual(congelados)

    await store.resume()
    await vi.advanceTimersByTimeAsync(2_000)
    await view.vm.$nextTick()
    await widget.vm.$nextTick()
    expect(tiempos()).toEqual(['24:55', '24:55'])

    view.unmount()
    widget.unmount()
  })

  it('el tiempo sigue avanzando aunque la sección dedicada no esté montada', async () => {
    await vi.advanceTimersByTimeAsync(4_000)
    expect(store.remainingMs).toBe(25 * 60_000 - 4_000)

    const widget = mount(PomodoroWidget)
    expect(widget.get('[data-testid="pomodoro-widget-countdown"]').text()).toBe('24:56')
    widget.unmount()
  })
})
