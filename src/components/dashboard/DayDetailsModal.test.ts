import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import DayDetailsModal from './DayDetailsModal.vue'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import TimePicker from '@/components/ui/TimePicker.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const hiddenCalendarIds = ref(new Set<string>())

const mockStore = {
  connected: ref(true),
  syncing: ref(false),
  syncError: ref<string | null>(null),
  events: ref<any[]>([]),
  calendars: ref<any[]>([]),
  hiddenCalendarIds,
  isCalendarHidden: (calendarId: string): boolean => hiddenCalendarIds.value.has(calendarId),
  createEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}

const reactiveMockStore = reactive(mockStore)

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => reactiveMockStore,
}))

type ExamLike = {
  id: string
  title: string
  date: string
  status: string
  fallback_color: string
  event_link?: { calendarId: string; eventId: string } | null
}

type TaskLike = {
  id: string
  title: string
  color: string
  status: 'todo' | 'doing' | 'done'
  due_date: string | null
  event_link?: { calendarId: string; eventId: string } | null
  archived_at?: string | null
}

const examsState = ref<ExamLike[]>([])

const examsMock = {
  get exams() {
    return examsState.value
  },
  colorFor: vi.fn().mockReturnValue('lavender'),
  blockFor: vi.fn().mockReturnValue(undefined),
}

const tasksState = ref<TaskLike[]>([])

const tasksMock = {
  get tasks() {
    return tasksState.value
  },
  colorFor: vi.fn((task: TaskLike) => task.color),
  blockFor: vi.fn().mockReturnValue(undefined),
}

const uiMock = {
  openEditExam: vi.fn(),
}

vi.mock('@/stores/exams', () => ({
  useExamsStore: () => examsMock,
}))
vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => tasksMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function makeExam(id: string, title: string, date: string, overrides: Partial<ExamLike> = {}) {
  return {
    id,
    title,
    date,
    status: 'pendiente',
    fallback_color: 'lavender',
    event_link: null,
    ...overrides,
  }
}

function makeTask(id: string, title: string, overrides: Partial<TaskLike> = {}) {
  return {
    id,
    title,
    color: '#5e6ad2',
    status: 'todo' as const,
    due_date: null,
    event_link: null,
    archived_at: null,
    ...overrides,
  }
}

function sectionIds(): (string | null)[] {
  return Array.from(document.body.querySelectorAll('[data-testid^="day-section-"]')).map((el) =>
    el.getAttribute('data-testid')
  )
}

