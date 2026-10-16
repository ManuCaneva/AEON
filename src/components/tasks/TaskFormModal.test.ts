import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import TaskFormModal from './TaskFormModal.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

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
  }[]
>([])
const tasksMock = {
  get tasks() {
    return tasksState.value
  },
  createTask: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue({}),
  createTaskWithEvent: vi.fn().mockResolvedValue({
    task: { id: 'created-task' },
    eventError: null,
  }),
  updateTaskWithEvent: vi.fn().mockResolvedValue({
    task: { id: 'edited-task' },
    eventError: null,
  }),
}
const weeklyBlocks = ref<{ id: string; title: string; color: string }[]>([])
const weeklyMock = {
  get blocksWithSlots() {
    return weeklyBlocks.value
  },
  loadAll: vi.fn().mockResolvedValue(undefined),
}
const calendarEvents = ref<{ id: string; calendarId: string; date: string; title: string }[]>([])
const calendarConnected = ref(false)
const calendarCalendars = ref<{ id: string; summary: string; primary?: boolean }[]>([])
const calendarMock = {
  get events() {
    return calendarEvents.value
  },
  get connected() {
    return calendarConnected.value
  },
  get calendars() {
    return calendarCalendars.value
  },
}
const uiState = {
  createTaskOpen: ref(true),
  editingTaskId: ref<string | null>(null),
  closeTaskModal: vi.fn(),
}
const uiMock = {
  get createTaskOpen() {
    return uiState.createTaskOpen.value
  },
  set createTaskOpen(v: boolean) {
    uiState.createTaskOpen.value = v
  },
  get editingTaskId() {
    return uiState.editingTaskId.value
  },
  set editingTaskId(v: string | null) {
    uiState.editingTaskId.value = v
  },
  closeTaskModal: () => {
    uiState.createTaskOpen.value = false
    uiState.editingTaskId.value = null
  },
  openCreateTask: () => {
    uiState.createTaskOpen.value = true
    uiState.editingTaskId.value = null
  },
  openEditTask: (id: string) => {
    uiState.createTaskOpen.value = true
    uiState.editingTaskId.value = id
  },
}
vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => tasksMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))
vi.mock('@/stores/weeklySchedule', () => ({
  useWeeklyScheduleStore: () => weeklyMock,
}))
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => calendarMock,
}))

