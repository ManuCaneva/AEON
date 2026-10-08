import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import PomodoroView from './PomodoroView.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

function createStore(overrides: Record<string, unknown> = {}) {
  return reactive({
    settings: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      autoStartBreak: true,
      autoStartFocus: false,
      volume: 0.7,
      muted: false,
    },
    session: { phase: 'focus', isRunning: false, completedFocusSessions: 2 },
    loaded: true,
    remainingMs: 25 * 60_000,
    start: vi.fn(),
    pause: vi.fn(),
    skip: vi.fn(),
    reset: vi.fn(),
    prepareAudio: vi.fn(),
    saveSettings: vi.fn(),
    ...overrides,
  })
}

let store = createStore()

vi.mock('@/stores/pomodoro', () => ({
  usePomodoroStore: () => store,
}))

describe('PomodoroView', () => {
  it('renders the countdown, phase, cycle dots, and idle controls', () => {
    store = createStore()
    const wrapper = mount(PomodoroView)

    expect(wrapper.get('[data-testid="pomodoro-countdown"]').text()).toBe('25:00')
    expect(wrapper.get('[data-testid="pomodoro-phase"]').text()).toContain('Enfoque')
    expect(wrapper.findAll('[data-testid="cycle-dot"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="pomodoro-start"]').element).toBeTruthy()
    expect(wrapper.get('[data-testid="pomodoro-skip"]').element).toBeTruthy()
    expect(wrapper.get('[data-testid="pomodoro-reset"]').element).toBeTruthy()
    expect(wrapper.findAll('[data-testid="pomodoro-pause"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="pomodoro-progress"]').attributes('aria-valuenow')).toBe('0')
    wrapper.unmount()
  })

  it('renders timer and settings side by side without a heading', () => {
    store = createStore()
    const wrapper = mount(PomodoroView)

    expect(wrapper.find('[data-testid="pomodoro-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-settings"]').exists()).toBe(true)
    // no large Heading "Pomodoro" at the top
    expect(wrapper.find('h1').exists()).toBe(false)
    wrapper.unmount()
  })

  it('exposes pause instead of start while running and delegates controls', async () => {
    store = createStore({
      session: { phase: 'focus', isRunning: true, completedFocusSessions: 2 },
      remainingMs: 10 * 60_000,
    })
    const wrapper = mount(PomodoroView)

    expect(wrapper.get('[data-testid="pomodoro-pause"]').element).toBeTruthy()
    expect(wrapper.findAll('[data-testid="pomodoro-start"]')).toHaveLength(0)
    await wrapper.get('[data-testid="pomodoro-pause"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-skip"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-reset"]').trigger('click')
    expect(store.pause).toHaveBeenCalled()
    expect(store.skip).toHaveBeenCalled()
    expect(store.reset).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('el texto del tiempo sigue al valor del store', async () => {
    store = createStore({
      session: { phase: 'focus', isRunning: true, completedFocusSessions: 0 },
      remainingMs: 10 * 60_000,
    })
    const wrapper = mount(PomodoroView)

    expect(wrapper.get('[data-testid="pomodoro-countdown"]').text()).toBe('10:00')

    ;(store as { remainingMs: number }).remainingMs = 9 * 60_000 + 58_000
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="pomodoro-countdown"]').text()).toBe('09:58')

    ;(store as { remainingMs: number }).remainingMs = 9 * 60_000 + 57_000
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="pomodoro-countdown"]').text()).toBe('09:57')
    expect(wrapper.get('[data-testid="pomodoro-progress"]').attributes('aria-valuenow')).toBe('60')
    wrapper.unmount()
  })

  it('arranca el timer aunque prepareAudio rechace (best-effort)', async () => {
    const start = vi.fn().mockResolvedValue(undefined)
    const prepareAudio = vi.fn().mockRejectedValue(new Error('WebKitGTK audio unavailable'))
    store = createStore({ start, prepareAudio })
    const wrapper = mount(PomodoroView)

    await wrapper.get('[data-testid="pomodoro-start"]').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(prepareAudio).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('el anillo principal usa rgb(var(--color-*)) válido para ambos tramos', () => {
    store = createStore()
    const wrapper = mount(PomodoroView)
    const ring = wrapper.get('[data-testid="pomodoro-progress"]')
    const style = (ring.attributes('style') ?? '') as string
    expect(style).toContain('rgb(var(--color-primary)')
    expect(style).toContain('rgb(var(--color-surface-3)')
    wrapper.unmount()
  })

  it('usa eyebrow para la fase y no colores de paleta crudos', () => {
    store = createStore()
    const wrapper = mount(PomodoroView)
    const phase = wrapper.get('[data-testid="pomodoro-phase"]')
    expect(phase.classes()).toContain('text-eyebrow')
    expect(phase.classes()).toContain('uppercase')
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
    wrapper.unmount()
  })

  it('los dots de ciclo usan el acento primario', () => {
    store = createStore()
    const wrapper = mount(PomodoroView)
    const dots = wrapper.findAll('[data-testid="cycle-dot"]')
    expect(dots[0].classes()).toContain('bg-primary')
    expect(dots[3].classes()).toContain('bg-surface-3')
    wrapper.unmount()
  })
})
