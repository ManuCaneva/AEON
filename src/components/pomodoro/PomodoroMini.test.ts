import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PomodoroMini from './PomodoroMini.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { createPomodoroState } from '@/test/pomodoroState'
import {
  POMODORO_ORB_MIN_DIAMETER,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
} from '@/lib/pomodoroMiniLayout'

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

const windowFakes = vi.hoisted(() => ({
  getPomodoroMiniOrbRect: vi.fn(),
  setPomodoroMiniGeometry: vi.fn().mockResolvedValue(undefined),
  setPomodoroMiniOrbOffset: vi.fn(),
  startDraggingPomodoroMiniWindow: vi.fn(),
  currentLogicalMonitorRect: vi.fn(),
}))

vi.mock('@/lib/pomodoroMiniWindow', () => windowFakes)

/** Disco con el que responde la ventana en los tests. */
const DISCO = { x: 100, y: 200, diameter: 200 }

/** Monitor holgado donde la pastilla entra bajo el disco. */
const MONITOR = { x: 0, y: 0, width: 1920, height: 1080 }

const PILL_SPACE = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT

/** Vacía los microtasks del flujo async de hover (compatible con fake timers). */
async function settle(wrapper: VueWrapper): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
  await wrapper.vm.$nextTick()
}

/** Lleva la mascota al estado hover con la pastilla visible. */
async function mostrarPill(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="pomodoro-mini-circle-area"]').trigger('mouseenter')
  await settle(wrapper)
  expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(true)
}

