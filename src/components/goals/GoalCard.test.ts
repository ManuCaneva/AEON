import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GoalCard from './GoalCard.vue'
import type { Goal, GoalLog } from '@/schemas/goals'
import { formatYyyyMmDd } from '@/lib/calendarDates'
import { hasRawPaletteColor } from '@/test/colorGuard'

const mockGoal: Goal = {
  id: 'goal-1',
  title: 'Test Goal',
  description: 'Test description',
  color: '#00ff00',
  target: 10,
  unit: 'pages',
  direction: 'up',
  frequency: { type: 'daily' },
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

const mockDownGoal: Goal = {
  ...mockGoal,
  id: 'goal-down',
  direction: 'down',
}

function makeLog(amount: number, logDate = formatYyyyMmDd(new Date())): GoalLog {
  return {
    id: `log-${amount}`,
    goal_id: 'goal-1',
    log_date: logDate,
    amount,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

const goalsMock = {
  logs: [] as GoalLog[],
  incrementLog: vi.fn(),
}
const uiMock = {
  menuOpenForGoalId: null as string | null,
  toggleGoalMenu: vi.fn(),
}
vi.mock('@/stores/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/goals')>()),
  useGoalsStore: () => goalsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

describe('GoalCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    goalsMock.logs = []
    uiMock.menuOpenForGoalId = null
    uiMock.toggleGoalMenu.mockClear()
  })

  it('should render goal title', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.text()).toContain('Test Goal')
  })

  it('should render goal description when present', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.text()).toContain('Test description')
  })

  it('should not render description when null', () => {
    const goal = { ...mockGoal, description: null }
    const wrapper = mount(GoalCard, {
      props: { goal },
    })
    expect(wrapper.find("[data-testid='goal-description']").exists()).toBe(false)
  })

  it('should render color indicator', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const indicator = wrapper.find("[data-testid='goal-color-indicator']")
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('style')).toContain('background-color: #00ff00')
  })

  it('should render progress text', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.text()).toContain('0/10')
  })

  it('should render unit when present', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.text()).toContain('pages')
  })

  it('should render frequency indicator', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.text()).toContain('Diario')
  })

  it('should render weekly frequency', () => {
    const goal = { ...mockGoal, frequency: { type: 'weekly' as const } }
    const wrapper = mount(GoalCard, {
      props: { goal },
    })
    expect(wrapper.text()).toContain('Semanal')
  })

  it('should render interval frequency', () => {
    const goal = { ...mockGoal, frequency: { type: 'interval' as const, interval_days: 3 } }
    const wrapper = mount(GoalCard, {
      props: { goal },
    })
    expect(wrapper.text()).toContain('Cada 3 días')
  })

  it('should render progress bar', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const progressBar = wrapper.find("[data-testid='goal-progress-bar']")
    expect(progressBar.exists()).toBe(true)
  })

  it('should render increment button', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const incrementBtn = wrapper.find("[data-testid='goal-increment-button']")
    expect(incrementBtn.exists()).toBe(true)
  })

  it('should call incrementLog when increment button clicked', async () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const incrementBtn = wrapper.find("[data-testid='goal-increment-button']")
    await incrementBtn.trigger('click')
    expect(goalsMock.incrementLog).toHaveBeenCalledWith('goal-1', 1)
  })

  it('should render menu button', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const menuBtn = wrapper.find("[data-testid='goal-menu-button']")
    expect(menuBtn.exists()).toBe(true)
  })

  it('should call ui.toggleGoalMenu when menu button clicked', async () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const menuBtn = wrapper.find("[data-testid='goal-menu-button']")
    await menuBtn.trigger('click')
    expect(uiMock.toggleGoalMenu).toHaveBeenCalledWith('goal-1')
  })

  it('should render GoalContextMenu when goal menu is open for this goal', () => {
    uiMock.menuOpenForGoalId = 'goal-1'
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.findComponent({ name: 'GoalContextMenu' }).exists()).toBe(true)
  })

  it('should not render GoalContextMenu when goal menu is open for another goal', () => {
    uiMock.menuOpenForGoalId = 'goal-2'
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.findComponent({ name: 'GoalContextMenu' }).exists()).toBe(false)
  })

  it('should have z-10 class when goal menu is open', () => {
    uiMock.menuOpenForGoalId = 'goal-1'
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(wrapper.find("[data-testid='goal-card']").classes()).toContain('z-10')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('badge de completado usa acento verde tintado', () => {
    goalsMock.logs = [makeLog(10)]
    const wrapper = mount(GoalCard, {
      props: { goal: mockGoal },
    })
    const incrementBtn = wrapper.find("[data-testid='goal-increment-button']")
    expect(incrementBtn.classes()).toContain('bg-accent-green-tint')
    expect(incrementBtn.classes()).toContain('text-accent-green')
  })

  it('muestra el contador de restantes en objetivos de descontar', () => {
    goalsMock.logs = [{ ...makeLog(3), goal_id: 'goal-down' }]
    const wrapper = mount(GoalCard, {
      props: { goal: mockDownGoal },
    })
    expect(wrapper.text()).toContain('7/10 restantes')
  })

  it('muestra 10/10 restantes al inicio de un objetivo de descontar', () => {
    const wrapper = mount(GoalCard, {
      props: { goal: mockDownGoal },
    })
    expect(wrapper.text()).toContain('10/10 restantes')
  })

  it('el botón etiqueta Sumar o Restar según la dirección y sigue llamando incrementLog', async () => {
    const upWrapper = mount(GoalCard, { props: { goal: mockGoal } })
    const upBtn = upWrapper.find("[data-testid='goal-increment-button']")
    expect(upBtn.attributes('aria-label')).toBe('Sumar 1')
    await upBtn.trigger('click')
    expect(goalsMock.incrementLog).toHaveBeenCalledWith('goal-1', 1)

    const downWrapper = mount(GoalCard, { props: { goal: mockDownGoal } })
    const downBtn = downWrapper.find("[data-testid='goal-increment-button']")
    expect(downBtn.attributes('aria-label')).toBe('Descontar 1')
    await downBtn.trigger('click')
    expect(goalsMock.incrementLog).toHaveBeenCalledWith('goal-down', 1)
  })

  it('deshabilita el botón al llegar a la meta en objetivos de descontar', () => {
    goalsMock.logs = [{ ...makeLog(10), goal_id: 'goal-down' }]
    const wrapper = mount(GoalCard, {
      props: { goal: mockDownGoal },
    })
    const incrementBtn = wrapper.find("[data-testid='goal-increment-button']")
    expect(incrementBtn.attributes('disabled')).toBeDefined()
    expect(incrementBtn.classes()).toContain('bg-accent-green-tint')
    expect(wrapper.text()).toContain('0/10 restantes')
  })

  it('cuenta los logs con la fecha local aunque la fecha UTC sea otra', () => {
    vi.useFakeTimers()
    try {
      // 01:00Z cae en el día local anterior al oeste de UTC; 23:00Z, al día
      // local siguiente al este. En TZ=UTC no hay desfase posible.
      const offset = new Date().getTimezoneOffset()
      if (offset === 0) return
      const moment = new Date(Date.UTC(2026, 9, 26, offset >= 0 ? 1 : 23, 30))
      vi.setSystemTime(moment)
      const localDate = formatYyyyMmDd(moment)
      expect(new Date().toISOString().split('T')[0]).not.toBe(localDate)

      goalsMock.logs = [makeLog(4, localDate)]
      const wrapper = mount(GoalCard, {
        props: { goal: mockGoal },
      })
      expect(wrapper.text()).toContain('4/10')
    } finally {
      vi.useRealTimers()
    }
  })
})