describe('TaskFormModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    tasksState.value = []
    uiState.createTaskOpen.value = true
    uiState.editingTaskId.value = null
    weeklyBlocks.value = []
    weeklyMock.loadAll.mockClear()
    calendarEvents.value = []
    calendarConnected.value = false
    calendarCalendars.value = []
    tasksMock.createTaskWithEvent
      .mockReset()
      .mockResolvedValue({ task: { id: 'created-task' }, eventError: null })
    tasksMock.updateTaskWithEvent
      .mockReset()
      .mockResolvedValue({ task: { id: 'edited-task' }, eventError: null })
    wrapper = mount(TaskFormModal, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it("should render modal with title 'Nueva tarea' when creating", () => {
    const modal = document.body.querySelector("[role='dialog']")
    expect(modal?.textContent).toContain('Nueva tarea')
  })

  it("should render modal with title 'Editar tarea' when editing", async () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Test Task',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        steps: [],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()

    const modal = document.body.querySelector("[role='dialog']")
    expect(modal?.textContent).toContain('Editar tarea')
  })

  it('should have title input', () => {
    const input = document.body.querySelector("input[type='text']")
    expect(input).not.toBeNull()
  })

  it('should have description textarea', () => {
    const textarea = document.body.querySelector('textarea')
    expect(textarea).not.toBeNull()
  })

  it('should have color picker with HABIT_COLORS', () => {
    const colorButtons = document.body.querySelectorAll("[data-testid='color-option']")
    expect(colorButtons.length).toBeGreaterThan(0)
  })

  it('should have due date input', () => {
    const dateInput = document.body.querySelector("input[type='date']")
    expect(dateInput).not.toBeNull()
  })

  it('should have add step button', () => {
    const addStepBtn = document.body.querySelector("[data-testid='add-step-button']")
    expect(addStepBtn).not.toBeNull()
  })

  it('should add step when add step button clicked', async () => {
    const addStepBtn = document.body.querySelector(
      "[data-testid='add-step-button']"
    ) as HTMLButtonElement
    addStepBtn.click()
    await flushPromises()
    const stepInputs = document.body.querySelectorAll("[data-testid='step-input']")
    expect(stepInputs).toHaveLength(1)
  })

  it('should remove step when remove button clicked', async () => {
    const addStepBtn = document.body.querySelector(
      "[data-testid='add-step-button']"
    ) as HTMLButtonElement
    addStepBtn.click()
    await flushPromises()
    const removeBtn = document.body.querySelector(
      "[data-testid='remove-step-button']"
    ) as HTMLButtonElement
    removeBtn.click()
    await flushPromises()
    const stepInputs = document.body.querySelectorAll("[data-testid='step-input']")
    expect(stepInputs).toHaveLength(0)
  })

  it('should filter out empty step rows and keep the filled ones', async () => {
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    titleInput.value = 'Task'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    const addStepBtn = document.body.querySelector(
      "[data-testid='add-step-button']"
    ) as HTMLButtonElement
    addStepBtn.click()
    addStepBtn.click()
    await flushPromises()
    const stepInputs = document.body.querySelectorAll(
      "[data-testid='step-input'] input"
    ) as NodeListOf<HTMLInputElement>
    stepInputs[0].value = 'Paso 1'
    stepInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    expect(tasksMock.createTaskWithEvent).toHaveBeenCalled()
    const payload = tasksMock.createTaskWithEvent.mock.calls[
      tasksMock.createTaskWithEvent.mock.calls.length - 1
    ][0] as { steps: { title: string }[] }
    expect(payload.steps.map((s) => s.title)).toEqual(['Paso 1'])
  })

  it('should save without steps when every step row is empty', async () => {
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    titleInput.value = 'Task'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    const addStepBtn = document.body.querySelector(
      "[data-testid='add-step-button']"
    ) as HTMLButtonElement
    addStepBtn.click()
    addStepBtn.click()
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    expect(tasksMock.createTaskWithEvent).toHaveBeenCalled()
    const payload = tasksMock.createTaskWithEvent.mock.calls[
      tasksMock.createTaskWithEvent.mock.calls.length - 1
    ][0] as { steps: unknown[] }
    expect(payload.steps).toEqual([])
  })

  it('should keep loaded steps and drop an empty row when editing', async () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        steps: [{ id: 'step-1', title: 'Paso 1', done: false }],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()
    const addStepBtn = document.body.querySelector(
      "[data-testid='add-step-button']"
    ) as HTMLButtonElement
    addStepBtn.click()
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    expect(tasksMock.updateTaskWithEvent).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        steps: [{ id: 'step-1', title: 'Paso 1', done: false }],
      }),
      expect.anything()
    )
  })

  it('should call tasks.createTask on submit when creating', async () => {
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    titleInput.value = 'New Task'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    expect(tasksMock.createTaskWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Task',
      }),
      expect.anything()
    )
  })

  it('should call tasks.updateTask on submit when editing', async () => {
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Old Title',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        steps: [],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()

    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    titleInput.value = 'New Title'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    expect(tasksMock.updateTaskWithEvent).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'New Title',
      }),
      expect.anything()
    )
  })

  it('should close modal on cancel button click', async () => {
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const cancelBtn = buttons.find((btn) =>
      btn.textContent?.includes('Cancelar')
    ) as HTMLButtonElement
    cancelBtn.click()
    await flushPromises()
    expect(uiState.createTaskOpen.value).toBe(false)
  })

  it('should show error when title is empty on submit', async () => {
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    titleInput.value = ''
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await flushPromises()

    const modal = document.body.querySelector("[role='dialog']")
    expect(modal?.textContent).toContain('El título no puede estar vacío')
  })

  it('no usa colores de paleta cruda de Tailwind', async () => {
    await flushPromises()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })

  function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    el.value = value
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }

  function submit() {
    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true }))
  }

  it('ofrece un selector de Bloque con vista previa de color', async () => {
    weeklyBlocks.value = [{ id: 'block-1', title: 'Física', color: 'green' }]
    uiMock.openCreateTask()
    await flushPromises()

    const select = document.body.querySelector(
      "[data-testid='task-block-select']"
    ) as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.textContent).toContain('Física')
    expect(document.body.querySelector("[data-testid='task-color-preview']")).not.toBeNull()
  })

  it('guarda el Bloque elegido', async () => {
    weeklyBlocks.value = [{ id: 'block-1', title: 'Física', color: 'green' }]
    uiMock.openCreateTask()
    await flushPromises()

    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const select = document.body.querySelector(
      "[data-testid='task-block-select']"
    ) as HTMLSelectElement
    setValue(select, 'block-1')
    await flushPromises()
    submit()
    await flushPromises()

    const payload = tasksMock.createTaskWithEvent.mock.calls[
      tasksMock.createTaskWithEvent.mock.calls.length - 1
    ]![0] as { block_id: string }
    expect(payload.block_id).toBe('block-1')
  })

  it('reabrir una tarea muestra su Bloque', async () => {
    weeklyBlocks.value = [{ id: 'block-1', title: 'Física', color: 'green' }]
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: 'block-1',
        event_link: null,
        steps: [],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()

    const select = document.body.querySelector(
      "[data-testid='task-block-select']"
    ) as HTMLSelectElement
    expect(select.value).toBe('block-1')
  })

  it('el apartado de evento queda deshabilitado sin fecha', async () => {
    uiMock.openCreateTask()
    await flushPromises()

    expect(document.body.querySelector("[data-testid='task-event-disabled-hint']")).not.toBeNull()
    const local = document.body.querySelector(
      "[data-testid='task-event-mode-local']"
    ) as HTMLButtonElement
    expect(local.disabled).toBe(true)
  })

  it('con fecha y sin Google, «Evento nuevo» queda deshabilitada con hint', async () => {
    calendarConnected.value = false
    uiMock.openCreateTask()
    await flushPromises()

    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()

    const newButton = document.body.querySelector(
      "[data-testid='task-event-mode-new']"
    ) as HTMLButtonElement
    expect(newButton.disabled).toBe(true)
    expect(document.body.querySelector("[data-testid='task-event-new-hint']")).not.toBeNull()
  })

  it('por defecto no crea evento: el store recibe mode none', async () => {
    uiMock.openCreateTask()
    await flushPromises()
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    submit()
    await flushPromises()

    expect(
      tasksMock.createTaskWithEvent.mock.calls[
        tasksMock.createTaskWithEvent.mock.calls.length - 1
      ]![1]
    ).toEqual({ mode: 'none' })
  })

  it('solo local envía la elección local', async () => {
    uiMock.openCreateTask()
    await flushPromises()
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='task-event-mode-local']") as HTMLButtonElement
    ).click()
    await flushPromises()
    submit()
    await flushPromises()

    expect(
      tasksMock.createTaskWithEvent.mock.calls[
        tasksMock.createTaskWithEvent.mock.calls.length - 1
      ]![1]
    ).toEqual({ mode: 'local' })
  })

  it('evento nuevo usa el calendario principal por defecto', async () => {
    calendarConnected.value = true
    calendarCalendars.value = [
      { id: 'primary', summary: 'Principal', primary: true },
      { id: 'work', summary: 'Trabajo' },
    ]
    uiMock.openCreateTask()
    await flushPromises()
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='task-event-mode-new']") as HTMLButtonElement
    ).click()
    await flushPromises()

    const calSelect = document.body.querySelector(
      "[data-testid='task-event-calendar-select']"
    ) as HTMLSelectElement
    expect(calSelect.value).toBe('primary')
    submit()
    await flushPromises()

    expect(
      tasksMock.createTaskWithEvent.mock.calls[
        tasksMock.createTaskWithEvent.mock.calls.length - 1
      ]![1]
    ).toEqual({
      mode: 'new',
      calendarId: 'primary',
    })
  })

  it('elegir un evento del día lista los eventos de esa fecha y envía el vínculo', async () => {
    calendarEvents.value = [
      { id: 'evt-1', calendarId: 'local', date: '2026-07-01', title: 'Consulta' },
      { id: 'evt-2', calendarId: 'local', date: '2026-07-02', title: 'Otro' },
    ]
    uiMock.openCreateTask()
    await flushPromises()
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='task-event-mode-existing']") as HTMLButtonElement
    ).click()
    await flushPromises()

    const eventSelect = document.body.querySelector(
      "[data-testid='task-event-select']"
    ) as HTMLSelectElement
    const keys = Array.from(eventSelect.options).map((o) => o.value)
    expect(keys).toContain('local\u0000evt-1')
    expect(keys).not.toContain('local\u0000evt-2')

    setValue(eventSelect, 'local\u0000evt-1')
    await flushPromises()
    submit()
    await flushPromises()

    expect(
      tasksMock.createTaskWithEvent.mock.calls[
        tasksMock.createTaskWithEvent.mock.calls.length - 1
      ]![1]
    ).toEqual({
      mode: 'existing',
      link: { calendarId: 'local', eventId: 'evt-1' },
    })
  })

  it('un vínculo que ya no existe se muestra como «Evento no disponible»', async () => {
    calendarEvents.value = []
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: '2026-07-01',
        block_id: null,
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
        steps: [],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()

    const eventSelect = document.body.querySelector(
      "[data-testid='task-event-select']"
    ) as HTMLSelectElement
    const labels = Array.from(eventSelect.options).map((o) => o.textContent)
    expect(labels).toContain('Evento no disponible')
  })

  it('muestra el error de calendario devuelto por el store', async () => {
    tasksMock.createTaskWithEvent.mockResolvedValue({
      task: { id: 'created-task' },
      eventError: 'No se pudo crear el evento',
    })
    uiMock.openCreateTask()
    await flushPromises()
    const titleInput = document.body.querySelector("input[type='text']") as HTMLInputElement
    setValue(titleInput, 'Task')
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='task-event-mode-local']") as HTMLButtonElement
    ).click()
    await flushPromises()
    submit()
    await flushPromises()

    const error = document.body.querySelector("[data-testid='task-calendar-error']")
    expect(error?.textContent).toContain('No se pudo crear el evento')
  })

  it('el selector de calendario incluye el calendario local', async () => {
    calendarConnected.value = true
    calendarCalendars.value = [{ id: 'primary', summary: 'Principal', primary: true }]
    uiMock.openCreateTask()
    await flushPromises()
    const dateInput = document.body.querySelector("input[type='date']") as HTMLInputElement
    setValue(dateInput, '2026-07-01')
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='task-event-mode-new']") as HTMLButtonElement
    ).click()
    await flushPromises()

    const calSelect = document.body.querySelector(
      "[data-testid='task-event-calendar-select']"
    ) as HTMLSelectElement
    const values = Array.from(calSelect.options).map((o) => o.value)
    expect(values).toContain('local')
    expect(values).toContain('primary')
  })

  it('un vínculo huérfano se puede limpiar y guarda sin evento (mode none)', async () => {
    calendarEvents.value = []
    tasksState.value = [
      {
        id: 'task-1',
        title: 'Task',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: '2026-07-01',
        block_id: null,
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
        steps: [],
      },
    ]
    uiMock.openEditTask('task-1')
    await flushPromises()

    const eventSelect = document.body.querySelector(
      "[data-testid='task-event-select']"
    ) as HTMLSelectElement
    expect(eventSelect.value).toBe('local\u0000evt-ausente')
    setValue(eventSelect, '')
    await flushPromises()
    submit()
    await flushPromises()

    expect(tasksMock.updateTaskWithEvent).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ title: 'Task' }),
      { mode: 'none' }
    )
  })
})
