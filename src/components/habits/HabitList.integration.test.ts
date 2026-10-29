import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useHabitsStore } from '@/stores/habits'
import HabitList from './HabitList.vue'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listHabits: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  upsertHabitLog: vi.fn(),
  deleteLog: vi.fn(),
  listLogsInRange: vi.fn().mockResolvedValue([]),
}))

const d = new Date()
const y = d.getFullYear()
const m = String(d.getMonth() + 1).padStart(2, '0')
const dayVal = String(d.getDate()).padStart(2, '0')
const today = `${y}-${m}-${dayVal}`

const habitId = '123e4567-e89b-12d3-a456-426614174000'
const initialRow = {
  id: habitId,
  name: 'Meditar',
  description: null,
  icon: 'footprints',
  color: '#5e6ad2',
  frequency_type: 'daily' as const,
  target_per_period: 1,
  interval_days: null,
  days_of_week: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  archived_at: null,
}

describe('HabitList - integración edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('tras updateHabit, la UI muestra el nombre y color nuevos', async () => {
    vi.mocked(db.listHabits).mockResolvedValue([initialRow])
    const habits = useHabitsStore()
    await habits.loadHabits()
    await flushPromises()

    const w = mount(HabitList, {
      props: { habits: habits.activeHabits },
    })
    await flushPromises()
    expect(w.text()).toContain('Meditar')

    vi.mocked(db.updateHabit).mockResolvedValue({
      ...initialRow,
      name: 'Nuevo',
      color: '#eb5757',
      icon: 'dumbbell',
      updated_at: '2026-07-05T00:00:00.000Z',
    })
    await habits.updateHabit(habitId, {
      name: 'Nuevo',
      color: '#eb5757',
      icon: 'dumbbell',
    })
    await flushPromises()
    await w.setProps({ habits: habits.activeHabits })
    await flushPromises()

    expect(w.text()).toContain('Nuevo')
    expect(w.text()).not.toContain('Meditar')
  })

  it('la fila se tinta con un color visible al marcar check-in (alpha >= 0.20)', async () => {
    vi.mocked(db.listHabits).mockResolvedValue([initialRow])
    vi.mocked(db.upsertHabitLog).mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174999',
      habit_id: habitId,
      log_date: today,
      completed_at: new Date().toISOString(),
      note: null,
      count: 1,
      created_at: new Date().toISOString(),
    })
    const habits = useHabitsStore()
    await habits.loadHabits()
    await flushPromises()
    const w = mount(HabitList, {
      props: { habits: habits.activeHabits },
      attachTo: document.body,
    })
    await flushPromises()

    await habits.incrementCheckIn(habitId)
    await flushPromises()
    await w.vm.$nextTick()
    await flushPromises()

    const row = w.find("[data-testid='habit-row']")
    const styleAttr = (row.element as HTMLElement).getAttribute('style') ?? ''
    expect(styleAttr).toMatch(/background(-color)?:\s*rgba?\(/)
    const alphaMatch = styleAttr.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/)
    expect(alphaMatch).toBeTruthy()
    const alpha = parseFloat(alphaMatch![1])
    expect(alpha).toBeGreaterThanOrEqual(0.2)

    w.unmount()
  })
})
