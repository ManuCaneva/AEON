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
    fallback_color: string
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

describe('ExamFormModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    examsState.value = []
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
        fallback_color: 'lavender',
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
        fallback_color: 'lavender',
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
        fallback_color: 'lavender',
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
    })
  })

  it('no usa colores de paleta cruda de Tailwind', async () => {
    await flushPromises()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })
})
