import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GoalContextMenu from './GoalContextMenu.vue'

const goalsMock = {
  deleteGoal: vi.fn().mockResolvedValue(undefined),
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
  color: '#ff0000',
  target: 10,
  unit: 'horas',
  direction: 'up' as const,
  frequency: { type: 'daily' as const },
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

function q(testid: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testid}"]`)
}

describe('GoalContextMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    goalsMock.deleteGoal.mockClear()
    uiMock.openEditGoal.mockClear()
    uiMock.closeGoalMenu.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function mountMenu() {
    wrapper = mount(GoalContextMenu, {
      props: { goal: mockGoal },
      attachTo: document.body,
    })
    return wrapper
  }

  it('renders via EntityContextMenu', () => {
    const w = mountMenu()
    expect(w.findComponent({ name: 'EntityContextMenu' }).exists()).toBe(true)
  })

  it('passes correct props to EntityContextMenu', () => {
    const w = mountMenu()
    const ctx = w.findComponent({ name: 'EntityContextMenu' })
    expect(ctx.props('entityId')).toBe('goal-1')
    expect(ctx.props('triggerDataAttr')).toBe('data-goal-menu-trigger')
    expect(ctx.props('confirmTitle')).toBe('¿Eliminar objetivo?')
  })

  it('Eliminar pide confirmación y recién ahí borra el objetivo', async () => {
    mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    expect(goalsMock.deleteGoal).not.toHaveBeenCalled()

    q('entity-delete-confirm-yes')!.click()
    await flushPromises()
    expect(goalsMock.deleteGoal).toHaveBeenCalledWith('goal-1')
    expect(uiMock.closeGoalMenu).toHaveBeenCalled()
  })

  it('cancelar no borra el objetivo', async () => {
    mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    q('entity-delete-confirm-no')!.click()
    await flushPromises()
    expect(goalsMock.deleteGoal).not.toHaveBeenCalled()
    expect(uiMock.closeGoalMenu).not.toHaveBeenCalled()
  })
})
