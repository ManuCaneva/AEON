import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import GridItemVue from './GridItemVue.vue'
import PomodoroWidget from './PomodoroWidget.vue'

type DashDragCallbacks = {
  onDragStart: () => void
  onDragMove: (dx: number, dy: number) => void
  onDragEnd: () => void
  onResizeStart: () => void
  onResizeMove: (dw: number, dh: number) => void
  onResizeEnd: () => void
}

let dashCallbacks: Partial<DashDragCallbacks> = {}

vi.mock('@/composables/useDashDrag', () => ({
  useDashDrag: (_elRef: unknown, _editMode: unknown, callbacks: DashDragCallbacks) => {
    dashCallbacks = callbacks
    return vi.fn()
  },
}))

const mockPrepareAudio = vi.fn().mockResolvedValue(undefined)
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn().mockResolvedValue(undefined)
const mockSetViewMode = vi.fn()

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
      soundId: 'bell',
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
    prepareAudio: mockPrepareAudio,
    start: mockStart,
    pause: mockPause,
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({ setViewMode: mockSetViewMode }),
}))

describe('PomodoroWidget resize preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    dashCallbacks = {}
    mockPrepareAudio.mockClear()
    mockStart.mockClear()
    mockPause.mockClear()
    mockSetViewMode.mockClear()
    pomodoroState = createPomodoroState()
  })

  it('mantiene header, countdown y anillo visibles durante el gesto de resize (absolute preview)', async () => {
    const wrapper = mount(GridItemVue, {
      props: {
        item: { i: 'pomodoro', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 3 },
        editMode: true,
      },
      slots: { default: PomodoroWidget },
      attachTo: document.body,
    })

    const gridEl = wrapper.element as HTMLElement
    const container = gridEl.parentElement as HTMLElement
    // Dashboard grid dimensions for 12×10 cells
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(gridEl, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(gridEl, 'clientHeight', { value: 240, configurable: true })

    // No preview before gesture
    expect(wrapper.find('[data-testid="pomodoro-widget"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-progress"]').exists()).toBe(true)
    expect(gridEl.style.position).toBe('')

    // Simulate interactjs resize start + move (deltaRect contract)
    dashCallbacks.onResizeStart?.()
    // Preview anclado: no debe desplazarse (sin position/left/top), solo width/height
    expect(gridEl.style.position).toBe('')
    expect(gridEl.style.left).toBe('')
    expect(gridEl.style.top).toBe('')
    expect(gridEl.style.width).toContain('px')
    expect(gridEl.style.height).toContain('px')
    // Content must remain mounted immediately after start
    expect(wrapper.find('[data-testid="pomodoro-widget"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-header"]').exists()).toBe(true)

    dashCallbacks.onResizeMove?.(80, 40)
    expect(gridEl.style.position).toBe('')
    expect(gridEl.style.left).toBe('')
    expect(gridEl.style.top).toBe('')
    expect(gridEl.style.width).toContain('px')
    expect(gridEl.style.height).toContain('px')
    // Key regression: content does NOT disappear during preview
    expect(wrapper.find('[data-testid="pomodoro-widget"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-progress"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pomodoro-widget-countdown"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pomodoro')

    dashCallbacks.onResizeEnd?.()
    // After gesture, grid-item returns to grid placement (width/height cleared, sin desplazamiento)
    expect(gridEl.style.position).toBe('')
    expect(gridEl.style.left).toBe('')
    expect(gridEl.style.top).toBe('')
    expect(wrapper.find('[data-testid="pomodoro-widget"]').exists()).toBe(true)

    expect(wrapper.emitted('resized')).toBeTruthy()
    wrapper.unmount()
  })
})
