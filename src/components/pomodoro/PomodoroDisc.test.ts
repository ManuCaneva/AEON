import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PomodoroDisc from './PomodoroDisc.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { createPomodoroState } from '@/test/pomodoroState'

const mockPrepareAudio = vi.fn().mockResolvedValue(undefined)
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn().mockResolvedValue(undefined)
const mockReset = vi.fn().mockResolvedValue(undefined)
const mockSkip = vi.fn().mockResolvedValue(undefined)

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

describe('PomodoroDisc', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockReset.mockClear()
    mockSkip.mockClear()
    pomodoroState = createPomodoroState()
  })

  it('compone sus ids con el prefijo de la superficie que lo hospeda', () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'superficie' } })

    for (const sufijo of ['progress', 'disc', 'countdown', 'controls', 'reset', 'toggle', 'skip']) {
      expect(wrapper.find(`[data-testid="superficie-${sufijo}"]`).exists()).toBe(true)
    }
  })

  it('los tres controles viven en el disco, en una fila con el orden [reset, toggle, skip]', () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    const disc = wrapper.get('[data-testid="x-disc"]')
    const controls = disc.get('[data-testid="x-controls"]')
    const children = controls.element.children
    expect(children).toHaveLength(3)
    expect(children[0].getAttribute('data-testid')).toBe('x-reset')
    expect(children[1].getAttribute('data-testid')).toBe('x-toggle')
    expect(children[2].getAttribute('data-testid')).toBe('x-skip')
  })

  it('reset y skip delegan al store y no preparan el audio', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    await wrapper.get('[data-testid="x-reset"]').trigger('click')
    expect(mockReset).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="x-skip"]').trigger('click')
    expect(mockSkip).toHaveBeenCalledOnce()

    expect(mockPrepareAudio).not.toHaveBeenCalled()
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockPause).not.toHaveBeenCalled()
  })

  it('reset, toggle y skip anuncian su acción', () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    expect(wrapper.get('[data-testid="x-reset"]').attributes('aria-label')).toBe(
      'Reiniciar Pomodoro'
    )
    expect(wrapper.get('[data-testid="x-toggle"]').attributes('aria-label')).toBe(
      'Iniciar Pomodoro'
    )
    expect(wrapper.get('[data-testid="x-skip"]').attributes('aria-label')).toBe('Saltar Pomodoro')
  })

  it('el toggle inicia con el audio preparado y pausa sin prepararlo', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    await wrapper.get('[data-testid="x-toggle"]').trigger('click')
    expect(mockPrepareAudio).toHaveBeenCalledOnce()
    expect(mockStart).toHaveBeenCalledOnce()

    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    pomodoroState.session.isRunning = true
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="x-toggle"]').trigger('click')
    expect(mockPause).toHaveBeenCalledOnce()
    expect(mockPrepareAudio).not.toHaveBeenCalled()
  })

  it('arranca el timer aunque la preparación de audio falle', async () => {
    mockPrepareAudio.mockRejectedValueOnce(new Error('WebKitGTK audio unavailable'))
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    await wrapper.get('[data-testid="x-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('muestra play cuando está parado y pause cuando está corriendo', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })

    expect(wrapper.get('[data-testid="x-toggle"]').find('svg.lucide-play-icon').exists()).toBe(true)

    pomodoroState.session.isRunning = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="x-toggle"]').find('svg.lucide-pause-icon').exists()).toBe(
      true
    )
  })

  it('el anillo es progressbar con el avance de la fase según el tiempo restante', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })
    const progress = wrapper.get('[data-testid="x-progress"]')

    expect(progress.attributes('role')).toBe('progressbar')
    expect(progress.attributes('aria-valuemin')).toBe('0')
    expect(progress.attributes('aria-valuemax')).toBe('100')
    expect(progress.attributes('aria-valuenow')).toBe('0')

    // Media fase de enfoque transcurrida: 25 minutos de duración, 12:30 restantes.
    pomodoroState.remainingMs = 12 * 60_000 + 30_000
    await wrapper.vm.$nextTick()
    expect(progress.attributes('aria-valuenow')).toBe('50')
  })

  it('el anillo usa el token primario en enfoque y success en descansos', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })
    const progress = wrapper.get('[data-testid="x-progress"]')

    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-primary)')

    ;(pomodoroState.session as { phase: string }).phase = 'shortBreak'
    await wrapper.vm.$nextTick()
    expect((progress.attributes('style') ?? '') as string).toContain('rgb(var(--color-success)')
    expect((progress.attributes('style') ?? '') as string).not.toContain('rgb(var(--color-primary)')
  })

  it('la cuenta regresiva sigue al store compartido, sin reloj propio', async () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })
    expect(wrapper.get('[data-testid="x-countdown"]').text()).toBe('25:00')

    pomodoroState.remainingMs = 24 * 60_000 + 58_000
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="x-countdown"]').text()).toBe('24:58')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroDisc, { props: { testIdPrefix: 'x' } })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
