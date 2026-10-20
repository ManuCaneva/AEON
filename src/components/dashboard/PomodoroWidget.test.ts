import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import PomodoroWidget from './PomodoroWidget.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { computedTextColors, themeRgb } from '@/test/computedColors'
import { DEFAULT_THEME } from '@/lib/themes'

const mockPrepareAudio = vi.fn().mockResolvedValue(undefined)
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn().mockResolvedValue(undefined)
const mockReset = vi.fn().mockResolvedValue(undefined)
const mockSkip = vi.fn().mockResolvedValue(undefined)
const mockSetViewMode = vi.fn()
const mockOpenMini = vi.fn().mockResolvedValue(undefined)

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

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({ setViewMode: mockSetViewMode }),
}))

vi.mock('@/lib/pomodoroMiniWindow', () => ({
  openPomodoroMiniWindow: (...args: unknown[]) => mockOpenMini(...args),
}))

describe('PomodoroWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockReset.mockClear()
    mockSkip.mockClear()
    mockSetViewMode.mockClear()
    mockOpenMini.mockClear()
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

  it('el área del círculo solo contiene el anillo y no es cliqueable', () => {
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

  it('el click en cualquier punto del header navega a la página Pomodoro', async () => {
    const wrapper = mount(PomodoroWidget)

    const header = wrapper.get('[data-testid="pomodoro-widget-header"]')
    await header.trigger('click')
    expect(mockSetViewMode).toHaveBeenCalledWith('pomodoro')

    await header.get('.text-card-title').trigger('click')
    expect(mockSetViewMode).toHaveBeenCalledTimes(2)
    expect(mockSetViewMode).toHaveBeenLastCalledWith('pomodoro')
  })

  it('el disco, el círculo y los controles no navegan y siguen funcionando', async () => {
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-circle-area"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-progress"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-disc"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-countdown"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-reset"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-toggle"]').trigger('click')
    await wrapper.get('[data-testid="pomodoro-widget-skip"]').trigger('click')

    expect(mockSetViewMode).not.toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalledOnce()
    expect(mockStart).toHaveBeenCalledOnce()
    expect(mockSkip).toHaveBeenCalledOnce()

    const container = wrapper.get('[data-testid="pomodoro-widget"]')
    expect(container.attributes('role')).not.toBe('button')
    expect(container.attributes('tabindex')).toBeUndefined()
    expect(container.classes()).not.toContain('cursor-pointer')
  })

  it('el botón pop-out del header abre la ventana mini sin navegar', async () => {
    const wrapper = mount(PomodoroWidget)

    const popout = wrapper.get('[data-testid="pomodoro-widget-popout"]')
    expect(popout.attributes('aria-label')).toBe('Abrir ventana mini')
    expect(popout.find('svg.lucide-picture-in-picture2-icon').exists()).toBe(true)

    await popout.trigger('click')
    expect(mockOpenMini).toHaveBeenCalledOnce()
    expect(mockSetViewMode).not.toHaveBeenCalled()
  })

  it('el click en el header navega aunque el botón pop-out esté presente', async () => {
    const wrapper = mount(PomodoroWidget)

    await wrapper.get('[data-testid="pomodoro-widget-header"]').trigger('click')
    expect(mockSetViewMode).toHaveBeenCalledWith('pomodoro')
    expect(mockOpenMini).not.toHaveBeenCalled()
  })

  it('el título del header es accesible por teclado con Enter y Espacio', async () => {
    const wrapper = mount(PomodoroWidget)
    const title = wrapper.get('[data-testid="pomodoro-widget-header-title"]')

    await title.trigger('keydown', { key: 'Enter' })
    expect(mockSetViewMode).toHaveBeenCalledTimes(1)
    expect(mockSetViewMode).toHaveBeenLastCalledWith('pomodoro')

    await title.trigger('keydown', { key: ' ' })
    expect(mockSetViewMode).toHaveBeenCalledTimes(2)

    await title.trigger('keydown', { key: 'Escape' })
    expect(mockSetViewMode).toHaveBeenCalledTimes(2)
  })

  it('el título anuncia el destino y el header no anida controles', () => {
    const wrapper = mount(PomodoroWidget)
    const header = wrapper.get('[data-testid="pomodoro-widget-header"]')
    const title = wrapper.get('[data-testid="pomodoro-widget-header-title"]')

    expect(title.attributes('aria-label')).toBe('Ir a la página Pomodoro')
    expect(header.attributes('role')).toBeUndefined()
    expect(header.attributes('tabindex')).toBeUndefined()
    expect(
      title.element.contains(header.get('[data-testid="pomodoro-widget-popout"]').element)
    ).toBe(false)
  })

  it('el header muestra cursor pointer y el título se ilumina en hover', async () => {
    const wrapper = mount(PomodoroWidget, { attachTo: document.body })
    const header = wrapper.get('[data-testid="pomodoro-widget-header"]')
    const title = header.get('.text-card-title').element

    expect(header.classes()).toContain('cursor-pointer')
    expect(header.classes()).toContain('group')

    const { rest, hover } = await computedTextColors(title)
    expect(rest).toBe(themeRgb(DEFAULT_THEME, 'ink'))
    expect(hover).toBe(themeRgb(DEFAULT_THEME, 'primary'))
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
    // El círculo crece con el widget sin tope fijo: se limita por ambas
    // dimensiones del área disponible.
    expect(css).toMatch(/\.container-widget \.pomodoro-circle\s*\{[^}]*min\(100cqw, 100cqh\)/)
    expect(css).not.toMatch(/\.container-widget \.pomodoro-circle\s*\{[^}]*11rem/)
    expect(css).toMatch(/\.container-widget \.pomodoro-disc\s*\{[^}]*cqmin/)
    // La cuenta regresiva escala con el widget (piso según Configuración).
    expect(css).toMatch(/\.container-widget \.pomodoro-countdown\s*\{[^}]*cqmin/)
    expect(css).toMatch(/\.container-widget \.pomodoro-countdown\s*\{[^}]*var\(--text-scale\)/)
    // Los controles escalan con el widget.
    expect(css).toMatch(/\.container-widget \.pomodoro-btn\s*\{[^}]*cqmin/)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
