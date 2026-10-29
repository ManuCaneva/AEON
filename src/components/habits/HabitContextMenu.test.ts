import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HabitContextMenu from './HabitContextMenu.vue'

const habitsMock = {
  deleteHabit: vi.fn().mockResolvedValue(undefined),
}
const uiMock = {
  openEdit: vi.fn(),
  closeMenu: vi.fn(),
}
vi.mock('@/stores/habits', () => ({
  useHabitsStore: () => habitsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

const mockHabit = {
  id: 'habit-1',
  name: 'Test Habit',
  description: null,
  color: '#ff0000',
  icon: 'dumbbell',
  frequency: { type: 'daily' as const, target_per_period: 1 },
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

function q(testid: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testid}"]`)
}

describe('HabitContextMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    habitsMock.deleteHabit.mockClear()
    uiMock.openEdit.mockClear()
    uiMock.closeMenu.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function mountMenu() {
    wrapper = mount(HabitContextMenu, {
      props: { habit: mockHabit },
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
    expect(ctx.props('entityId')).toBe('habit-1')
    expect(ctx.props('triggerDataAttr')).toBe('data-habit-menu-trigger')
    expect(ctx.props('confirmTitle')).toBe('¿Eliminar hábito?')
  })

  it('Eliminar pide confirmación y recién ahí borra el hábito', async () => {
    mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    expect(habitsMock.deleteHabit).not.toHaveBeenCalled()

    q('entity-delete-confirm-yes')!.click()
    await flushPromises()
    expect(habitsMock.deleteHabit).toHaveBeenCalledWith('habit-1')
    expect(uiMock.closeMenu).toHaveBeenCalled()
  })

  it('cancelar no borra el hábito', async () => {
    mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    q('entity-delete-confirm-no')!.click()
    await flushPromises()
    expect(habitsMock.deleteHabit).not.toHaveBeenCalled()
    expect(uiMock.closeMenu).not.toHaveBeenCalled()
  })

  it('editar abre el formulario de edición', () => {
    mountMenu()
    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find((btn) => btn.textContent?.includes('Editar'))!.click()
    expect(uiMock.openEdit).toHaveBeenCalledWith('habit-1')
  })
})
