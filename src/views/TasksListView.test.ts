import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import TasksListView from './TasksListView.vue'

const tasksState = ref<
  {
    id: string
    title: string
    description?: string | null
    color: string
    status: string
    due_date?: string | null
    block_id?: string | null
    event_link?: { calendarId: string; eventId: string } | null
    steps: any[]
    archived_at?: string | null
  }[]
>([])
const tasksMock = {
  get tasks() {
    return tasksState.value
  },
  get pendingTasks() {
    return tasksState.value.filter((t) => t.status !== 'done')
  },
  colorFor: (t: { color: string }) => t.color,
  blockFor: () => undefined,
}
const uiMock = {
  menuOpenForTaskId: null as string | null,
  toggleTaskMenu: vi.fn(),
  openEditTask: vi.fn(),
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

describe('TasksListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    tasksState.value = []
    uiMock.menuOpenForTaskId = null
  })

  it("usa EntityListing con título 'Tareas'", () => {
    const wrapper = mount(TasksListView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    expect(listing.exists()).toBe(true)
    expect(listing.props('title')).toBe('Tareas')
  })

  it('panel tiene data-testid', () => {
    const wrapper = mount(TasksListView)
    expect(wrapper.find("[data-testid='tasks-panel']").exists()).toBe(true)
  })

  it("muestra título 'Tareas'", () => {
    const wrapper = mount(TasksListView)
    expect(wrapper.text()).toContain('Tareas')
  })

  it('header tiene eyebrow y título con jerarquía', () => {
    const wrapper = mount(TasksListView)
    expect(wrapper.find('.text-eyebrow').text()).toBe('Pendientes')
    const header = wrapper.find('.bg-surface-2')
    expect(header.classes()).toContain('flex-col')
    expect(wrapper.find("[data-testid='tasks-panel']").exists()).toBe(true)
  })

  it('con showEyebrow=false no muestra el eyebrow pero sí el título', () => {
    const wrapper = mount(TasksListView, { props: { showEyebrow: false } })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.text-card-title').text()).toBe('Tareas')
  })

  it('no muestra contador', () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
    ]
    const wrapper = mount(TasksListView)
    expect(wrapper.text()).not.toContain('·')
  })

  it('renderiza TaskCard por cada tarea', () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: null,
        color: '#00ff00',
        status: 'doing',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
    ]
    const wrapper = mount(TasksListView)
    expect(wrapper.findAllComponents({ name: 'TaskCard' })).toHaveLength(2)
  })

  it('no renderiza tareas done', () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: null,
        color: '#00ff00',
        status: 'done',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
    ]
    const wrapper = mount(TasksListView)
    expect(wrapper.findAllComponents({ name: 'TaskCard' })).toHaveLength(1)
  })

  it('renderiza NewTaskCard', () => {
    const wrapper = mount(TasksListView)
    expect(wrapper.findComponent({ name: 'NewTaskCard' }).exists()).toBe(true)
  })

  it('TaskContextMenu aparece cuando el menú está abierto', () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
    ]
    uiMock.menuOpenForTaskId = 'task-1'
    const wrapper = mount(TasksListView)
    expect(wrapper.findComponent({ name: 'TaskContextMenu' }).exists()).toBe(true)
  })

  it('TaskContextMenu no aparece cuando el menú está cerrado', () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        archived_at: null,
      },
    ]
    uiMock.menuOpenForTaskId = null
    const wrapper = mount(TasksListView)
    expect(wrapper.findComponent({ name: 'TaskContextMenu' }).exists()).toBe(false)
  })
})
