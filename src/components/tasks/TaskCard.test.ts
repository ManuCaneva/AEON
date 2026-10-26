import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TaskCard from './TaskCard.vue'
import type { Task } from '@/schemas/tasks'
import { hasRawPaletteColor } from '@/test/colorGuard'
const tasksMock = {
  toggleStep: vi.fn(),
  completeTask: vi.fn(),
  colorFor: vi.fn((task: Task) => (task.block_id ? 'rgb(var(--color-block-green))' : task.color)),
}
const uiMock = {
  menuOpenForTaskId: null as string | null,
  toggleTaskMenu: vi.fn(),
}

vi.mock('@/stores/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/tasks')>()
  return {
    ...actual,
    useTasksStore: () => tasksMock,
  }
})
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

const mockTaskWithSteps: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'Test description',
  color: '#ff0000',
  status: 'todo',
  due_date: null,
  block_id: null,
  event_link: null,
  steps: [
    { id: 'step-1', title: 'Step 1', done: false },
    { id: 'step-2', title: 'Step 2', done: true },
  ],
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

const mockTaskNoSteps: Task = {
  ...mockTaskWithSteps,
  steps: [],
}

describe('TaskCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uiMock.menuOpenForTaskId = null
    vi.clearAllMocks()
  })

  it('should render task title', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.text()).toContain('Test Task')
  })

  it('should render task description when present', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.text()).toContain('Test description')
  })

  it('should not render description when null', () => {
    const task = { ...mockTaskWithSteps, description: null }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    expect(wrapper.find("[data-testid='task-description']").exists()).toBe(false)
  })

  it('should render color indicator', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const indicator = wrapper.find("[data-testid='task-color-indicator']")
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('style')).toContain('background-color: #ff0000')
  })

  it('usa el color del bloque cuando la tarea lo tiene', () => {
    const task = { ...mockTaskWithSteps, block_id: 'block-1' }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    const indicator = wrapper.find("[data-testid='task-color-indicator']")
    expect(indicator.attributes('style')).toContain('rgb(var(--color-block-green))')
  })

  it('should not render CycleCheckbox when task has steps', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.findComponent({ name: 'CycleCheckbox' }).exists()).toBe(false)
  })

  it('should render complete checkbox when task has no steps', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskNoSteps },
    })
    expect(wrapper.find("[data-testid='task-complete-btn']").exists()).toBe(true)
  })

  it('should keep complete button enabled without disabled visuals when task has pending steps', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const btn = wrapper.find("[data-testid='task-complete-btn']")
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.classes()).not.toContain('cursor-not-allowed')
    expect(btn.classes()).not.toContain('opacity-40')
  })

  it('should complete task with pending steps when complete button is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const btn = wrapper.find("[data-testid='task-complete-btn']")
    await btn.trigger('click')
    expect(tasksMock.completeTask).toHaveBeenCalledWith('task-1')
  })

  it('should render steps count', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.text()).toContain('1/2')
  })

  it('should not render steps count when no steps', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskNoSteps },
    })
    expect(wrapper.find("[data-testid='task-steps']").exists()).toBe(false)
  })

  it('should render deadline urgency when due_date exists', () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const task = { ...mockTaskWithSteps, due_date: tomorrow.toISOString().split('T')[0] }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    expect(wrapper.find("[data-testid='task-deadline']").exists()).toBe(true)
  })

  it('should not render deadline when due_date is null', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.find("[data-testid='task-deadline']").exists()).toBe(false)
  })

  it('should render progress bar when due_date exists', () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const task = { ...mockTaskWithSteps, due_date: tomorrow.toISOString().split('T')[0] }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    expect(wrapper.find("[data-testid='task-progress-bar']").exists()).toBe(true)
  })

  it('should render menu button', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const menuBtn = wrapper.find("[data-testid='task-menu-button']")
    expect(menuBtn.exists()).toBe(true)
  })

  it('should call ui.toggleTaskMenu when menu button clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const menuBtn = wrapper.find("[data-testid='task-menu-button']")
    await menuBtn.trigger('click')
    expect(uiMock.toggleTaskMenu).toHaveBeenCalledWith('task-1')
  })

  it('should render TaskContextMenu when task menu is open for this task', () => {
    uiMock.menuOpenForTaskId = 'task-1'
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.findComponent({ name: 'TaskContextMenu' }).exists()).toBe(true)
  })

  it('should not render TaskContextMenu when task menu is open for another task', () => {
    uiMock.menuOpenForTaskId = 'task-2'
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.findComponent({ name: 'TaskContextMenu' }).exists()).toBe(false)
  })

  it('should have z-10 class when task menu is open', () => {
    uiMock.menuOpenForTaskId = 'task-1'
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.find("[data-testid='task-card']").classes()).toContain('z-10')
  })

  it('should not show steps list when collapsed', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(wrapper.find("[data-testid='task-steps-list']").exists()).toBe(false)
  })

  it('should toggle expansion when card body is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const body = wrapper.find("[data-testid='task-card-body']")
    await body.trigger('click')
    expect(wrapper.find("[data-testid='task-steps-list']").exists()).toBe(true)
    await body.trigger('click')
    expect(wrapper.find("[data-testid='task-steps-list']").exists()).toBe(false)
  })

  it('should render step items with checkboxes when expanded', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    await wrapper.find("[data-testid='task-card-body']").trigger('click')
    const stepItems = wrapper.findAll("[data-testid='task-step-item']")
    expect(stepItems).toHaveLength(2)
    expect(stepItems[0].text()).toContain('Step 1')
    expect(stepItems[1].text()).toContain('Step 2')
  })

  it('should call toggleStep when a step checkbox is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    await wrapper.find("[data-testid='task-card-body']").trigger('click')
    const stepCheckboxes = wrapper.findAll("[data-testid='task-step-checkbox']")
    await stepCheckboxes[0].trigger('click')
    expect(tasksMock.toggleStep).toHaveBeenCalledWith('task-1', 'step-1')
  })

  it('should not toggle expansion when menu button is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    const menuBtn = wrapper.find("[data-testid='task-menu-button']")
    await menuBtn.trigger('click')
    expect(wrapper.find("[data-testid='task-steps-list']").exists()).toBe(false)
  })

  it('should call completeTask when no-steps checkbox is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskNoSteps },
    })
    const btn = wrapper.find("[data-testid='task-complete-btn']")
    await btn.trigger('click')
    expect(tasksMock.completeTask).toHaveBeenCalledWith('task-1')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(TaskCard, {
      props: { task: mockTaskWithSteps },
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('deadline vencida usa pill tintada con acento rojo', () => {
    const past = new Date()
    past.setDate(past.getDate() - 2)
    const task = { ...mockTaskWithSteps, due_date: past.toISOString().split('T')[0] }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    const deadline = wrapper.find("[data-testid='task-deadline']")
    expect(deadline.classes()).toContain('bg-accent-red-tint')
    expect(deadline.classes()).toContain('text-accent-red')
  })

  it('deadline próxima usa pill tintada con acento naranja', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 1)
    const task = { ...mockTaskWithSteps, due_date: soon.toISOString().split('T')[0] }
    const wrapper = mount(TaskCard, {
      props: { task },
    })
    const deadline = wrapper.find("[data-testid='task-deadline']")
    expect(deadline.classes()).toContain('bg-accent-orange-tint')
    expect(deadline.classes()).toContain('text-accent-orange')
  })
})
