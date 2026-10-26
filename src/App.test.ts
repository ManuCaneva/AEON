import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'

let uiState: Record<string, unknown>

const mockSetViewMode = vi.fn()

const { onShowPomodoroInMain, requestsPomodoroView, stopListening } = vi.hoisted(() => {
  const stopListening = vi.fn()
  return {
    onShowPomodoroInMain: vi.fn().mockResolvedValue(stopListening),
    requestsPomodoroView: vi.fn().mockReturnValue(false),
    stopListening,
  }
})

vi.mock('@/lib/pomodoroMainWindow', () => ({ onShowPomodoroInMain, requestsPomodoroView }))

vi.mock('@/stores/habits', () => ({
  useHabitsStore: () => ({
    loadInitialData: vi.fn(),
    activeHabits: [],
    logs: [],
    completedToday: new Map(),
    isCompletedToday: vi.fn(() => false),
    incrementCheckIn: vi.fn(),
    decrementCheckIn: vi.fn(),
  }),
}))

vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => ({
    loadTasks: vi.fn(),
    tasks: [],
    pendingTasks: [],
  }),
}))

vi.mock('@/stores/goals', () => ({
  useGoalsStore: () => ({
    loadGoals: vi.fn(),
    loadLogsForRange: vi.fn(),
    goals: [],
    logs: [],
  }),
}))

vi.mock('@/stores/exams', () => ({
  useExamsStore: () => ({
    loadExams: vi.fn(),
    exams: [],
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiState,
}))

vi.mock('@/stores/pomodoro', () => ({
  usePomodoroStore: () => ({
    load: vi.fn(),
    startTicker: vi.fn(),
    stopTicker: vi.fn(),
  }),
}))

vi.mock('@/components/dashboard/DashboardView.vue', () => ({
  default: { template: '<div data-testid="mock-dashboard" />' },
}))

vi.mock('@/views/ArchivedView.vue', () => ({
  default: { template: '<div data-testid="mock-archived" />' },
}))

vi.mock('@/views/SettingsView.vue', () => ({
  default: { template: '<div data-testid="mock-settings" />' },
}))

vi.mock('@/views/PomodoroView.vue', () => ({
  default: { template: '<div data-testid="mock-pomodoro" />' },
}))

vi.mock('@/components/layout/Sidebar.vue', () => ({
  default: { template: '<aside data-testid="mock-sidebar" />' },
}))

vi.mock('@/components/habits/HabitFormModal.vue', () => ({
  default: { template: '<div data-testid="mock-habit-modal" />' },
}))

vi.mock('@/components/tasks/TaskFormModal.vue', () => ({
  default: { template: '<div data-testid="mock-task-modal" />' },
}))

vi.mock('@/components/goals/GoalFormModal.vue', () => ({
  default: { template: '<div data-testid="mock-goal-modal" />' },
}))

vi.mock('@/components/exams/ExamFormModal.vue', () => ({
  default: { template: '<div data-testid="mock-exam-modal" />' },
}))

const { restorePomodoroMiniWindow } = vi.hoisted(() => ({
  restorePomodoroMiniWindow: vi.fn(),
}))

vi.mock('@/lib/pomodoroMiniWindow', () => ({ restorePomodoroMiniWindow }))

describe('App arranque', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    restorePomodoroMiniWindow.mockClear()
    uiState = {
      viewMode: 'dashboard',
      editMode: false,
      sidebarCollapsed: false,
      wallpaperUrl: null,
      loadWallpaper: vi.fn(),
    }
  })

  it('al arrancar restaura la ventana mini según el estado guardado', () => {
    mount(App)

    expect(restorePomodoroMiniWindow).toHaveBeenCalledOnce()
  })
})

