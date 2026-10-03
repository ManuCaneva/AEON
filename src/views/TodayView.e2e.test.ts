import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useHabitsStore } from '@/stores/habits'
import TodayView from './TodayView.vue'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listHabits: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  archiveHabit: vi.fn(),
  restoreHabit: vi.fn(),
  upsertHabitLog: vi.fn(),
  deleteLog: vi.fn(),
  listLogsInRange: vi.fn(),
}))

vi.mock('@/composables/useHeatmapCols', () => ({
  useHeatmapCols: ({ dataCols }: { dataCols: number }) => ({
    cols: ref(Math.min(20, dataCols)),
    actualCellSize: ref(10),
  }),
}))

const habitId = '123e4567-e89b-12d3-a456-426614174000'

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('TodayView E2E - heatmap refleja logs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('una celda tiene shadeFor al 1 (sólido) cuando hay un log de hoy', async () => {
    const today = todayLocalDate()
    vi.mocked(db.listHabits).mockResolvedValue([
      {
        id: habitId,
        name: 'Meditar',
        description: null,
        icon: null,
        color: '#5e6ad2',
        frequency_type: 'daily',
        target_per_period: 1,
        interval_days: null,
        days_of_week: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        archived_at: null,
      },
    ])
    vi.mocked(db.listLogsInRange).mockResolvedValue([
      {
        id: '123e4567-e89b-12d3-a456-426614174999',
        habit_id: habitId,
        log_date: today,
        completed_at: new Date().toISOString(),
        note: null,
        count: 1,
        created_at: new Date().toISOString(),
      },
    ])

    const store = useHabitsStore()
    await store.loadInitialData()
    await flushPromises()

    expect(store.isCompletedToday(habitId)).toBe(true)
    expect(store.logs.length).toBe(1)

    const w = mount(TodayView, { attachTo: document.body })
    await flushPromises()

    const cells = w.findAll("[data-testid='heat-cell']")
    expect(cells.length).toBeGreaterThan(0)

    const filled = cells.find(
      (el) => (el.element as HTMLElement).style.background === 'rgba(94, 106, 210, 1)'
    )
    expect(filled, 'esperaba una celda sólida con shadeFor(1) en el heatmap').toBeTruthy()

    w.unmount()
  })
})
