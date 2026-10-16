import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ExamContextMenu from './ExamContextMenu.vue'

const examsState = ref<
  { id: string; event_link: { calendarId: string; eventId: string } | null }[]
>([])
const examsMock = {
  get exams() {
    return examsState.value
  },
  deleteExamWithEvent: vi.fn().mockResolvedValue(undefined),
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

function q(testid: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testid}"]`)
}

describe('ExamContextMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    examsState.value = [{ id: 'exam-1', event_link: null }]
    vi.clearAllMocks()
    wrapper = mount(ExamContextMenu, { props: { examId: 'exam-1' }, attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('ofrece Editar y Eliminar', () => {
    expect(q('exam-edit-button')).not.toBeNull()
    expect(q('exam-delete-button')).not.toBeNull()
  })

  it('Editar abre el modal de edición del examen', async () => {
    ;(q('exam-edit-button') as HTMLButtonElement).click()
    await flushPromises()
    expect(uiMock.openEditExam).toHaveBeenCalledWith('exam-1')
  })

  it('Eliminar pide confirmación antes de borrar', async () => {
    ;(q('exam-delete-button') as HTMLButtonElement).click()
    await flushPromises()
    expect(q('exam-delete-confirm')).not.toBeNull()
    expect(examsMock.deleteExamWithEvent).not.toHaveBeenCalled()
  })

  it('sin vínculo: una sola confirmación borra sólo el examen', async () => {
    ;(q('exam-delete-button') as HTMLButtonElement).click()
    await flushPromises()
    expect(q('exam-delete-exam-only')).toBeNull()
    ;(q('exam-delete-confirm-yes') as HTMLButtonElement).click()
    await flushPromises()
    expect(examsMock.deleteExamWithEvent).toHaveBeenCalledWith('exam-1', false)
    expect(uiMock.closeExamMenu).toHaveBeenCalled()
  })

  it('cancelar la confirmación no borra', async () => {
    ;(q('exam-delete-button') as HTMLButtonElement).click()
    await flushPromises()
    ;(q('exam-delete-confirm-no') as HTMLButtonElement).click()
    await flushPromises()
    expect(examsMock.deleteExamWithEvent).not.toHaveBeenCalled()
    expect(q('exam-delete-confirm')).toBeNull()
  })

  it('con vínculo ofrece las dos salidas', async () => {
    examsState.value = [{ id: 'exam-1', event_link: { calendarId: 'local', eventId: 'evt-1' } }]
    mountAndOpenDelete()
    await flushPromises()
    expect(q('exam-delete-confirm')).not.toBeNull()
    expect(q('exam-delete-exam-only')?.textContent).toContain('Solo la entidad')
    expect(q('exam-delete-exam-and-event')?.textContent).toContain('La entidad y su evento')
  })

  it('"Solo la entidad" borra el examen sin tocar el evento', async () => {
    examsState.value = [{ id: 'exam-1', event_link: { calendarId: 'local', eventId: 'evt-1' } }]
    mountAndOpenDelete()
    await flushPromises()
    ;(q('exam-delete-exam-only') as HTMLButtonElement).click()
    await flushPromises()
    expect(examsMock.deleteExamWithEvent).toHaveBeenCalledWith('exam-1', false)
    expect(uiMock.closeExamMenu).toHaveBeenCalled()
  })

  it('"La entidad y su evento" borra también el evento', async () => {
    examsState.value = [{ id: 'exam-1', event_link: { calendarId: 'local', eventId: 'evt-1' } }]
    mountAndOpenDelete()
    await flushPromises()
    ;(q('exam-delete-exam-and-event') as HTMLButtonElement).click()
    await flushPromises()
    expect(examsMock.deleteExamWithEvent).toHaveBeenCalledWith('exam-1', true)
    expect(uiMock.closeExamMenu).toHaveBeenCalled()
  })

  function mountAndOpenDelete() {
    wrapper.unmount()
    wrapper = mount(ExamContextMenu, { props: { examId: 'exam-1' }, attachTo: document.body })
    ;(
      document.body.querySelector("[data-testid='exam-delete-button']") as HTMLButtonElement
    ).click()
  }
})
