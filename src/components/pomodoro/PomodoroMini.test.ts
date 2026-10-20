import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import PomodoroMini from './PomodoroMini.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const mockPrepareAudio = vi.fn().mockResolvedValue(undefined)
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn().mockResolvedValue(undefined)
const mockReset = vi.fn().mockResolvedValue(undefined)
const mockSkip = vi.fn().mockResolvedValue(undefined)

function createPomodoroState() {
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
    session: {
      phase: 'focus' as const,
      isRunning: false,
      endsAt: null,
      remainingMs: 25 * 60 * 1000,
      completedFocusSessions: 0,
    },
    remainingMs: 25 * 60 * 1000,
  })
}

let pomodoroState = createPomodoroState()

vi.mock('@/stores/pomodoro', () => ({
  usePomodoroStore: () => ({
    ...pomodoroState,
    get remainingMs() {
      return pomodoroState.remainingMs
    },
    prepareAudio: mockPrepareAudio,
    start: mockStart,
    pause: mockPause,
    reset: mockReset,
    skip: mockSkip,
  }),
}))

describe('PomodoroMini', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockReset.mockClear()
    mockSkip.mockClear()
    pomodoroState = createPomodoroState()
  })

  it('replica el widget: título, disco con anillo, cuenta regresiva y controles, sin configuración', () => {
    const wrapper = mount(PomodoroMini)

    expect(wrapper.get('[data-testid="pomodoro-mini-header"]').text()).toContain('Pomodoro')
    expect(wrapper.get('[data-testid="pomodoro-mini-countdown"]').text()).toBe('25:00')
    expect(wrapper.get('[data-testid="pomodoro-mini-progress"]').attributes('role')).toBe(
      'progressbar'
    )

    const disc = wrapper.get('[data-testid="pomodoro-mini-disc"]')
    const controls = disc.get('[data-testid="pomodoro-mini-controls"]')
    const children = controls.element.children
    expect(children[0].getAttribute('data-testid')).toBe('pomodoro-mini-reset')
    expect(children[1].getAttribute('data-testid')).toBe('pomodoro-mini-toggle')
    expect(children[2].getAttribute('data-testid')).toBe('pomodoro-mini-skip')

    expect(wrapper.find('[data-testid="pomodoro-settings"]').exists()).toBe(false)
  })

  it('escala su contenido igual que el widget', () => {
    const wrapper = mount(PomodoroMini)
    const root = wrapper.get('[data-testid="pomodoro-mini"]')

    expect(root.classes()).toContain('container-widget')
    expect(root.attributes('style')).toContain('container-type')

    const area = wrapper.get('[data-testid="pomodoro-mini-circle-area"]')
    expect(area.attributes('style')).toContain('container-type: size')
    expect(area.element.children).toHaveLength(1)
    expect(area.element.children[0].getAttribute('data-testid')).toBe('pomodoro-mini-progress')
  })

  it('el anillo usa el token primario en enfoque y success en descansos', async () => {
    const wrapper = mount(PomodoroMini)
    const progress = wrapper.get('[data-testid="pomodoro-mini-progress"]')
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-primary)')

    ;(pomodoroState.session as { phase: string }).phase = 'shortBreak'
    await wrapper.vm.$nextTick()
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-success)')
    expect((progress.attributes('style') ?? '') as string).not.toContain('rgb(var(--color-primary)')
  })

  it('la cuenta regresiva sigue al store compartido, sin reloj propio', async () => {
    const wrapper = mount(PomodoroMini)
    expect(wrapper.get('[data-testid="pomodoro-mini-countdown"]').text()).toBe('25:00')

    pomodoroState.remainingMs = 24 * 60_000 + 58_000
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="pomodoro-mini-countdown"]').text()).toBe('24:58')
  })

  it('los controles delegan en el store compartido', async () => {
    const wrapper = mount(PomodoroMini)

    await wrapper.get('[data-testid="pomodoro-mini-reset"]').trigger('click')
    expect(mockReset).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="pomodoro-mini-skip"]').trigger('click')
    expect(mockSkip).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="pomodoro-mini-toggle"]').trigger('click')
    expect(mockPrepareAudio).toHaveBeenCalledOnce()
    expect(mockStart).toHaveBeenCalledOnce()

    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    pomodoroState.session.isRunning = true
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="pomodoro-mini-toggle"]').trigger('click')
    expect(mockPause).toHaveBeenCalledOnce()
    expect(mockPrepareAudio).not.toHaveBeenCalled()
  })

  it('arranca el timer aunque la preparación de audio falle', async () => {
    mockPrepareAudio.mockRejectedValueOnce(new Error('WebKitGTK audio unavailable'))
    const wrapper = mount(PomodoroMini)

    await wrapper.get('[data-testid="pomodoro-mini-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('el header queda accionable para la acción que defina la ventana', async () => {
    const wrapper = mount(PomodoroMini)
    const header = wrapper.get('[data-testid="pomodoro-mini-header"]')

    expect(header.attributes('role')).toBe('button')
    expect(header.attributes('tabindex')).toBe('0')

    await header.trigger('click')
    expect(wrapper.emitted('header-activate')).toHaveLength(1)

    await header.trigger('keydown', { key: 'Enter' })
    await header.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('header-activate')).toHaveLength(3)

    await header.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('header-activate')).toHaveLength(3)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroMini)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
