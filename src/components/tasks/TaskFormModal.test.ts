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
    steps: any[]
  }[]
>([])
const tasksMock = {
  get tasks() {
    return tasksState.value
  },
  createTask: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue({}),
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

describe('TaskFormModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    tasksState.value = []
    uiState.createTaskOpen.value = true
    uiState.editingTaskId.value = null
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

    expect(tasksMock.createTask).toHaveBeenCalled()
    const payload = tasksMock.createTask.mock.calls[
      tasksMock.createTask.mock.calls.length - 1
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

    expect(tasksMock.createTask).toHaveBeenCalled()
    const payload = tasksMock.createTask.mock.calls[
      tasksMock.createTask.mock.calls.length - 1
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

    expect(tasksMock.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        steps: [{ id: 'step-1', title: 'Paso 1', done: false }],
      })
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

    expect(tasksMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Task',
      })
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

    expect(tasksMock.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'New Title',
      })
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
})
