import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GoalContextMenu from './GoalContextMenu.vue'

const goalsMock = {
  archiveGoal: vi.fn().mockResolvedValue(undefined),
  restoreGoal: vi.fn().mockResolvedValue(undefined),
}
const uiMock = {
  openEditGoal: vi.fn(),
  closeGoalMenu: vi.fn(),
}
vi.mock('@/stores/goals', () => ({
  useGoalsStore: () => goalsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

const mockGoal = {
  id: 'goal-1',
  title: 'Test Goal',
  description: null,
  color: '#00ff00',
  target: 10,
  unit: null,
  direction: 'up' as const,
  frequency: { type: 'daily' as const },
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

describe('GoalContextMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    goalsMock.archiveGoal.mockClear()
    goalsMock.restoreGoal.mockClear()
    uiMock.openEditGoal.mockClear()
    uiMock.closeGoalMenu.mockClear()
  })

  it('renders via EntityContextMenu', () => {
    const wrapper = mount(GoalContextMenu, {
      props: { goal: mockGoal },
    })
    expect(wrapper.findComponent({ name: 'EntityContextMenu' }).exists()).toBe(true)
  })

  it('passes correct props to EntityContextMenu', () => {
    const wrapper = mount(GoalContextMenu, {
      props: { goal: mockGoal },
    })
    const ctx = wrapper.findComponent({ name: 'EntityContextMenu' })
    expect(ctx.props('entityId')).toBe('goal-1')
    expect(ctx.props('isArchived')).toBe(false)
    expect(ctx.props('triggerDataAttr')).toBe('data-goal-menu-trigger')
  })

  it('passes isArchived=true when goal is archived', () => {
    const wrapper = mount(GoalContextMenu, {
      props: { goal: { ...mockGoal, archived_at: '2026-01-01T00:00:00Z' } },
    })
    const ctx = wrapper.findComponent({ name: 'EntityContextMenu' })
    expect(ctx.props('isArchived')).toBe(true)
  })
})
