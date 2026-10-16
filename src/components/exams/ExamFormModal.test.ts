import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ExamFormModal from './ExamFormModal.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { eventKey } from '@/lib/examEventLink'

const examsState = ref<
  {
    id: string
    title: string
    date: string
    status: string
    grade: number | null
    block_id: string | null
    fallback_color: string
    event_link?: { calendarId: string; eventId: string } | null
    topics: {
      id: string
      title: string
      completed: boolean
      subtopics?: { id: string; title: string; completed: boolean }[]
    }[]
    sort_order: number
    created_at: string
    updated_at: string
  }[]
>([])
const examsMock = {
  get exams() {
    return examsState.value
  },
  createExamWithEvent: vi.fn().mockResolvedValue({
    exam: { id: 'created-exam' },
    eventError: null,
  }),
  updateExamWithEvent: vi.fn().mockResolvedValue({
    exam: { id: 'edited-exam' },
    eventError: null,
  }),
}
const weeklyBlocks = ref<
  {
    id: string
    title: string
    color: string
    sort_order: number
    created_at: string
    updated_at: string
    slots: unknown[]
  }[]
>([])
const weeklyMock = {
  get blocksWithSlots() {
    return weeklyBlocks.value
  },
  loadAll: vi.fn().mockResolvedValue(undefined),
}
const calendarEvents = ref<
  {
    id: string
    date: string
    title: string
    color: string
    calendarId: string
    start: string
    end: string
  }[]
>([])
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
  createExamOpen: ref(true),
  editingExamId: ref<string | null>(null),
}
const uiMock = {
  get createExamOpen() {
    return uiState.createExamOpen.value
  },
  get editingExamId() {
    return uiState.editingExamId.value
  },
  closeExamModal: () => {
    uiState.createExamOpen.value = false
    uiState.editingExamId.value = null
  },
  openEditExam: (id: string) => {
    uiState.createExamOpen.value = true
    uiState.editingExamId.value = id
  },
}
vi.mock('@/stores/exams', () => ({
  useExamsStore: () => examsMock,
}))
vi.mock('@/stores/weeklySchedule', () => ({
  useWeeklyScheduleStore: () => weeklyMock,
}))
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => calendarMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function fillTitle(value: string) {
  const input = document.body.querySelector("input[type='text']") as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function fillDate(value: string) {
  const input = document.body.querySelector("input[type='date']") as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function gradeInput(): HTMLInputElement {
  return document.body.querySelector("[data-testid='exam-grade-input'] input") as HTMLInputElement
}

function fillGrade(value: string) {
  const input = gradeInput()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function selectStatus(status: string) {
  const button = document.body.querySelector(
    `[data-testid='exam-status-${status}']`
  ) as HTMLButtonElement
  button.click()
}

function submit() {
  const form = document.body.querySelector('form') as HTMLFormElement
  form.dispatchEvent(new Event('submit', { bubbles: true }))
}

function clickAddTopic() {
  ;(document.body.querySelector("[data-testid='add-topic-button']") as HTMLButtonElement).click()
}

function topicInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll("[data-testid='topic-input'] input")
  ) as HTMLInputElement[]
}

function fillTopic(index: number, value: string) {
  const input = topicInputs()[index]
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function removeTopic(index: number) {
  const buttons = document.body.querySelectorAll(
    "[data-testid='remove-topic-button']"
  ) as NodeListOf<HTMLButtonElement>
  buttons[index].click()
}

function clickAddSubtopic(topicIndex: number) {
  const buttons = document.body.querySelectorAll(
    "[data-testid='add-subtopic-button']"
  ) as NodeListOf<HTMLButtonElement>
  buttons[topicIndex].click()
}

function subtopicInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll("[data-testid='subtopic-input'] input")
  ) as HTMLInputElement[]
}

