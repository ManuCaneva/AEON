import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NewExamCard from './NewExamCard.vue'

const uiMock = {
  openCreateExam: vi.fn(),
}
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

describe('NewExamCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("renderiza con role='button' y es accesible por teclado", () => {
    const wrapper = mount(NewExamCard)
    const card = wrapper.find("[data-testid='new-exam-card']")
    expect(card.attributes('role')).toBe('button')
    expect(card.attributes('tabindex')).toBe('0')
    expect(card.attributes('aria-label')).toBe('Crear nuevo examen')
  })

  it('abre el modal de creación al clickear', async () => {
    const wrapper = mount(NewExamCard)
    await wrapper.find("[data-testid='new-exam-card']").trigger('click')
    expect(uiMock.openCreateExam).toHaveBeenCalled()
  })

  it('abre el modal de creación con Enter', async () => {
    const wrapper = mount(NewExamCard)
    await wrapper.find("[data-testid='new-exam-card']").trigger('keydown', { key: 'Enter' })
    expect(uiMock.openCreateExam).toHaveBeenCalled()
  })
})
