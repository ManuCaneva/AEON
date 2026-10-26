import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ExamsListView from './ExamsListView.vue'

const examsState = ref<
  {
    id: string
    title: string
    date: string
    status: string
    block_id: string | null
    fallback_color: string
    event_link?: { calendarId: string; eventId: string } | null
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
  // El store expone el listado ya ordenado; el mock lo devuelve al revés
  // para comprobar que la vista consume ese orden y no el crudo.
  get orderedExams() {
    return [...examsState.value].reverse()
  },
  toggleTopic: vi.fn().mockResolvedValue(undefined),
  blockFor: vi.fn().mockReturnValue(undefined),
  colorFor: vi.fn().mockReturnValue('lavender'),
}
const uiMock = {
  menuOpenForExamId: null as string | null,
  toggleExamMenu: vi.fn(),
  openEditExam: vi.fn(),
  closeExamMenu: vi.fn(),
}
vi.mock('@/stores/exams', () => ({
  useExamsStore: () => examsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function makeExam(id: string, title: string, date = '2026-07-01') {
  return {
    id,
    title,
    date,
    status: 'pendiente',
    block_id: null,
    fallback_color: 'lavender',
    topics: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ExamsListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    examsState.value = []
    uiMock.menuOpenForExamId = null
  })

  it("usa EntityListing con título 'Exámenes'", () => {
    const wrapper = mount(ExamsListView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    expect(listing.props('title')).toBe('Exámenes')
  })

  it('el panel tiene data-testid', () => {
    const wrapper = mount(ExamsListView)
    expect(wrapper.find("[data-testid='exams-panel']").exists()).toBe(true)
  })

  it('con showEyebrow=false no muestra el eyebrow pero sí el título', () => {
    const wrapper = mount(ExamsListView, { props: { showEyebrow: false } })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.text-card-title').text()).toBe('Exámenes')
  })

  it('renderiza ExamCard por cada examen', () => {
    examsState.value = [makeExam('exam-1', 'Parcial 1'), makeExam('exam-2', 'Parcial 2')]
    const wrapper = mount(ExamsListView)
    expect(wrapper.findAllComponents({ name: 'ExamCard' })).toHaveLength(2)
  })

  it('lista en el orden que entrega el store (ya ordenados por el store)', () => {
    examsState.value = [makeExam('exam-1', 'Parcial 1'), makeExam('exam-2', 'Parcial 2')]
    const wrapper = mount(ExamsListView)
    const titles = wrapper.findAllComponents({ name: 'ExamCard' }).map((c) => c.props('exam').title)
    expect(titles).toEqual(['Parcial 2', 'Parcial 1'])
  })

  it('lista un examen con vínculo huérfano sin romper', () => {
    examsState.value = [
      {
        ...makeExam('exam-1', 'Parcial 1'),
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
      },
    ]
    const wrapper = mount(ExamsListView)
    expect(wrapper.text()).toContain('Parcial 1')
    expect(wrapper.findAllComponents({ name: 'ExamCard' })).toHaveLength(1)
  })

  it('muestra el empty state cuando no hay exámenes', () => {
    const wrapper = mount(ExamsListView)
    expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(true)
  })

  it('renderiza NewExamCard en el footer', () => {
    const wrapper = mount(ExamsListView)
    expect(wrapper.findComponent({ name: 'NewExamCard' }).exists()).toBe(true)
  })
})