describe('PomodoroMini', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockReset.mockClear()
    mockSkip.mockClear()
    pomodoroState = createPomodoroState()
    windowFakes.getPomodoroMiniOrbRect.mockReset().mockResolvedValue({ ...DISCO })
    windowFakes.setPomodoroMiniGeometry.mockClear().mockResolvedValue(undefined)
    windowFakes.setPomodoroMiniOrbOffset.mockClear()
    windowFakes.startDraggingPomodoroMiniWindow.mockClear()
    windowFakes.currentLogicalMonitorRect.mockReset().mockResolvedValue({ ...MONITOR })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('es solo el disco: anillo, cuenta regresiva y controles, sin header ni configuración', () => {
    const wrapper = mount(PomodoroMini)

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

    expect(wrapper.find('[data-testid="pomodoro-mini-header"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pomodoro-settings"]').exists()).toBe(false)
  })

  it('la pastilla está oculta hasta que el cursor entra al disco y se expande hacia abajo', async () => {
    const wrapper = mount(PomodoroMini)
    expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(false)

    await mostrarPill(wrapper)

    expect(windowFakes.setPomodoroMiniOrbOffset).toHaveBeenCalledWith(0)
    expect(windowFakes.setPomodoroMiniGeometry).toHaveBeenCalledWith({
      x: DISCO.x,
      y: DISCO.y,
      width: DISCO.diameter,
      height: DISCO.diameter + PILL_SPACE,
    })
  })

  it('cerca del borde inferior del monitor la pastilla flipa arriba sin mover el disco', async () => {
    windowFakes.getPomodoroMiniOrbRect.mockResolvedValue({ x: 100, y: 1000, diameter: 200 })
    const wrapper = mount(PomodoroMini)

    await mostrarPill(wrapper)

    expect(windowFakes.setPomodoroMiniOrbOffset).toHaveBeenCalledWith(PILL_SPACE)
    expect(windowFakes.setPomodoroMiniGeometry).toHaveBeenCalledWith({
      x: 100,
      y: 1000 - PILL_SPACE,
      width: 200,
      height: 200 + PILL_SPACE,
    })
  })

  it('al salir el cursor la pastilla se oculta tras la gracia, restaurando la geometría', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)
    windowFakes.setPomodoroMiniGeometry.mockClear()

    await wrapper.get('[data-testid="pomodoro-mini-circle-area"]').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(299)
    await settle(wrapper)
    expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await settle(wrapper)

    expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(false)
    expect(windowFakes.setPomodoroMiniOrbOffset).toHaveBeenLastCalledWith(0)
    expect(windowFakes.setPomodoroMiniGeometry).toHaveBeenLastCalledWith({
      x: DISCO.x,
      y: DISCO.y,
      width: DISCO.diameter,
      height: DISCO.diameter,
    })
  })

  it('entrar a la pastilla antes de la gracia la mantiene visible', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)

    await wrapper.get('[data-testid="pomodoro-mini-circle-area"]').trigger('mouseleave')
    await wrapper.get('[data-testid="pomodoro-mini-pill-area"]').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(1_000)
    await settle(wrapper)

    expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(true)
  })

  it('los botones de la pastilla emiten ir a Pomodoro y cerrar', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)

    await wrapper.get('[data-testid="pomodoro-pill-go"]').trigger('click')
    expect(wrapper.emitted('go')).toHaveLength(1)

    await wrapper.get('[data-testid="pomodoro-pill-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('mantener apretado el disco y mover arrastra la ventana, salvo sobre los botones', async () => {
    const wrapper = mount(PomodoroMini)

    await wrapper
      .get('[data-testid="pomodoro-mini-circle-area"]')
      .trigger('mousedown', { button: 0 })
    expect(windowFakes.startDraggingPomodoroMiniWindow).toHaveBeenCalledOnce()

    windowFakes.startDraggingPomodoroMiniWindow.mockClear()
    await wrapper.get('[data-testid="pomodoro-mini-toggle"]').trigger('mousedown', { button: 0 })
    await wrapper.get('[data-testid="pomodoro-mini-countdown"]').trigger('mousedown', { button: 2 })

    expect(windowFakes.startDraggingPomodoroMiniWindow).not.toHaveBeenCalled()
  })

  it('el handle de resize escala el disco desde el centro mientras se mantiene apretado', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)
    windowFakes.setPomodoroMiniGeometry.mockClear()

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 300,
      clientY: 400,
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 330, clientY: 390 }))
    await settle(wrapper)

    // Delta {+30, -10} → +40 de diámetro, con el centro del disco fijo.
    expect(windowFakes.setPomodoroMiniGeometry).toHaveBeenLastCalledWith({
      x: 100 - 20,
      y: 200 - 20,
      width: 240,
      height: 240 + PILL_SPACE,
    })

    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 330, clientY: 390 }))
    await settle(wrapper)
    await wrapper.get('[data-testid="pomodoro-mini-circle-area"]').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(1_000)
    await settle(wrapper)

    // El resize no deja la pastilla clavada: sin gesto, la gracia corre igual.
    expect(wrapper.find('[data-testid="pomodoro-mini-pill-area"]').exists()).toBe(false)
  })

  it('el resize recorta al mínimo cuando el gesto achica de más', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)
    windowFakes.setPomodoroMiniGeometry.mockClear()

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 300,
      clientY: 400,
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 700 }))
    await settle(wrapper)

    const llamadas = windowFakes.setPomodoroMiniGeometry.mock.calls
    const ultimo = llamadas[llamadas.length - 1]?.[0]

    expect(ultimo).toMatchObject({ width: POMODORO_ORB_MIN_DIAMETER })
    // El centro del disco sigue fijo.
    expect(ultimo.x + ultimo.width / 2).toBe(200)
    expect(ultimo.y + (ultimo.height - PILL_SPACE) / 2).toBe(300)
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
    await settle(wrapper)
    expect(mockStart).toHaveBeenCalledOnce()
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

  it('el disco escala con el contenedor igual que en el widget', () => {
    const wrapper = mount(PomodoroMini)
    const root = wrapper.get('[data-testid="pomodoro-mini"]')

    expect(root.classes()).toContain('container-widget')
    expect(root.attributes('style')).toContain('container-type')

    const area = wrapper.get('[data-testid="pomodoro-mini-circle-area"]')
    expect(area.attributes('style')).toContain('container-type: size')
    expect(area.element.children).toHaveLength(1)
    expect(area.element.children[0].getAttribute('data-testid')).toBe('pomodoro-mini-progress')
  })

  it('la pastilla usa el alto fijo de la geometría compartida', async () => {
    const wrapper = mount(PomodoroMini)
    await mostrarPill(wrapper)

    const pill = wrapper.get('[data-testid="pomodoro-pill"]')
    expect(pill.attributes('style')).toContain(`height: ${POMODORO_PILL_HEIGHT}px`)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroMini)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
