import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ExamFormModal from './ExamFormModal.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const examsState = ref<
  {
    id: string
    title: string
    date: string
    status: string
    grade: number | null
    block_id: string | null
    fallback_color: string
    topics: { id: string; title: string; completed: boolean }[]
    sort_order: number
    created_at: string
    updated_at: string
  }[]
>([])
const examsMock = {
  get exams() {
    return examsState.value
  },
  createExam: vi.fn().mockResolvedValue({}),
  updateExam: vi.fn().mockResolvedValue({}),
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
    uiState.createExamOpen.value = true
    uiState.editingExamId.value = null
    vi.clearAllMocks()
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
    expect(examsMock.createExam).toHaveBeenCalledWith({
      title: 'Parcial 1 de Análisis',
      date: '2026-08-15',
      status: 'pendiente',
      grade: null,
      block_id: null,
      topics: [],
    })
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
    expect(examsMock.updateExam).toHaveBeenCalledWith('exam-1', {
      title: 'Nuevo título',
      date: '2026-08-15',
      status: 'pendiente',
      grade: null,
      block_id: null,
      topics: [],
    })
  })

  it('rechaza un título vacío sin invocar al store', async () => {
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExam).not.toHaveBeenCalled()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(
      'El título no puede estar vacío'
    )
  })

  it('rechaza una fecha vacía sin invocar al store', async () => {
    fillTitle('Parcial')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExam).not.toHaveBeenCalled()
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
    expect(examsMock.createExam).toHaveBeenCalledWith({
      title: 'Final de Física',
      date: '2026-12-01',
      status: 'rendido',
      grade: 8.5,
      block_id: null,
      topics: [],
    })
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
    expect(examsMock.createExam).not.toHaveBeenCalled()
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
    expect(examsMock.createExam).toHaveBeenCalledWith({
      title: 'Final',
      date: '2026-12-01',
      status: 'pendiente',
      grade: null,
      block_id: null,
      topics: [],
    })
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
    expect(examsMock.updateExam).toHaveBeenCalledWith('exam-1', {
      title: 'Final',
      date: '2026-12-01',
      status: 'rendido',
      grade: 7.5,
      block_id: null,
      topics: [],
    })
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
    const payload = examsMock.createExam.mock.calls[0][0] as {
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
    const payload = examsMock.createExam.mock.calls[0][0] as {
      topics: { title: string }[]
    }
    expect(payload.topics.map((t) => t.title)).toEqual(['Derivadas'])
  })

  it('rechaza un tema sin título sin invocar al store', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    clickAddTopic()
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExam).not.toHaveBeenCalled()
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(
      'Todos los temas deben tener un título'
    )
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
    expect(examsMock.updateExam).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({
        topics: [{ id: 't-1', title: 'Límites', completed: true }],
      })
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
    expect(examsMock.createExam).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: 'block-1' })
    )
  })

  it('al crear sin bloque envía block_id null', async () => {
    fillTitle('Parcial')
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExam).toHaveBeenCalledWith(expect.objectContaining({ block_id: null }))
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
    expect(examsMock.updateExam).toHaveBeenCalledWith(
      'exam-1',
      expect.objectContaining({ block_id: null })
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
})
