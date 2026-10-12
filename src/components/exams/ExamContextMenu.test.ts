import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExamContextMenu from './ExamContextMenu.vue'

const examsMock = {
  deleteExam: vi.fn().mockResolvedValue(undefined),
}
const uiMock = {
  openEditExam: vi.fn(),
  closeExamMenu: vi.fn(),
}
vi.mock('@/stores/exams', () => ({
  useExamsStore: () => examsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

describe('ExamContextMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    wrapper = mount(ExamContextMenu, { props: { examId: 'exam-1' }, attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('ofrece Editar y Eliminar', () => {
    expect(document.body.querySelector("[data-testid='exam-edit-button']")).not.toBeNull()
    expect(document.body.querySelector("[data-testid='exam-delete-button']")).not.toBeNull()
  })

  it('Editar abre el modal de edición del examen', async () => {
    ;(document.body.querySelector("[data-testid='exam-edit-button']") as HTMLButtonElement).click()
    await flushPromises()
    expect(uiMock.openEditExam).toHaveBeenCalledWith('exam-1')
  })

  it('Eliminar pide confirmación antes de borrar', async () => {
    ;(
      document.body.querySelector("[data-testid='exam-delete-button']") as HTMLButtonElement
    ).click()
    await flushPromises()
    expect(document.body.querySelector("[data-testid='exam-delete-confirm']")).not.toBeNull()
    expect(examsMock.deleteExam).not.toHaveBeenCalled()
  })

  it('confirmar elimina el examen y cierra el menú', async () => {
    ;(
      document.body.querySelector("[data-testid='exam-delete-button']") as HTMLButtonElement
    ).click()
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='exam-delete-confirm-yes']") as HTMLButtonElement
    ).click()
    await flushPromises()
    expect(examsMock.deleteExam).toHaveBeenCalledWith('exam-1')
    expect(uiMock.closeExamMenu).toHaveBeenCalled()
  })

  it('cancelar la confirmación no borra', async () => {
    ;(
      document.body.querySelector("[data-testid='exam-delete-button']") as HTMLButtonElement
    ).click()
    await flushPromises()
    ;(
      document.body.querySelector("[data-testid='exam-delete-confirm-no']") as HTMLButtonElement
    ).click()
    await flushPromises()
    expect(examsMock.deleteExam).not.toHaveBeenCalled()
    expect(document.body.querySelector("[data-testid='exam-delete-confirm']")).toBeNull()
  })
})
