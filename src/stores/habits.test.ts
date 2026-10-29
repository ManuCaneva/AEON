import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHabitsStore } from './habits'
import * as db from '@/lib/db'
import type { Habit, HabitLog } from '@/schemas/habits'

vi.mock('@/lib/db', () => ({
  listHabits: vi.fn().mockResolvedValue([]),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  upsertHabitLog: vi.fn(),
  deleteLog: vi.fn(),
  listLogsInRange: vi.fn().mockResolvedValue([]),
}))

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeHabit(id: string, target: number): Habit {
  return {
    id,
    name: 'Test',
    description: null,
    icon: null,
    color: '#5e6ad2',
    frequency: { type: 'daily', target_per_period: target },
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    archived_at: null,
  }
}

function makeLog(id: string, habitId: string, logDate: string, count: number): HabitLog {
  const uuidId = id.startsWith('l')
    ? `00000000-0000-4000-8000-${String(id.slice(1)).padStart(12, '0')}`
    : id
  return {
    id: uuidId,
    habit_id: habitId,
    log_date: logDate,
    completed_at: '2026-07-05T12:00:00.000Z',
    note: null,
    count,
    created_at: '2026-07-05T12:00:00.000Z',
  }
}

describe('habits store - checkIn', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('incrementCheckIn crea un log con count 1 cuando no hay log hoy', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    const mockLog = makeLog('456e4567-e89b-12d3-a456-426614174001', habitId, today, 1)

    vi.mocked(db.upsertHabitLog).mockResolvedValue(mockLog)

    await store.incrementCheckIn(habitId)

    expect(db.upsertHabitLog).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.upsertHabitLog).mock.calls[0]
    const draft = callArgs[0]
    expect(draft).toHaveProperty('habit_id', habitId)
    expect(draft).toHaveProperty('log_date', today)
    expect(draft).toHaveProperty('count', 1)
    expect(typeof callArgs[1]).toBe('string')
    expect(typeof callArgs[2]).toBe('string')
    expect(typeof callArgs[3]).toBe('string')
    expect(store.logs[0].count).toBe(1)
  })

  it('incrementCheckIn acumula de a 1 sin superar el target', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    const logId = '11111111-2222-4333-8444-555555555555'
    store.logs = [makeLog(logId, habitId, today, 1)]
    const mockLog = makeLog(logId, habitId, today, 2)

    vi.mocked(db.upsertHabitLog).mockResolvedValue(mockLog)

    await store.incrementCheckIn(habitId)

    const callArgs = vi.mocked(db.upsertHabitLog).mock.calls[0]
    expect(callArgs[0].count).toBe(2)
    expect(callArgs[1]).toBe(logId)
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].count).toBe(2)
    expect(store.completedToday.get(habitId)).toBe(2)
  })

  it('incrementCheckIn hace clamping al target', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    store.logs = [makeLog('l1', habitId, today, 3)]
    const mockLog = makeLog('l1', habitId, today, 3)

    vi.mocked(db.upsertHabitLog).mockResolvedValue(mockLog)

    await store.incrementCheckIn(habitId)

    expect(vi.mocked(db.upsertHabitLog).mock.calls[0][0].count).toBe(3)
    expect(store.completedToday.get(habitId)).toBe(3)
  })

  it('completedToday expone el progreso por hábito del día', async () => {
    const store = useHabitsStore()
    const h1 = '123e4567-e89b-12d3-a456-426614174000'
    const h2 = '123e4567-e89b-12d3-a456-426614174001'
    const today = todayLocalDate()
    store.logs = [
      makeLog('l1', h1, today, 2),
      makeLog('l2', h2, today, 1),
      makeLog('l3', h1, '2020-01-01', 3),
    ]
    expect(store.completedToday.get(h1)).toBe(2)
    expect(store.completedToday.get(h2)).toBe(1)
    expect(store.completedToday.size).toBe(2)
  })

  it('isCompletedToday es true cuando el progreso es >= 1', () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.logs = [makeLog('l1', habitId, today, 1)]
    expect(store.isCompletedToday(habitId)).toBe(true)
    expect(store.isCompletedToday('sin-log')).toBe(false)
  })

  it('loadInitialData pide rango de 365 días (cubre la grilla de 364)', async () => {
    vi.mocked(db.listLogsInRange).mockResolvedValue([])
    vi.mocked(db.listHabits).mockResolvedValue([])
    const store = useHabitsStore()
    await store.loadInitialData()
    const call = vi.mocked(db.listLogsInRange).mock.calls[0]
    const [fromArg, toArg] = call as [string, string]
    const days =
      Math.round((new Date(toArg).getTime() - new Date(fromArg).getTime()) / 86400000) + 1
    expect(days).toBe(365)
  })

  it('streakFor cuenta días consecutivos', async () => {
    vi.mocked(db.listHabits).mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'X',
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
    const now = new Date().toISOString()
    const today = todayLocalDate()
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    vi.mocked(db.listLogsInRange).mockResolvedValue([
      {
        id: 'aaaaaaa1-1111-1111-1111-111111111111',
        habit_id: '11111111-1111-1111-1111-111111111111',
        log_date: today,
        completed_at: now,
        note: null,
        count: 1,
        created_at: now,
      },
      {
        id: 'bbbbbbb1-1111-1111-1111-111111111111',
        habit_id: '11111111-1111-1111-1111-111111111111',
        log_date: yStr,
        completed_at: y.toISOString(),
        note: null,
        count: 1,
        created_at: y.toISOString(),
      },
    ])
    const store = useHabitsStore()
    await store.loadInitialData()
    expect(store.streakFor('11111111-1111-1111-1111-111111111111')).toBeGreaterThanOrEqual(2)
  })

  it('streakFor cuenta el día como cumplido con progreso parcial', async () => {
    vi.mocked(db.listHabits).mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'X',
        description: null,
        icon: null,
        color: '#5e6ad2',
        frequency_type: 'daily',
        target_per_period: 5,
        interval_days: null,
        days_of_week: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        archived_at: null,
      },
    ])
    const now = new Date().toISOString()
    const today = todayLocalDate()
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    vi.mocked(db.listLogsInRange).mockResolvedValue([
      {
        id: 'aaaaaaa1-1111-1111-1111-111111111111',
        habit_id: '11111111-1111-1111-1111-111111111111',
        log_date: today,
        completed_at: now,
        note: null,
        count: 2,
        created_at: now,
      },
      {
        id: 'bbbbbbb1-1111-1111-1111-111111111111',
        habit_id: '11111111-1111-1111-1111-111111111111',
        log_date: yStr,
        completed_at: y.toISOString(),
        note: null,
        count: 1,
        created_at: y.toISOString(),
      },
    ])
    const store = useHabitsStore()
    await store.loadInitialData()
    expect(store.streakFor('11111111-1111-1111-1111-111111111111')).toBeGreaterThanOrEqual(2)
  })

  it('updateHabit reemplaza el hábito en el store con los valores nuevos', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    vi.mocked(db.listHabits).mockResolvedValueOnce([
      {
        id: habitId,
        name: 'Viejo',
        description: null,
        icon: 'footprints',
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
    await store.loadHabits()

    vi.mocked(db.updateHabit).mockResolvedValueOnce({
      id: habitId,
      name: 'Nuevo',
      description: null,
      icon: 'dumbbell',
      color: '#eb5757',
      frequency_type: 'daily',
      target_per_period: 1,
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-07-05T00:00:00.000Z',
      archived_at: null,
    })

    await store.updateHabit(habitId, {
      name: 'Nuevo',
      color: '#eb5757',
      icon: 'dumbbell',
    })

    expect(store.habits).toHaveLength(1)
    expect(store.habits[0].name).toBe('Nuevo')
    expect(store.habits[0].color).toBe('#eb5757')
    expect(store.habits[0].icon).toBe('dumbbell')
  })

  it('decrementCheckIn resta 1 y actualiza el log', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    store.logs = [makeLog('l1', habitId, today, 3)]
    const mockLog = makeLog('l1', habitId, today, 2)

    vi.mocked(db.upsertHabitLog).mockResolvedValue(mockLog)

    await store.decrementCheckIn(habitId)

    const callArgs = vi.mocked(db.upsertHabitLog).mock.calls[0]
    expect(callArgs[0].count).toBe(2)
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].count).toBe(2)
    expect(store.completedToday.get(habitId)).toBe(2)
  })

  it('decrementCheckIn borra el log al llegar a 0 (uncheck total)', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    const logId = '11111111-2222-4333-8444-555555555555'
    store.logs = [makeLog(logId, habitId, today, 1)]

    vi.mocked(db.deleteLog).mockResolvedValue()

    await store.decrementCheckIn(habitId)

    expect(db.deleteLog).toHaveBeenCalledWith(logId)
    expect(db.upsertHabitLog).not.toHaveBeenCalled()
    expect(store.logs).toHaveLength(0)
    expect(store.completedToday.get(habitId)).toBeUndefined()
    expect(store.isCompletedToday(habitId)).toBe(false)
  })

  it('decrementCheckIn no hace nada sin log hoy', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    store.habits = [makeHabit(habitId, 3)]

    await store.decrementCheckIn(habitId)

    expect(db.upsertHabitLog).not.toHaveBeenCalled()
    expect(db.deleteLog).not.toHaveBeenCalled()
  })

  it('resetCheckIn borra el log del día (reset a 0)', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    const today = todayLocalDate()
    store.habits = [makeHabit(habitId, 3)]
    const logId = '11111111-2222-4333-8444-555555555555'
    store.logs = [makeLog(logId, habitId, today, 3)]

    vi.mocked(db.deleteLog).mockResolvedValue()

    await store.resetCheckIn(habitId)

    expect(db.deleteLog).toHaveBeenCalledWith(logId)
    expect(db.upsertHabitLog).not.toHaveBeenCalled()
    expect(store.logs).toHaveLength(0)
    expect(store.completedToday.get(habitId)).toBeUndefined()
    expect(store.isCompletedToday(habitId)).toBe(false)
  })

  it('resetCheckIn no hace nada sin log hoy', async () => {
    const store = useHabitsStore()
    const habitId = '123e4567-e89b-12d3-a456-426614174000'
    store.habits = [makeHabit(habitId, 3)]

    await store.resetCheckIn(habitId)

    expect(db.deleteLog).not.toHaveBeenCalled()
    expect(db.upsertHabitLog).not.toHaveBeenCalled()
  })

  it('loadInitialData normaliza timestamps y carga todos los logs', async () => {
    const habitId = '11111111-1111-1111-1111-111111111111'
    const now = new Date().toISOString()
    const today = todayLocalDate()
    vi.mocked(db.listHabits).mockResolvedValue([
      {
        id: habitId,
        name: 'Test',
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
        id: 'aaaaaaaa-1111-1111-1111-111111111111',
        habit_id: habitId,
        log_date: today,
        completed_at: now,
        note: null,
        count: 1,
        created_at: now,
      },
      {
        id: 'bbbbbbbb-1111-1111-1111-111111111111',
        habit_id: habitId,
        log_date: today,
        completed_at: '2026-07-05 15:30:45',
        note: null,
        count: 1,
        created_at: '2026-07-05 15:30:45',
      },
    ])
    const store = useHabitsStore()
    await store.loadInitialData()
    expect(store.logs).toHaveLength(2)
    expect(store.logs[1].completed_at).toBe('2026-07-05T15:30:45Z')
    expect(store.lastError).toBeNull()
  })
})