describe('App layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uiState = {
      viewMode: 'dashboard',
      editMode: false,
      sidebarCollapsed: false,
      wallpaperUrl: null,
      loadWallpaper: vi.fn(),
      setViewMode: mockSetViewMode,
    }
  })

  it('root element has h-screen and overflow-hidden', () => {
    const wrapper = mount(App)
    const root = wrapper.element as HTMLElement
    expect(root.classList.contains('h-screen')).toBe(true)
    expect(root.classList.contains('overflow-hidden')).toBe(true)
    expect(root.classList.contains('min-h-screen')).toBe(false)
  })

  it('main content area has h-full and overflow-hidden', () => {
    const wrapper = mount(App)
    const root = wrapper.element as HTMLElement
    const contentWrapper = root.querySelector('.flex-1.flex.flex-col.min-w-0') as HTMLElement
    expect(contentWrapper).toBeTruthy()
    expect(contentWrapper.classList.contains('h-full')).toBe(true)
    expect(contentWrapper.classList.contains('overflow-hidden')).toBe(true)
  })

  it('view container has min-h-0 and overflow-hidden', () => {
    const wrapper = mount(App)
    const root = wrapper.element as HTMLElement
    const viewContainer = root.querySelector('.flex-1.p-4') as HTMLElement
    expect(viewContainer).toBeTruthy()
    expect(viewContainer.classList.contains('min-h-0')).toBe(true)
    expect(viewContainer.classList.contains('overflow-hidden')).toBe(true)
  })

  it('la sidebar vive en un slot overlay que reserva el ancho sin animarlo', () => {
    const wrapper = mount(App)
    const root = wrapper.element as HTMLElement
    const slot = root.querySelector('[data-testid="sidebar-slot"]') as HTMLElement
    expect(slot).toBeTruthy()
    expect(slot.classList.contains('relative')).toBe(true)
    expect(slot.classList.contains('h-full')).toBe(true)
    expect(slot.classList.contains('shrink-0')).toBe(true)
    expect(slot.classList.contains('w-44')).toBe(true)
    expect(slot.classList.contains('transition-[width]')).toBe(false)

    const sidebar = root.querySelector('[data-testid="mock-sidebar"]') as HTMLElement
    expect(sidebar.classList.contains('absolute')).toBe(true)
    expect(sidebar.classList.contains('inset-y-0')).toBe(true)
    expect(sidebar.classList.contains('left-0')).toBe(true)
    expect(sidebar.classList.contains('z-10')).toBe(true)
  })

  it('el slot colapsa al instante y el contenido es su hermano flex-1', async () => {
    uiState = reactive({
      viewMode: 'dashboard',
      editMode: false,
      sidebarCollapsed: false,
      wallpaperUrl: null,
      loadWallpaper: vi.fn(),
    }) as unknown as Record<string, unknown>
    const wrapper = mount(App)
    const root = wrapper.element as HTMLElement
    const slot = root.querySelector('[data-testid="sidebar-slot"]') as HTMLElement
    expect(slot.classList.contains('w-44')).toBe(true)

    uiState.sidebarCollapsed = true
    await nextTick()
    expect(slot.classList.contains('w-14')).toBe(true)
    expect(slot.classList.contains('w-44')).toBe(false)

    const content = root.querySelector('.flex-1.flex.flex-col.min-w-0') as HTMLElement
    expect(content.previousElementSibling).toBe(slot)
  })
})

describe('App — página Pomodoro pedida desde la ventana mini', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uiState = {
      viewMode: 'dashboard',
      editMode: false,
      sidebarCollapsed: false,
      wallpaperUrl: null,
      loadWallpaper: vi.fn(),
      setViewMode: mockSetViewMode,
    }
    mockSetViewMode.mockClear()
    onShowPomodoroInMain.mockClear()
    stopListening.mockClear()
    requestsPomodoroView.mockReturnValue(false)
  })

  it('cuando la mini pide la página Pomodoro, la ventana principal navega a ella', () => {
    mount(App)
    const handler = onShowPomodoroInMain.mock.calls[0][0] as () => void

    handler()

    expect(mockSetViewMode).toHaveBeenCalledWith('pomodoro')
  })

  it('arranca en la página Pomodoro cuando la ventana se abrió con ese pedido', () => {
    requestsPomodoroView.mockReturnValue(true)

    mount(App)

    expect(requestsPomodoroView).toHaveBeenCalledWith(window.location.search)
    expect(mockSetViewMode).toHaveBeenCalledWith('pomodoro')
  })

  it('al desmontar deja de escuchar los pedidos de la mini', async () => {
    const wrapper = mount(App)

    wrapper.unmount()
    await flushPromises()

    expect(stopListening).toHaveBeenCalledOnce()
  })
})
