import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TaskContextMenu from './TaskContextMenu.vue'
import type { Task } from '@/schemas/tasks'

const tasksMock = {
  deleteTaskWithEvent: vi.fn().mockResolvedValue(undefined),
}
const uiMock = {
  openEditTask: vi.fn(),
  closeTaskMenu: vi.fn(),
}
vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => tasksMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    color: '#ff0000',
    status: 'todo',
    due_date: null,
    block_id: null,
    event_link: null,
    steps: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    ...overrides,
  }
}

function q(testid: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testid}"]`)
}

describe('TaskContextMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function mountMenu(task: Task = makeTask()) {
    wrapper = mount(TaskContextMenu, { props: { task }, attachTo: document.body })
    return wrapper
  }

  it('ofrece editar y eliminar, sin archivar', () => {
    mountMenu()
    const menu = document.body.querySelector("[role='menu']")
    expect(q('task-edit-button')).not.toBeNull()
    expect(q('task-delete-button')).not.toBeNull()
    expect(menu?.textContent).not.toContain('Archivar')
    expect(menu?.textContent).not.toContain('Restaurar')
  })

  it('se apoya en el menú compartido de entidad con evento', () => {
    const w = mountMenu()
    expect(w.findComponent({ name: 'EntityEventContextMenu' }).exists()).toBe(true)
  })

  it('editar abre el formulario de edición', () => {
    mountMenu()
    q('task-edit-button')!.click()
    expect(uiMock.openEditTask).toHaveBeenCalledWith('task-1')
  })

  it('sin vínculo, eliminar pide confirmación y borra solo la tarea', async () => {
    mountMenu()
    q('task-delete-button')!.click()
    await flushPromises()

    expect(q('task-delete-confirm')).not.toBeNull()
    expect(tasksMock.deleteTaskWithEvent).not.toHaveBeenCalled()

    q('task-delete-confirm-yes')!.click()
    await flushPromises()
    expect(tasksMock.deleteTaskWithEvent).toHaveBeenCalledWith('task-1', false)
    expect(uiMock.closeTaskMenu).toHaveBeenCalled()
  })

  it('sin vínculo, cancelar no borra', async () => {
    mountMenu()
    q('task-delete-button')!.click()
    await flushPromises()
    q('task-delete-confirm-no')!.click()
    await flushPromises()

    expect(tasksMock.deleteTaskWithEvent).not.toHaveBeenCalled()
    expect(q('task-delete-confirm')).toBeNull()
    expect(q('task-delete-button')).not.toBeNull()
  })

  it('con vínculo ofrece eliminar con las dos salidas', async () => {
    mountMenu(makeTask({ event_link: { calendarId: 'local', eventId: 'evt-1' } }))
    q('task-delete-button')!.click()
    await flushPromises()

    expect(q('task-delete-confirm')).not.toBeNull()
    expect(q('task-delete-task-only')?.textContent).toContain('Solo la tarea')
    expect(q('task-delete-task-and-event')?.textContent).toContain('La tarea y su evento')
  })

  it('"Solo la tarea" borra la tarea sin tocar el evento', async () => {
    mountMenu(makeTask({ event_link: { calendarId: 'local', eventId: 'evt-1' } }))
    q('task-delete-button')!.click()
    await flushPromises()
    q('task-delete-task-only')!.click()
    await flushPromises()

    expect(tasksMock.deleteTaskWithEvent).toHaveBeenCalledWith('task-1', false)
    expect(uiMock.closeTaskMenu).toHaveBeenCalled()
  })

  it('"La tarea y su evento" borra la tarea y su evento', async () => {
    mountMenu(makeTask({ event_link: { calendarId: 'local', eventId: 'evt-1' } }))
    q('task-delete-button')!.click()
    await flushPromises()
    q('task-delete-task-and-event')!.click()
    await flushPromises()

    expect(tasksMock.deleteTaskWithEvent).toHaveBeenCalledWith('task-1', true)
    expect(uiMock.closeTaskMenu).toHaveBeenCalled()
  })
})
