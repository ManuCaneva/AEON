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

  it('al enviar crea el examen con título y fecha', async () => {
    fillTitle('Parcial 1 de Análisis')
    fillDate('2026-08-15')
    await flushPromises()
    submit()
    await flushPromises()
    expect(examsMock.createExam).toHaveBeenCalledWith({
      title: 'Parcial 1 de Análisis',
      date: '2026-08-15',
    })
  })

  it('al editar actualiza el examen', async () => {
    examsState.value = [
      {
        id: 'exam-1',
        title: 'Viejo',
        date: '2026-08-15',
        status: 'pendiente',
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

  it('no usa colores de paleta cruda de Tailwind', async () => {
    await flushPromises()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })
})
