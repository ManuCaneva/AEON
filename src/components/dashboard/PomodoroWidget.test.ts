import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import PomodoroWidget from './PomodoroWidget.vue'
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

// ui store no longer used by widget — keep mock for safety but not asserted
vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({ setViewMode: vi.fn() }),
}))

describe('PomodoroWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockReset.mockClear()
    mockSkip.mockClear()
    pomodoroState = createPomodoroState()
  })

  it('muestra countdown y anillo, sin texto de fase, y botones reset/skip siempre visibles', () => {
    const wrapper = mount(PomodoroWidget)

    expect(wrapper.get('[data-testid="pomodoro-widget-countdown"]').text()).toBe('25:00')
    expect(wrapper.get('[data-testid="pomodoro-widget-progress"]').attributes('role')).toBe(
      'progressbar'
    )
    expect(wrapper.find('[data-testid="pomodoro-widget-phase"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pomodoro-widget-start"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pomodoro-widget-pause"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pomodoro-widget-reset"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-skip"]').exists()).toBe(true)
  })

  it('los tres controles viven dentro del disco, en una fila bajo el countdown', () => {
    const wrapper = mount(PomodoroWidget)

    const disc = wrapper.get('[data-testid="pomodoro-widget-disc"]')
    expect(disc.find('[data-testid="pomodoro-widget-controls"]').exists()).toBe(true)
    expect(disc.find('[data-testid="pomodoro-widget-reset"]').exists()).toBe(true)
    expect(disc.find('[data-testid="pomodoro-widget-toggle"]').exists()).toBe(true)
    expect(disc.find('[data-testid="pomodoro-widget-skip"]').exists()).toBe(true)

    const controls = disc.get('[data-testid="pomodoro-widget-controls"]')
    const children = controls.element.children
    expect(children[0].getAttribute('data-testid')).toBe('pomodoro-widget-reset')
    expect(children[1].getAttribute('data-testid')).toBe('pomodoro-widget-toggle')
    expect(children[2].getAttribute('data-testid')).toBe('pomodoro-widget-skip')
  })

  it('fuera del círculo no queda ningún botón y el círculo no es cliqueable', () => {
    const wrapper = mount(PomodoroWidget)

    const circleArea = wrapper.get('[data-testid="pomodoro-widget-circle-area"]')
    expect(circleArea.element.children).toHaveLength(1)
    expect(circleArea.element.children[0].getAttribute('data-testid')).toBe(
      'pomodoro-widget-progress'
    )

    const progress = wrapper.get('[data-testid="pomodoro-widget-progress"]')
    expect(progress.element.tagName.toLowerCase()).not.toBe('button')
    expect(progress.attributes('onclick')).toBeUndefined()
  })

  it('reset y skip delegan al store', async () => {
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget-reset"]').trigger('click')
    expect(mockReset).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="pomodoro-widget-skip"]').trigger('click')
    expect(mockSkip).toHaveBeenCalledOnce()
  })

  it('reset y skip tienen aria-label y no preparan audio', async () => {
    const wrapper = mount(PomodoroWidget)

    const reset = wrapper.get('[data-testid="pomodoro-widget-reset"]')
    const skip = wrapper.get('[data-testid="pomodoro-widget-skip"]')
    expect(reset.attributes('aria-label')).toBe('Reiniciar Pomodoro')
    expect(skip.attributes('aria-label')).toBe('Saltar Pomodoro')
    expect(reset.element.tagName.toLowerCase()).toBe('button')
    expect(skip.element.tagName.toLowerCase()).toBe('button')
    await reset.trigger('click')
    await skip.trigger('click')
    expect(mockPrepareAudio).not.toHaveBeenCalled()
  })

  it('el círculo alterna iniciar/pausar según el estado', async () => {
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget-toggle"]').trigger('click')
    expect(mockPrepareAudio).toHaveBeenCalledOnce()
    expect(mockStart).toHaveBeenCalledOnce()

    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    pomodoroState.session.isRunning = true
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="pomodoro-widget-toggle"]').trigger('click')
    expect(mockPause).toHaveBeenCalledOnce()
    expect(mockPrepareAudio).not.toHaveBeenCalled()
  })

  it('ningún click en el widget navega a la vista Pomodoro', async () => {
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-toggle"]').trigger('click')
    // no navigation — no assertion on setViewMode; the absence of navigation is that
    // the widget does not expose role=button/tabindex/cursor-pointer on root
    const container = wrapper.get('[data-testid="pomodoro-widget"]')
    expect(container.attributes('role')).not.toBe('button')
    expect(container.attributes('tabindex')).toBeUndefined()
    expect(container.classes().join(' ')).not.toContain('cursor-pointer')
  })

  it('tiene el header Pomodoro y el contrato de widget compartido (ESTRUCTURA)', () => {
    const wrapper = mount(PomodoroWidget)
    const container = wrapper.get('[data-testid="pomodoro-widget"]')
    expect(wrapper.get('[data-testid="pomodoro-widget-header"]').text()).toContain('Pomodoro')
    expect(container.classes()).toContain('container-widget')
    expect(container.attributes('style')).toContain('container-type')
    expect(wrapper.find('[data-testid="pomodoro-widget-progress"]').exists()).toBe(true)
  })

  it('tiene el título alineado a la izquierda, como el estándar de listing (ALINEACIÓN)', () => {
    const wrapper = mount(PomodoroWidget)
    const header = wrapper.get('[data-testid="pomodoro-widget-header"]')
    const title = header.get('.text-card-title')

    expect(header.classes()).not.toContain('justify-center')
    expect(header.classes()).toContain('justify-start')
    expect(title.classes()).not.toContain('text-center')
    expect(title.classes()).toContain('text-left')
    expect(header.element.firstElementChild?.textContent).toContain('Pomodoro')
  })

  it('el anillo usa token primario en enfoque y success en descansos', async () => {
    const wrapper = mount(PomodoroWidget)
    const progress = wrapper.get('[data-testid="pomodoro-widget-progress"]')
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-primary)')

    ;(pomodoroState.session as { phase: string }).phase = 'shortBreak'
    await wrapper.vm.$nextTick()
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-success)')
    expect((progress.attributes('style') ?? '') as string).not.toContain('rgb(var(--color-primary)')

    ;(pomodoroState.session as { phase: string }).phase = 'longBreak'
    await wrapper.vm.$nextTick()
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-success)')

    ;(pomodoroState.session as { phase: string }).phase = 'focus'
    await wrapper.vm.$nextTick()
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-primary)')
  })

  it('muestra icono play cuando está pausado y pause cuando está corriendo', async () => {
    const wrapper = mount(PomodoroWidget)

    const toggle = wrapper.get('[data-testid="pomodoro-widget-toggle"]')
    expect(toggle.attributes('aria-label')).toBe('Iniciar Pomodoro')
    expect(toggle.find('svg.lucide-play-icon').exists()).toBe(true)

    pomodoroState.session.isRunning = true
    await wrapper.vm.$nextTick()
    const toggleRunning = wrapper.get('[data-testid="pomodoro-widget-toggle"]')
    expect(toggleRunning.attributes('aria-label')).toBe('Pausar Pomodoro')
    expect(toggleRunning.find('svg.lucide-pause-icon').exists()).toBe(true)
  })

  it('el círculo conserva rol progressbar, countdown y es accesible por teclado', () => {
    const wrapper = mount(PomodoroWidget)
    const toggle = wrapper.get('[data-testid="pomodoro-widget-toggle"]')
    const progress = wrapper.get('[data-testid="pomodoro-widget-progress"]')

    expect(toggle.element.tagName.toLowerCase()).toBe('button')
    expect(progress.attributes('role')).toBe('progressbar')
    expect(progress.attributes('aria-valuenow')).toBeDefined()
    expect(wrapper.find('[data-testid="pomodoro-widget-countdown"]').exists()).toBe(true)
  })

  it('arranca el timer aunque la preparación de audio falle', async () => {
    mockPrepareAudio.mockRejectedValueOnce(new Error('WebKitGTK audio unavailable'))
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(mockPrepareAudio).toHaveBeenCalledOnce()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('el countdown sigue al valor del store, sin reloj propio', async () => {
    const session = pomodoroState.session as unknown as {
      isRunning: boolean
      endsAt: string | null
    }
    session.isRunning = true
    session.endsAt = new Date(Date.now() + 25 * 60_000).toISOString()
    pomodoroState.remainingMs = 24 * 60_000 + 58_000

    const wrapper = mount(PomodoroWidget)
    expect(wrapper.get('[data-testid="pomodoro-widget-countdown"]').text()).toBe('24:58')

    pomodoroState.remainingMs = 24 * 60_000 + 57_000
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="pomodoro-widget-countdown"]').text()).toBe('24:57')

    wrapper.unmount()
  })

  it('limita el círculo por ancho y alto del widget y escala su contenido', () => {
    const wrapper = mount(PomodoroWidget)

    const area = wrapper.get('[data-testid="pomodoro-widget-circle-area"]')
    expect(area.attributes('style') ?? '').toContain('container-type: size')

    expect(wrapper.get('[data-testid="pomodoro-widget-progress"]').classes()).toContain(
      'pomodoro-circle'
    )
    expect(wrapper.get('[data-testid="pomodoro-widget-disc"]').classes()).toContain('pomodoro-disc')
    expect(wrapper.get('[data-testid="pomodoro-widget-countdown"]').classes()).toContain(
      'pomodoro-countdown'
    )

    // Las reglas viven en tailwind.css (jsdom no parsea unidades cq* inline)
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    expect(css).toMatch(
      /\.container-widget \.pomodoro-circle\s*\{[^}]*min\(100cqw, 100cqh, 11rem\)/
    )
    expect(css).toMatch(/\.container-widget \.pomodoro-disc\s*\{[^}]*cqmin/)
    expect(css).toMatch(/\.container-widget \.pomodoro-countdown\s*\{[^}]*clamp\([^)]*cqmin/)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