function fillSubtopic(index: number, value: string) {
  const input = subtopicInputs()[index]
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function removeSubtopic(index: number) {
  const buttons = document.body.querySelectorAll(
    "[data-testid='remove-subtopic-button']"
  ) as NodeListOf<HTMLButtonElement>
  buttons[index].click()
}

function topicCheckboxes(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll("[data-testid='topic-checkbox']")
  ) as HTMLInputElement[]
}

function subtopicCheckboxes(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll("[data-testid='subtopic-checkbox']")
  ) as HTMLInputElement[]
}

function clickTopicCheckbox(index: number) {
  topicCheckboxes()[index].click()
}

function clickSubtopicCheckbox(index: number) {
  subtopicCheckboxes()[index].click()
}

function blockSelect(): HTMLSelectElement {
  return document.body.querySelector("[data-testid='exam-block-select']") as HTMLSelectElement
}

function selectBlock(value: string) {
  const select = blockSelect()
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function colorPreview(): HTMLElement {
  return document.body.querySelector("[data-testid='exam-color-preview']") as HTMLElement
}

function clickEventMode(mode: 'none' | 'local' | 'new' | 'existing') {
  ;(
    document.body.querySelector(`[data-testid='exam-event-mode-${mode}']`) as HTMLButtonElement
  ).click()
}

function eventSelect(): HTMLSelectElement {
  return document.body.querySelector("[data-testid='exam-event-select']") as HTMLSelectElement
}

function selectEvent(value: string) {
  const select = eventSelect()
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function calendarSelect(): HTMLSelectElement {
  return document.body.querySelector(
    "[data-testid='exam-event-calendar-select']"
  ) as HTMLSelectElement
}

function makeCalendarEvent(
  id: string,
  date: string,
  title: string,
  calendarId = 'local'
): {
  id: string
  date: string
  title: string
  color: string
  calendarId: string
  start: string
  end: string
} {
  return {
    id,
    date,
    title,
    color: '#6e56cf',
    calendarId,
    start: `${date}T10:00:00`,
    end: `${date}T11:00:00`,
  }
}

function makeBlock(id: string, title: string, color = 'green') {
  return {
    id,
    title,
    color,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    slots: [],
  }
}

describe('ExamFormModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    examsState.value = []
    weeklyBlocks.value = []
    calendarEvents.value = []
    calendarConnected.value = false
    calendarCalendars.value = []
    uiState.createExamOpen.value = true
    uiState.editingExamId.value = null
    vi.clearAllMocks()
    examsMock.createExamWithEvent
      .mockReset()
      .mockResolvedValue({ exam: { id: 'created-exam' }, eventError: null })
    examsMock.updateExamWithEvent
      .mockReset()
      .mockResolvedValue({ exam: { id: 'edited-exam' }, eventError: null })
    wrapper = mount(ExamFormModal, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it("muestra 'Nuevo examen' al crear", () => {
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain('Nuevo examen')
  })

  it("muestra 'Editar examen' al editar", async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial 1',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain('Editar examen')
  })

  it('tiene input de título y de fecha', () => {
    expect(document.body.querySelector("input[type='text']")).not.toBeNull()
    expect(document.body.querySelector("input[type='date']")).not.toBeNull()
  })

  it('al enviar crea el examen con título, fecha y estado por defecto', async () => {
    fillTitle('Parcial 1 de Análisis')
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledWith(
      {
        title: 'Parcial 1 de Análisis',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        topics: [],
      },
      { mode: 'none' }
    )
  })

  it('al editar actualiza el examen', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Viejo',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    fillTitle('Nuevo título')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      {
        title: 'Nuevo título',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        topics: [],
      },
      { mode: 'none' }
    )
  })

  it('rechaza un título vacío sin invocar al store', async () => {
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).not.toHaveBeenCalled()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(
      'El título no puede estar vacío'
    )
  })

  it('rechaza una fecha vacía sin invocar al store', async () => {
    fillTitle('Parcial')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).not.toHaveBeenCalled()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(
      'La fecha es obligatoria'
    )
  })

  it('muestra el selector de estado con las tres opciones', () => {
    expect(
      document.body.querySelector("[data-testid='exam-status-pendiente']")?.textContent
    ).toContain('Pendiente')
    expect(
      document.body.querySelector("[data-testid='exam-status-estudiando']")?.textContent
    ).toContain('Estudiando')
    expect(
      document.body.querySelector("[data-testid='exam-status-rendido']")?.textContent
    ).toContain('Rendido')
  })

  it('deshabilita la nota mientras el estado no sea rendido', async () => {
    expect(gradeInput().disabled).toBe(true)
    selectStatus('rendido')
    await flushPromises()
    expect(gradeInput().disabled).toBe(false)
  })

  it('crea el examen con estado rendido y nota', async () => {
    fillTitle('Final de Física')
    fillDate('2026-12-01')
    selectStatus('rendido')
    await flushPromises()
    fillGrade('8.5')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledWith(
      {
        title: 'Final de Física',
        date: '2026-12-01',
        status: 'rendido',
        grade: 8.5,
        block_id: null,
        topics: [],
      },
      { mode: 'none' }
    )
  })

  it('rechaza una nota fuera del rango 0–10 sin invocar al store', async () => {
    fillTitle('Final')
    fillDate('2026-12-01')
    selectStatus('rendido')
    await flushPromises()
    fillGrade('11')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).not.toHaveBeenCalled()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(
      'La nota debe ser un número entre 0 y 10'
    )
  })

  it('al volver a un estado no rendido limpia la nota (la envía null)', async () => {
    fillTitle('Final')
    fillDate('2026-12-01')
    selectStatus('rendido')
    await flushPromises()
    fillGrade('7')
    await flushPromises()
    selectStatus('pendiente')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledWith(
      {
        title: 'Final',
        date: '2026-12-01',
        status: 'pendiente',
        grade: null,
        block_id: null,
        topics: [],
      },
      { mode: 'none' }
    )
  })

  it('al editar prefilla el estado y la nota', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Final',
        date: '2026-12-01',
        status: 'rendido',
        grade: 7.5,
        block_id: null,
        fallback_color: 'lavender',
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(gradeInput().value).toBe('7.5')
    expect(gradeInput().disabled).toBe(false)
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      {
        title: 'Final',
        date: '2026-12-01',
        status: 'rendido',
        grade: 7.5,
        block_id: null,
        topics: [],
      },
      { mode: 'none' }
    )
  })

  it('no usa colores de paleta cruda de Tailwind', async () => {
    await flushPromises()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })

  it('tiene un botón para agregar temas', () => {
    expect(document.body.querySelector("[data-testid='add-topic-button']")).not.toBeNull()
  })

  it('agrega un tema y lo envía al crear', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Límites')
    await flushPromises()
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { id: string; title: string; completed: boolean }[]
    }
    expect(payload.topics).toHaveLength(1)
    expect(payload.topics[0].title).toBe('Límites')
    expect(payload.topics[0].completed).toBe(false)
    expect(typeof payload.topics[0].id).toBe('string')
  })

  it('quita un tema de la lista', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Límites')
    fillTopic(1, 'Derivadas')
    await flushPromises()
    removeTopic(0)
    await flushPromises()
    expect(topicInputs()).toHaveLength(1)
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { title: string }[]
    }
    expect(payload.topics.map((t) => t.title)).toEqual(['Derivadas'])
  })

  it('descarta una fila de tema vacía y guarda con los temas cargados', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    clickAddTopic()
    clickAddTopic()
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Límites')
    fillTopic(1, 'Derivadas')
    fillTopic(2, 'Integrales')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledTimes(1)
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { title: string }[]
    }
    expect(payload.topics.map((t) => t.title)).toEqual(['Límites', 'Derivadas', 'Integrales'])
  })

  it('guarda sin temas cuando todas las filas de tema están vacías', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    clickAddTopic()
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledTimes(1)
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as { topics: unknown[] }
    expect(payload.topics).toEqual([])
  })

  it('al editar prefilla los temas y los conserva al guardar', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [{ id: 't-1', title: 'Límites', completed: true }],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(topicInputs()[0].value).toBe('Límites')
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [{ id: 't-1', title: 'Límites', completed: true, subtopics: [] }],
      }),
      expect.anything()
    )
  })

  it('un examen sin subtemas se abre y se guarda sin subtemas', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [{ id: 't-1', title: 'Límites', completed: false }],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [{ id: 't-1', title: 'Límites', completed: false, subtopics: [] }],
      }),
      expect.anything()
    )
  })

  it('agrega un subtema a un tema y lo envía al crear', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    await flushPromises()
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Sucesiones')
    await flushPromises()
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { subtopics: { id: string; title: string; completed: boolean }[] }[]
    }
    expect(payload.topics[0].subtopics).toHaveLength(1)
    expect(payload.topics[0].subtopics[0].title).toBe('Sucesiones')
    expect(payload.topics[0].subtopics[0].completed).toBe(false)
    expect(typeof payload.topics[0].subtopics[0].id).toBe('string')
  })

  it('renombra y quita subtemas de un tema', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Uno')
    fillSubtopic(1, 'Dos')
    await flushPromises()
    fillSubtopic(0, 'Uno editado')
    await flushPromises()
    removeSubtopic(1)
    await flushPromises()
    expect(subtopicInputs()).toHaveLength(1)
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { subtopics: { title: string }[] }[]
    }
    expect(payload.topics[0].subtopics.map((s) => s.title)).toEqual(['Uno editado'])
  })

  it('descarta una fila de subtema vacía y guarda con los subtemas cargados', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Sucesiones')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledTimes(1)
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { subtopics: { title: string }[] }[]
    }
    expect(payload.topics[0].subtopics.map((s) => s.title)).toEqual(['Sucesiones'])
  })

  it('al editar prefilla los subtemas y los conserva al guardar', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [
          {
            id: 't-1',
            title: 'Unidad 1',
            completed: false,
            subtopics: [{ id: 's-1', title: 'Sucesiones', completed: true }],
          },
        ],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(subtopicInputs()[0].value).toBe('Sucesiones')
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [
          {
            id: 't-1',
            title: 'Unidad 1',
            completed: false,
            subtopics: [{ id: 's-1', title: 'Sucesiones', completed: true }],
          },
        ],
      }),
      expect.anything()
    )
  })

  it('marcar un tema en el modal marca todos sus subtemas al guardar', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Uno')
    fillSubtopic(1, 'Dos')
    await flushPromises()
    clickTopicCheckbox(0)
    await flushPromises()
    expect(subtopicCheckboxes().map((c) => c.checked)).toEqual([true, true])
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { completed: boolean; subtopics: { completed: boolean }[] }[]
    }
    expect(payload.topics[0].completed).toBe(true)
    expect(payload.topics[0].subtopics.every((s) => s.completed)).toBe(true)
  })

  it('desmarcar un tema en el modal no toca sus subtemas', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Uno')
    fillSubtopic(1, 'Dos')
    await flushPromises()
    clickTopicCheckbox(0)
    await flushPromises()
    clickTopicCheckbox(0)
    await flushPromises()
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { completed: boolean; subtopics: { completed: boolean }[] }[]
    }
    expect(payload.topics[0].completed).toBe(false)
    expect(payload.topics[0].subtopics.map((s) => s.completed)).toEqual([true, true])
  })

  it('marcar los subtemas en el modal no marca el tema', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    fillTopic(0, 'Unidad 1')
    clickAddSubtopic(0)
    clickAddSubtopic(0)
    await flushPromises()
    fillSubtopic(0, 'Uno')
    fillSubtopic(1, 'Dos')
    await flushPromises()
    clickSubtopicCheckbox(0)
    clickSubtopicCheckbox(1)
    await flushPromises()
    submit()
    await flushPromises()
    const payload = examsMock.createExamWithEvent.mock.calls[0][0] as {
      topics: { completed: boolean; subtopics: { completed: boolean }[] }[]
    }
    expect(payload.topics[0].completed).toBe(false)
    expect(payload.topics[0].subtopics.every((s) => s.completed)).toBe(true)
  })

  it('al editar prefilla los checks de tema y subtema', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [
          {
            id: 't-1',
            title: 'Unidad 1',
            completed: true,
            subtopics: [
              { id: 's-1', title: 'Sucesiones', completed: true },
              { id: 's-2', title: 'Límites', completed: false },
            ],
          },
        ],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(topicCheckboxes()[0].checked).toBe(true)
    expect(subtopicCheckboxes().map((c) => c.checked)).toEqual([true, false])
  })

  it('un subtema marcado desde el modal se persiste al guardar', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [
          {
            id: 't-1',
            title: 'Unidad 1',
            completed: false,
            subtopics: [{ id: 's-1', title: 'Sucesiones', completed: false }],
          },
        ],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    clickSubtopicCheckbox(0)
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [
          {
            id: 't-1',
            title: 'Unidad 1',
            completed: false,
            subtopics: [{ id: 's-1', title: 'Sucesiones', completed: true }],
          },
        ],
      }),
      expect.anything()
    )
  })

  it('al editar descarta una fila de tema vacía y conserva los temas cargados', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        topics: [{ id: 't-1', title: 'Límites', completed: true }],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    clickAddTopic()
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [{ id: 't-1', title: 'Límites', completed: true, subtopics: [] }],
      }),
      expect.anything()
    )
  })

  it('el selector de bloques lista los existentes y la opción sin bloque', async () => {
    weeklyBlocks.value = [makeBlock('block-1', 'Física'), makeBlock('block-2', 'Análisis')]
    await flushPromises()
    const options = Array.from(blockSelect().options).map((o) => o.value)
    expect(options[0]).toBe('')
    expect(options).toContain('block-1')
    expect(options).toContain('block-2')
    expect(blockSelect().textContent).toContain('Física')
    expect(blockSelect().textContent).toContain('Sin bloque')
  })

  it('al crear con un bloque envía su id', async () => {
    weeklyBlocks.value = [makeBlock('block-1', 'Física')]
    await flushPromises()
    fillTitle('Parcial de Física')
    fillDate('2026-08-15')
    selectBlock('block-1')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: 'block-1' }),
      expect.anything()
    )
  })

  it('al crear sin bloque envía block_id null', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: null }),
      expect.anything()
    )
  })

  it('al editar prefilla el bloque asociado', async () => {
    weeklyBlocks.value = [makeBlock('block-1', 'Física')]
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: 'block-1',
        fallback_color: 'lavender',
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(blockSelect().value).toBe('block-1')
  })

  it('desasociar el bloque envía null al guardar', async () => {
    weeklyBlocks.value = [makeBlock('block-1', 'Física')]
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: 'block-1',
        fallback_color: 'lavender',
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    selectBlock('')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({ block_id: null }),
      expect.anything()
    )
  })

  it('la vista previa de color deriva del bloque elegido', async () => {
    weeklyBlocks.value = [makeBlock('block-1', 'Física', 'green')]
    await flushPromises()
    selectBlock('block-1')
    await flushPromises()
    expect(colorPreview().getAttribute('style')).toContain('rgb(var(--color-block-green))')
  })

  it('sin bloque la vista previa usa el color de respaldo', async () => {
    await flushPromises()
    expect(colorPreview().getAttribute('style')).toContain('rgb(var(--color-block-lavender))')
  })

  it('el apartado de evento queda deshabilitado hasta elegir fecha', async () => {
    await flushPromises()
    expect(document.body.querySelector("[data-testid='exam-event-disabled-hint']")).not.toBeNull()
    expect(
      (document.body.querySelector("[data-testid='exam-event-mode-local']") as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it('por defecto no crea evento: el store recibe mode none', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent.mock.calls[0][1]).toEqual({ mode: 'none' })
  })

  it('con fecha y sin Google, «Evento nuevo» queda deshabilitada con hint', async () => {
    calendarConnected.value = false
    fillDate('2026-08-15')
    await flushPromises()
    expect(
      (document.body.querySelector("[data-testid='exam-event-mode-new']") as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(document.body.querySelector("[data-testid='exam-event-new-hint']")).not.toBeNull()
  })

  it('solo local envía la elección local', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    clickEventMode('local')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent.mock.calls[0][1]).toEqual({ mode: 'local' })
  })

  it('evento nuevo usa el calendario principal por defecto', async () => {
    calendarConnected.value = true
    calendarCalendars.value = [
      { id: 'primary', summary: 'Principal', primary: true },
      { id: 'work', summary: 'Trabajo' },
    ]
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    clickEventMode('new')
    await flushPromises()
    expect(calendarSelect().value).toBe('primary')
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent.mock.calls[0][1]).toEqual({
      mode: 'new',
      calendarId: 'primary',
    })
  })

  it('elegir un evento del día lista los eventos de esa fecha y envía el vínculo', async () => {
    calendarEvents.value = [
      makeCalendarEvent('evt-1', '2026-08-15', 'Consulta de Análisis'),
      makeCalendarEvent('evt-2', '2026-08-16', 'Otro evento'),
    ]
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    clickEventMode('existing')
    await flushPromises()
    const values = Array.from(eventSelect().options).map((o) => o.value)
    expect(values).toContain(eventKey('local', 'evt-1'))
    expect(values).not.toContain(eventKey('local', 'evt-2'))
    expect(eventSelect().textContent).toContain('Consulta de Análisis')
    selectEvent(eventKey('local', 'evt-1'))
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent.mock.calls[0][1]).toEqual({
      mode: 'existing',
      link: { calendarId: 'local', eventId: 'evt-1' },
    })
  })

  it('al editar prefilla el vínculo vigente y preselecciona la opción de evento del día', async () => {
    calendarEvents.value = [makeCalendarEvent('evt-1', '2026-08-15', 'Consulta')]
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(eventSelect().value).toBe(eventKey('local', 'evt-1'))
  })

  it('un vínculo huérfano se muestra como «Evento no disponible» y se puede limpiar', async () => {
    calendarEvents.value = []
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    expect(eventSelect().value).toBe(eventKey('local', 'evt-ausente'))
    expect(eventSelect().textContent).toContain('Evento no disponible')
    selectEvent('')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({ title: 'Parcial' }),
      { mode: 'none' }
    )
  })

  it('cambiar a «No crear evento» envía mode none al editar un vínculo vigente', async () => {
    calendarEvents.value = [makeCalendarEvent('evt-1', '2026-08-15', 'Consulta')]
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Parcial',
        date: '2026-08-15',
        status: 'pendiente',
        grade: null,
        block_id: null,
        fallback_color: 'lavender',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
        topics: [],
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    uiMock.openEditExam('exam-1')
    await flushPromises()
    clickEventMode('none')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.updateExamWithEvent.mock.calls[0][2]).toEqual({ mode: 'none' })
  })

  it('muestra el error de calendario devuelto por el store', async () => {
    examsMock.createExamWithEvent.mockResolvedValue({
      exam: { id: 'created-exam' },
      eventError: 'No se pudo crear el evento',
    })
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    clickEventMode('local')
    await flushPromises()
    submit()
    await flushPromises()
    const error = document.body.querySelector("[data-testid='exam-calendar-error']")
    expect(error?.textContent).toContain('No se pudo crear el evento')
  })

  it('un reintento tras fallar el evento edita el examen ya guardado en vez de duplicarlo', async () => {
    examsMock.createExamWithEvent.mockResolvedValueOnce({
      exam: { id: 'saved-exam' },
      eventError: 'No se pudo crear el evento',
    })
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    clickEventMode('local')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledTimes(1)

    submit()
    await flushPromises()
    expect(examsMock.createExamWithEvent).toHaveBeenCalledTimes(1)
    expect(examsMock.updateExamWithEvent).toHaveBeenCalledWith(
      'saved-exam',
      expect.objectContaining({ title: 'Parcial' }),
      { mode: 'local' }
    )
  })
})
