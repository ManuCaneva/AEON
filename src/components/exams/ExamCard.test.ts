import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExamCard from './ExamCard.vue'
import type { Exam } from '@/schemas/exams'
import { hasRawPaletteColor } from '@/test/colorGuard'

const examsMock = {
  deleteExam: vi.fn().mockResolvedValue(undefined),
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

function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const baseExam: Exam = {
  id: 'exam-1',
  title: 'Parcial 1 de Análisis',
  date: localDate(),
  status: 'pendiente',
  grade: null,
  fallback_color: 'lavender',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('ExamCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uiMock.menuOpenForExamId = null
    vi.clearAllMocks()
  })

  it('renderiza el título del examen', () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(wrapper.text()).toContain('Parcial 1 de Análisis')
  })

  it('un examen de hoy muestra la etiqueta "hoy"', () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(wrapper.find("[data-testid='exam-days']").text()).toBe('hoy')
  })

  it('un examen de mañana muestra la etiqueta "mañana"', () => {
    const exam = { ...baseExam, date: localDate(1) }
    const wrapper = mount(ExamCard, { props: { exam } })
    expect(wrapper.find("[data-testid='exam-days']").text()).toBe('mañana')
  })

  it('un examen futuro muestra "faltan N días"', () => {
    const exam = { ...baseExam, date: localDate(5) }
    const wrapper = mount(ExamCard, { props: { exam } })
    expect(wrapper.find("[data-testid='exam-days']").text()).toBe('faltan 5 días')
  })

  it('pinta el indicador con el token de color de respaldo', () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    const indicator = wrapper.find("[data-testid='exam-color-indicator']")
    expect(indicator.attributes('style')).toContain('rgb(var(--color-block-lavender))')
  })

  it('muestra siempre la etiqueta de estado', () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(wrapper.find("[data-testid='exam-status']").text()).toBe('Pendiente')
  })

  it('traduce cada estado a su etiqueta', () => {
    expect(
      mount(ExamCard, { props: { exam: { ...baseExam, status: 'estudiando' } } })
        .find("[data-testid='exam-status']")
        .text()
    ).toBe('Estudiando')
    expect(
      mount(ExamCard, { props: { exam: { ...baseExam, status: 'rendido' } } })
        .find("[data-testid='exam-status']")
        .text()
    ).toBe('Rendido')
  })

  it('no muestra la etiqueta de nota si el examen no está rendido', () => {
    const wrapper = mount(ExamCard, {
      props: { exam: { ...baseExam, status: 'estudiando', grade: 9 } },
    })
    expect(wrapper.find("[data-testid='exam-grade']").exists()).toBe(false)
  })

  it('no muestra la etiqueta de nota si está rendido pero sin nota', () => {
    const wrapper = mount(ExamCard, {
      props: { exam: { ...baseExam, status: 'rendido', grade: null } },
    })
    expect(wrapper.find("[data-testid='exam-grade']").exists()).toBe(false)
  })

  it('muestra la nota cuando está rendido y hay nota cargada', () => {
    const wrapper = mount(ExamCard, {
      props: { exam: { ...baseExam, status: 'rendido', grade: 8.5 } },
    })
    expect(wrapper.find("[data-testid='exam-grade']").text()).toContain('8.5')
  })

  it('ordena las etiquetas estado → días → nota', () => {
    const wrapper = mount(ExamCard, {
      props: { exam: { ...baseExam, status: 'rendido', grade: 7 } },
    })
    const ids = wrapper
      .find("[data-testid='exam-pills']")
      .findAll('[data-testid]')
      .map((el) => el.attributes('data-testid'))
    expect(ids).toEqual(['exam-status', 'exam-days', 'exam-grade'])
  })

  it('abre el menú de contexto al clickear el botón', async () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    await wrapper.find("[data-testid='exam-menu-button']").trigger('click')
    expect(uiMock.toggleExamMenu).toHaveBeenCalledWith('exam-1')
  })

  it('renderiza ExamContextMenu solo cuando el menú está abierto para este examen', () => {
    uiMock.menuOpenForExamId = 'exam-1'
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(wrapper.findComponent({ name: 'ExamContextMenu' }).exists()).toBe(true)
  })

  it('no renderiza ExamContextMenu si el menú está abierto para otro examen', () => {
    uiMock.menuOpenForExamId = 'exam-2'
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(wrapper.findComponent({ name: 'ExamContextMenu' }).exists()).toBe(false)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(ExamCard, { props: { exam: baseExam } })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