describe('DayDetailsModal', () => {
  let wrapper: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockStore.events.value = [
      {
        id: 'evt1',
        date: '2026-07-22',
        title: 'Evento Test 1',
        description: 'Descripción Test 1',
        color: '#7986cb',
        calendarId: 'primary',
        start: '2026-07-22T10:00:00-03:00',
        end: '2026-07-22T11:00:00-03:00',
      },
    ]

    mockStore.calendars.value = [
      { id: 'primary', summary: 'Principal', primary: true, backgroundColor: '#7986cb' },
      { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
    ]

    mockStore.syncError.value = null
    hiddenCalendarIds.value = new Set<string>()
    examsState.value = []
    tasksState.value = []
    examsMock.colorFor.mockReturnValue('lavender')
    examsMock.blockFor.mockReturnValue(undefined)
    tasksMock.colorFor.mockImplementation((task: TaskLike) => task.color)
    tasksMock.blockFor.mockReturnValue(undefined)
    uiMock.openEditExam.mockReset()
    mockStore.createEvent.mockReset().mockResolvedValue(undefined)
    mockStore.updateEvent.mockReset().mockResolvedValue(undefined)
    mockStore.deleteEvent.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    document.body.innerHTML = ''
  })

  const factory = (props = {}) => {
    wrapper = mount(DayDetailsModal, {
      props: {
        open: true,
        date: '2026-07-22',
        ...props,
      },
      attachTo: document.body,
    })
    return wrapper
  }

  it('renders when open and displays title date', () => {
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog).not.toBeNull()
    expect(dialog!.textContent!.toLowerCase()).toContain('22 de julio')
  })

  it('renders the list of events for the day', () => {
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('Evento Test 1')
    expect(dialog!.textContent).toContain('Descripción Test 1')
  })

  it('renders empty state message when no events on that day', () => {
    mockStore.events.value = []
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('No hay eventos')
  })

  it("toggles to create form when clicking 'Agregar Evento'", async () => {
    factory()
    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    expect(btn).not.toBeNull()
    await btn.click()

    expect(document.body.querySelector("[data-testid='event-title-input'] input")).not.toBeNull()
    expect(document.body.querySelector("[data-testid='calendar-select']")).not.toBeNull()
  })

  it('submits the create event form successfully', async () => {
    factory()

    // Toggle form
    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    await btn.click()
    await wrapper.vm.$nextTick()

    // Fill values
    const titleInput = document.body.querySelector(
      "[data-testid='event-title-input'] input"
    ) as HTMLInputElement
    const descInput = document.body.querySelector(
      "[data-testid='event-desc-input'] textarea"
    ) as HTMLTextAreaElement
    const calSelect = document.body.querySelector(
      "[data-testid='calendar-select']"
    ) as HTMLSelectElement

    await new DOMWrapper(titleInput).setValue('Nuevo Evento Creado')
    await new DOMWrapper(descInput).setValue('Desc Creada')
    await new DOMWrapper(calSelect).setValue('primary')

    const pickers = wrapper.findAllComponents(TimePicker)
    await pickers[0].vm.$emit('update:modelValue', '10:00')
    await pickers[1].vm.$emit('update:modelValue', '11:30')

    await wrapper.vm.$nextTick()

    // Save
    const saveBtn = document.body.querySelector("[data-testid='save-event-btn']") as HTMLElement
    await saveBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.createEvent).toHaveBeenCalledWith(
      'primary',
      expect.objectContaining({
        title: 'Nuevo Evento Creado',
        description: 'Desc Creada',
        colorId: undefined, // default
      })
    )
  })

  it('shows edit form with prepopulated values, updates, and deletes', async () => {
    factory()

    // Click edit on the event
    const editBtn = document.body.querySelector("[data-testid='edit-event-btn']") as HTMLElement
    await editBtn.click()
    await wrapper.vm.$nextTick()

    // Check values
    const titleInput = document.body.querySelector(
      "[data-testid='event-title-input'] input"
    ) as HTMLInputElement
    expect(titleInput.value).toBe('Evento Test 1')

    // Modify and update
    await new DOMWrapper(titleInput).setValue('Evento Modificado')
    await wrapper.vm.$nextTick()

    const saveBtn = document.body.querySelector("[data-testid='save-event-btn']") as HTMLElement
    await saveBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.updateEvent).toHaveBeenCalledWith(
      'primary',
      'evt1',
      expect.objectContaining({
        title: 'Evento Modificado',
      })
    )

    // Re-open and delete
    await editBtn.click()
    await wrapper.vm.$nextTick()

    const deleteBtn = document.body.querySelector("[data-testid='delete-event-btn']") as HTMLElement
    await deleteBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.deleteEvent).toHaveBeenCalledWith('primary', 'evt1')
  })

  it('el dropdown de destino incluye calendarios ocultos y el primario sigue por defecto', async () => {
    hiddenCalendarIds.value = new Set(['primary', 'work'])
    factory()

    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    await btn.click()
    await wrapper.vm.$nextTick()

    const calSelect = document.body.querySelector(
      "[data-testid='calendar-select']"
    ) as HTMLSelectElement
    const options = Array.from(calSelect.options).map((o) => o.value)
    expect(options).toContain('primary')
    expect(options).toContain('work')
    // El primario sigue siendo el destino por defecto aunque esté oculto
    expect(calSelect.value).toBe('primary')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    factory()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })

  it('el aviso de permisos usa el acento rojo, no la paleta cruda', () => {
    mockStore.syncError.value = 'Error 403: permission denied'
    factory()

    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('Permisos requeridos')
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })

  describe('agenda del día por secciones', () => {
    it('muestra las tres secciones en orden y oculta las vacías', () => {
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      tasksState.value = [makeTask('task-1', 'Entregar informe', { due_date: '2026-07-22' })]
      // mockStore.events ya trae un evento suelto el 2026-07-22

      factory()

      expect(sectionIds()).toEqual(['day-section-exams', 'day-section-tasks', 'day-section-others'])
    })

    it('oculta una sección sin contenido', () => {
      tasksState.value = [makeTask('task-1', 'Entregar informe', { due_date: '2026-07-22' })]
      mockStore.events.value = []
      factory()

      expect(sectionIds()).toEqual(['day-section-tasks'])
    })

    it('un examen del día aparece en Exámenes', () => {
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      factory()

      const section = document.body.querySelector("[data-testid='day-section-exams']")
      expect(section).not.toBeNull()
      expect(section!.textContent).toContain('Parcial de Análisis')
    })

    it('un examen con evento aparece en Exámenes y su evento no aparece en Otros', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22', {
          event_link: { calendarId: 'primary', eventId: 'evt1' },
        }),
      ]
      factory()

      const section = document.body.querySelector("[data-testid='day-section-exams']")
      expect(section!.textContent).toContain('Parcial de Análisis')
      expect(document.body.querySelector("[data-testid='day-section-others']")).toBeNull()
      expect(document.body.textContent).not.toContain('Evento Test 1')
    })

    it('una tarea con vencimiento hoy y sin evento aparece en Tareas', () => {
      tasksState.value = [makeTask('task-1', 'Entregar informe', { due_date: '2026-07-22' })]
      mockStore.events.value = []
      factory()

      const section = document.body.querySelector("[data-testid='day-section-tasks']")
      expect(section).not.toBeNull()
      expect(section!.textContent).toContain('Entregar informe')
    })

    it('una tarea con evento aparece el día del evento y no el del vencimiento', () => {
      tasksState.value = [
        makeTask('task-1', 'Entregar informe', {
          due_date: '2026-07-23',
          event_link: { calendarId: 'primary', eventId: 'evt-evento' },
        }),
      ]
      mockStore.events.value = [
        {
          id: 'evt-evento',
          date: '2026-07-22',
          title: 'Entregar informe',
          color: '#7986cb',
          calendarId: 'primary',
          start: '2026-07-22',
          end: '2026-07-23',
        },
      ]

      factory()
      expect(document.body.querySelector("[data-testid='day-task-item']")).not.toBeNull()

      // El día del vencimiento (un día después del evento) no la lista.
      wrapper.unmount()
      factory({ date: '2026-07-23' })
      expect(document.body.querySelector("[data-testid='day-task-item']")).toBeNull()
    })

    it('una tarea hecha aparece tachada aunque esté archivada', () => {
      tasksState.value = [
        makeTask('task-1', 'Entregar informe', {
          due_date: '2026-07-22',
          status: 'done',
          archived_at: '2026-07-22T12:00:00.000Z',
        }),
      ]
      mockStore.events.value = []
      factory()

      const item = document.body.querySelector("[data-testid='day-task-item']")
      expect(item).not.toBeNull()
      expect(item!.querySelector('.line-through')).not.toBeNull()
    })

    it('no muestra una tarea archivada sin completar', () => {
      tasksState.value = [
        makeTask('task-active', 'Tarea activa', { due_date: '2026-07-22' }),
        makeTask('task-archivada', 'Tarea archivada', {
          due_date: '2026-07-22',
          status: 'todo',
          archived_at: '2026-07-22T12:00:00.000Z',
        }),
      ]
      mockStore.events.value = []
      factory()

      const section = document.body.querySelector("[data-testid='day-section-tasks']")
      expect(section).not.toBeNull()
      expect(section!.textContent).toContain('Tarea activa')
      expect(section!.textContent).not.toContain('Tarea archivada')
    })

    it('un evento suelto aparece en Otros', () => {
      factory()

      const section = document.body.querySelector("[data-testid='day-section-others']")
      expect(section).not.toBeNull()
      expect(section!.textContent).toContain('Evento Test 1')
    })

    it('no repite un evento que representa a una entidad', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22', {
          event_link: { calendarId: 'primary', eventId: 'evt1' },
        }),
      ]
      mockStore.events.value = [
        {
          id: 'evt1',
          date: '2026-07-22',
          title: 'Evento Test 1',
          color: '#7986cb',
          calendarId: 'primary',
          start: '2026-07-22T10:00:00-03:00',
          end: '2026-07-22T11:00:00-03:00',
        },
        {
          id: 'evt-suelto',
          date: '2026-07-22',
          title: 'Evento Suelto',
          color: '#33b679',
          calendarId: 'primary',
          start: '2026-07-22T12:00:00-03:00',
          end: '2026-07-22T13:00:00-03:00',
        },
      ]
      factory()

      const body = document.body.textContent ?? ''
      expect(body.split('Evento Suelto')).toHaveLength(2) // aparece una sola vez
      expect(body).not.toContain('Evento Test 1') // representa al examen: no se repite
      expect((document.body.textContent ?? '').split('Parcial de Análisis')).toHaveLength(2)
    })

    it('las filas de entidad muestran sólo el título y su color, sin adornos', () => {
      examsMock.colorFor.mockReturnValue('green')
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      tasksMock.colorFor.mockReturnValue('rgb(var(--color-block-blue))')
      tasksState.value = [makeTask('task-1', 'Entregar informe', { due_date: '2026-07-22' })]
      mockStore.events.value = []
      factory()

      const examItem = document.body.querySelector("[data-testid='day-exam-item']") as HTMLElement
      expect(examItem.textContent!.trim()).toBe('Parcial de Análisis')
      const examDot = examItem.querySelector("[data-testid='day-exam-dot']") as HTMLElement
      expect(examDot.getAttribute('style')).toContain('rgb(var(--color-block-green))')

      const taskItem = document.body.querySelector("[data-testid='day-task-item']") as HTMLElement
      expect(taskItem.textContent!.trim()).toBe('Entregar informe')
      const taskDot = taskItem.querySelector("[data-testid='day-task-dot']") as HTMLElement
      expect(taskDot.getAttribute('style')).toContain('rgb(var(--color-block-blue))')
    })
  })

  describe('exámenes en el detalle del día', () => {
    it('lista sólo los exámenes de la fecha mostrada', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22'),
        makeExam('exam-2', 'Final de Física', '2026-07-23'),
      ]
      factory()

      const dialog = document.body.querySelector("[role='dialog']")
      expect(dialog!.textContent).toContain('Parcial de Análisis')
      expect(dialog!.textContent).not.toContain('Final de Física')
    })

    it('abre el examen al clickearlo sin editarlo como evento del calendario', async () => {
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      factory()

      const item = document.body.querySelector("[data-testid='day-exam-item']") as HTMLElement
      expect(item).not.toBeNull()
      await item.click()
      await wrapper.vm.$nextTick()

      expect(uiMock.openEditExam).toHaveBeenCalledWith('exam-1')
      // El examen no entra en el CRUD del calendario: no se toca ningún evento.
      expect(mockStore.updateEvent).not.toHaveBeenCalled()
      expect(mockStore.deleteEvent).not.toHaveBeenCalled()
    })

    it('el punto del examen usa el color resuelto como variable CSS', () => {
      examsMock.colorFor.mockReturnValue('green')
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      factory()

      const dot = document.body.querySelector("[data-testid='day-exam-dot']")
      expect(dot).not.toBeNull()
      expect((dot as HTMLElement).getAttribute('style')).toContain('rgb(var(--color-block-green))')
      expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
    })

    it('no muestra la sección si no hay exámenes ese día', () => {
      examsState.value = []
      factory()
      expect(document.body.querySelector("[data-testid='day-section-exams']")).toBeNull()
    })

    it('muestra el examen si su vínculo es huérfano (evento ausente)', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22', {
          event_link: { calendarId: 'primary', eventId: 'evt-ausente' },
        }),
      ]
      factory()
      expect(document.body.querySelector("[data-testid='day-exam-item']")).not.toBeNull()
    })

    it('muestra el examen si su evento vinculado es de otro día', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22', {
          event_link: { calendarId: 'primary', eventId: 'evt-otro-dia' },
        }),
      ]
      mockStore.events.value = [
        {
          id: 'evt-otro-dia',
          date: '2026-07-23',
          title: 'Evento de otro día',
          color: '#7986cb',
          calendarId: 'primary',
          start: '2026-07-23T10:00:00-03:00',
          end: '2026-07-23T11:00:00-03:00',
        },
      ]
      factory()
      expect(document.body.querySelector("[data-testid='day-exam-item']")).not.toBeNull()
    })
  })
})
