import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import GoalsListView from './GoalsListView.vue'

const goalsState = ref<any[]>([])
const logsState = ref<any[]>([])
const goalsMock = {
  get goals() {
    return goalsState.value
  },
  get activeGoals() {
    return goalsState.value.filter((g) => g.archived_at === null)
  },
  get logs() {
    return logsState.value
  },
  loadLogsForRange: vi.fn(),
}
const uiMock = {
  menuOpenForGoalId: null as string | null,
  toggleGoalMenu: vi.fn(),
  openEditGoal: vi.fn(),
}
vi.mock('@/stores/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/goals')>()),
  useGoalsStore: () => goalsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

describe('GoalsListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    goalsState.value = []
    logsState.value = []
    uiMock.menuOpenForGoalId = null
  })

  it("usa EntityListing con título 'Objetivos'", () => {
    const wrapper = mount(GoalsListView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    expect(listing.exists()).toBe(true)
    expect(listing.props('title')).toBe('Objetivos')
  })

  it('panel tiene data-testid', () => {
    const wrapper = mount(GoalsListView)
    expect(wrapper.find("[data-testid='goals-panel']").exists()).toBe(true)
  })

  it("muestra título 'Objetivos'", () => {
    const wrapper = mount(GoalsListView)
    expect(wrapper.text()).toContain('Objetivos')
  })

  it('header tiene eyebrow y título con jerarquía', () => {
    const wrapper = mount(GoalsListView)
    expect(wrapper.find('.text-eyebrow').text()).toBe('Seguimiento')
    const header = wrapper.find('.bg-surface-2')
    expect(header.classes()).toContain('flex-col')
  })

  it('con showEyebrow=false no muestra el eyebrow pero sí el título', () => {
    const wrapper = mount(GoalsListView, { props: { showEyebrow: false } })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.text-card-title').text()).toBe('Objetivos')
  })

  it('no muestra contador', () => {
    goalsState.value = [
      {
        id: 'goal-1',
        title: 'Goal 1',
        description: null,
        color: '#00ff00',
        target: 10,
        unit: null,
        direction: 'up',
        frequency: { type: 'daily' },
        archived_at: null,
      },
    ]
    const wrapper = mount(GoalsListView)
    expect(wrapper.text()).not.toContain('·')
  })

  it('renderiza GoalCard por cada objetivo', () => {
    goalsState.value = [
      {
        id: 'goal-1',
        title: 'Goal 1',
        description: null,
        color: '#00ff00',
        target: 10,
        unit: null,
        direction: 'up',
        frequency: { type: 'daily' },
        archived_at: null,
      },
      {
        id: 'goal-2',
        title: 'Goal 2',
        description: null,
        color: '#ff0000',
        target: 20,
        unit: null,
        direction: 'up',
        frequency: { type: 'weekly' },
        archived_at: null,
      },
    ]
    const wrapper = mount(GoalsListView)
    expect(wrapper.findAllComponents({ name: 'GoalCard' })).toHaveLength(2)
  })

  it('no renderiza objetivos archivados', () => {
    goalsState.value = [
      {
        id: 'goal-1',
        title: 'Goal activo',
        description: null,
        color: '#00ff00',
        target: 10,
        unit: null,
        direction: 'up',
        frequency: { type: 'daily' },
        archived_at: null,
      },
      {
        id: 'goal-2',
        title: 'Goal archivado',
        description: null,
        color: '#ff0000',
        target: 20,
        unit: null,
        direction: 'up',
        frequency: { type: 'weekly' },
        archived_at: '2026-01-01T00:00:00.000Z',
      },
    ]
    const wrapper = mount(GoalsListView)
    const cards = wrapper.findAllComponents({ name: 'GoalCard' })
    expect(cards).toHaveLength(1)
    expect(cards[0].props('goal').id).toBe('goal-1')
  })

  it('renderiza NewGoalCard', () => {
    const wrapper = mount(GoalsListView)
    expect(wrapper.findComponent({ name: 'NewGoalCard' }).exists()).toBe(true)
  })

  it('GoalContextMenu aparece cuando el menú está abierto', () => {
    goalsState.value = [
      {
        id: 'goal-1',
        title: 'Goal 1',
        description: null,
        color: '#00ff00',
        target: 10,
        unit: null,
        direction: 'up',
        frequency: { type: 'daily' },
        archived_at: null,
      },
    ]
    uiMock.menuOpenForGoalId = 'goal-1'
    const wrapper = mount(GoalsListView)
    expect(wrapper.findComponent({ name: 'GoalContextMenu' }).exists()).toBe(true)
  })

  it('GoalContextMenu no aparece cuando el menú está cerrado', () => {
    goalsState.value = [
      {
        id: 'goal-1',
        title: 'Goal 1',
        description: null,
        color: '#00ff00',
        target: 10,
        unit: null,
        direction: 'up',
        frequency: { type: 'daily' },
        archived_at: null,
      },
    ]
    uiMock.menuOpenForGoalId = null
    const wrapper = mount(GoalsListView)
    expect(wrapper.findComponent({ name: 'GoalContextMenu' }).exists()).toBe(false)
  })
})
