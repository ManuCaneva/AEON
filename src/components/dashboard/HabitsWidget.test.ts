import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HabitsWidget from './HabitsWidget.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

vi.mock('@/stores/habits', () => ({
  useHabitsStore: () => ({
    activeHabits: [
      {
        id: 'h1',
        name: 'Meditar',
        description: null,
        icon: null,
        color: '#5e6ad2',
        frequency: { type: 'daily', target_per_period: 1 },
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        archived_at: null,
      },
    ],
    logs: [],
    logsByHabit: new Map(),
    completedToday: new Map(),
    isCompletedToday: vi.fn(() => false),
    incrementCheckIn: vi.fn(),
    decrementCheckIn: vi.fn(),
    getTodayDate: () => '2026-01-01',
    streakFor: vi.fn(() => 0),
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    openCreate: vi.fn(),
    menuOpenForHabitId: null,
    toggleMenu: vi.fn(),
  }),
}))

describe('HabitsWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renderiza TodayView dentro del widget', () => {
    const wrapper = mount(HabitsWidget)
    expect(wrapper.find("[data-testid='habits-panel']").exists()).toBe(true)
  })

  it('no muestra el eyebrow «Hoy»', () => {
    const wrapper = mount(HabitsWidget)
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Hoy')
  })

  it('sigue mostrando el título «Hábitos»', () => {
    const wrapper = mount(HabitsWidget)
    expect(wrapper.find('.text-card-title').text()).toBe('Hábitos')
  })

  it('usa los estilos de superficie del design system', () => {
    const wrapper = mount(HabitsWidget)
    const el = wrapper.find("[data-testid='habits-widget']")
    expect(el.classes()).toContain('glass-soft')
    expect(el.classes()).toContain('border-hairline')
    expect(el.classes()).toContain('rounded-lg')
    expect(el.classes()).toContain('h-full')
  })

  it('tiene container-type inline-size para container queries', () => {
    const wrapper = mount(HabitsWidget)
    const el = wrapper.find("[data-testid='habits-widget']")
    const style = el.attributes('style') ?? ''
    expect(style).toContain('container-type: inline-size')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(HabitsWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
