import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import TodayView from './TodayView.vue'
import NewHabitCard from '@/components/habits/NewHabitCard.vue'
import { useHabitsStore } from '@/stores/habits'

vi.mock('@/stores/habits', async () => {
  const { reactive } = await import('vue')
  const store = reactive({
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
    logsByHabit: new Map([['h1', []]]),
    completedToday: new Map(),
    isCompletedToday: vi.fn(() => false),
    incrementCheckIn: vi.fn(),
    decrementCheckIn: vi.fn(),
    getTodayDate: () => '2026-01-01',
    streakFor: vi.fn(() => 0),
  })
  return { useHabitsStore: () => store }
})

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    openCreate: vi.fn(),
    menuOpenForHabitId: null,
    toggleMenu: vi.fn(),
  }),
}))

describe('TodayView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('usa HabitCard', () => {
    const wrapper = mount(TodayView)
    expect(wrapper.findComponent({ name: 'HabitCard' }).exists()).toBe(true)
  })

  it("usa EntityListing con título 'Hábitos'", () => {
    const wrapper = mount(TodayView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    expect(listing.exists()).toBe(true)
    expect(listing.props('title')).toBe('Hábitos')
  })

  it('panel no tiene max-w-2xl ni mx-auto', () => {
    const wrapper = mount(TodayView)
    const panel = wrapper.find("[data-testid='habits-panel']")
    expect(panel.classes()).not.toContain('mx-auto')
    expect(panel.classes()).not.toContain('max-w-2xl')
  })

  it('renderiza NewHabitCard', () => {
    const wrapper = mount(TodayView)
    expect(wrapper.findComponent(NewHabitCard).exists()).toBe(true)
  })

  it('usa HabitSection con variant flat', () => {
    const wrapper = mount(TodayView)
    const section = wrapper.findComponent({ name: 'HabitSection' })
    expect(section.exists()).toBe(true)
    expect(section.props('variant')).toBe('flat')
  })

  it("muestra título 'Hábitos'", () => {
    const wrapper = mount(TodayView)
    expect(wrapper.text()).toContain('Hábitos')
  })

  it('no muestra contador', () => {
    const wrapper = mount(TodayView)
    expect(wrapper.text()).not.toContain('·')
  })

  it('header usa bg-surface-2, eyebrow y card-title (vía EntityListing)', () => {
    const wrapper = mount(TodayView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    const header = listing.find('.bg-surface-2')
    expect(header.exists()).toBe(true)
    expect(header.classes()).toContain('border-b')
    expect(header.classes()).toContain('border-hairline')
    expect(header.find('.text-eyebrow').text()).toBe('Hoy')
    expect(header.find('.text-card-title').exists()).toBe(true)
  })

  it('con showEyebrow=false no muestra el eyebrow pero sí el título', () => {
    const wrapper = mount(TodayView, { props: { showEyebrow: false } })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.text-card-title').text()).toBe('Hábitos')
  })

  it('scroll container tiene overflow-auto, p-2 y scrollbar-gutter-stable', () => {
    const wrapper = mount(TodayView)
    const listing = wrapper.findComponent({ name: 'EntityListing' })
    const scroll = listing.find('.scrollbar-gutter-stable')
    expect(scroll.exists()).toBe(true)
    expect(scroll.classes()).toContain('overflow-auto')
    expect(scroll.classes()).toContain('p-2')
  })

  it('no remonta la tarjeta cuando cambia updated_at del hábito', async () => {
    const wrapper = mount(TodayView)
    const before = wrapper.findComponent({ name: 'HabitCard' }).element

    useHabitsStore().activeHabits[0].updated_at = '2026-02-02T00:00:00.000Z'
    await nextTick()

    const after = wrapper.findComponent({ name: 'HabitCard' }).element
    expect(after).toBe(before)
  })

  it('pasa a HabitCard los logs memoizados del store, sin filtrar en cada render', async () => {
    const wrapper = mount(TodayView)
    const store = useHabitsStore()
    const card = wrapper.findComponent({ name: 'HabitCard' })

    expect(card.props('logs')).toBe(store.logsByHabit.get('h1'))

    store.activeHabits[0].name = 'Meditar 10 min'
    await nextTick()

    expect(card.props('logs')).toBe(store.logsByHabit.get('h1'))
  })
})
