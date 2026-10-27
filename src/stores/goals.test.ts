import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useGoalsStore,
  currentPeriodStart,
  currentProgress,
  currentValue,
  progressPercent,
  isGoalComplete,
} from './goals'
import * as db from '@/lib/db'
import type { Goal, GoalFrequency } from '@/schemas/goals'

vi.mock('@/lib/db', () => ({
  listGoals: vi.fn().mockResolvedValue([]),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
  listGoalLogsInRange: vi.fn().mockResolvedValue([]),
  upsertGoalLog: vi.fn(),
  deleteGoalLog: vi.fn().mockResolvedValue(undefined),
}))

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  const now = new Date().toISOString()
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Test goal',
    description: null,
    color: '#5e6ad2',
    target: 10,
    unit: 'pages',
    direction: 'up',
    frequency: { type: 'daily' },
    sort_order: 0,
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  }
}

describe('goals store - createGoal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should generate id and timestamps, call db.createGoal, and add to state', async () => {
    const store = useGoalsStore()
    const draft = {
      title: 'Test goal',
      color: '#5e6ad2',
      target: 10,
      frequency: { type: 'daily' } as GoalFrequency,
    }
    const mockRow = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Test goal',
      description: null,
      color: '#5e6ad2',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }

    vi.mocked(db.createGoal).mockResolvedValue(mockRow)

    await store.createGoal(draft)

    expect(db.createGoal).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.createGoal).mock.calls[0]
    expect(callArgs[0]).toEqual(draft)
    expect(typeof callArgs[1]).toBe('string')
    expect(typeof callArgs[2]).toBe('string')
    expect(typeof callArgs[3]).toBe('string')

    expect(store.goals).toHaveLength(1)
    expect(store.goals[0].id).toBe('11111111-1111-1111-1111-111111111111')
  })
})

describe('goals store - loadGoals + loadLogsForRange', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should load goals and logs', async () => {
    const store = useGoalsStore()
    const now = new Date().toISOString()
    const mockGoalRow = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Goal 1',
      description: null,
      color: '#5e6ad2',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: now,
      updated_at: now,
      archived_at: null,
    }

    const mockLogRow = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      goal_id: '11111111-1111-1111-1111-111111111111',
      log_date: todayLocalDate(),
      amount: 5,
      note: null,
      created_at: now,
    }

    vi.mocked(db.listGoals).mockResolvedValue([mockGoalRow])
    vi.mocked(db.listGoalLogsInRange).mockResolvedValue([mockLogRow])

    await store.loadGoals()
    await store.loadLogsForRange('2026-01-01', '2026-12-31')

    expect(store.goals).toHaveLength(1)
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].amount).toBe(5)
  })
})

describe('goals store - incrementLog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should upsert log with amount+1 for today', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()
    const now = new Date().toISOString()

    store.logs = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        goal_id: goalId,
        log_date: today,
        amount: 5,
        note: null,
        created_at: now,
      },
    ]

    const mockLogRow = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      goal_id: goalId,
      log_date: today,
      amount: 6,
      note: null,
      created_at: now,
    }

    vi.mocked(db.upsertGoalLog).mockResolvedValue(mockLogRow)

    await store.incrementLog(goalId, 1)

    expect(db.upsertGoalLog).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.upsertGoalLog).mock.calls[0]
    expect(callArgs[0].goal_id).toBe(goalId)
    expect(callArgs[0].log_date).toBe(today)
    expect(callArgs[0].amount).toBe(6)

    expect(store.logs[0].amount).toBe(6)
  })

  it('should create new log with amount=1 if no log exists for today', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()
    const now = new Date().toISOString()

    store.logs = []

    const mockLogRow = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      goal_id: goalId,
      log_date: today,
      amount: 1,
      note: null,
      created_at: now,
    }

    vi.mocked(db.upsertGoalLog).mockResolvedValue(mockLogRow)

    await store.incrementLog(goalId, 1)

    expect(db.upsertGoalLog).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.upsertGoalLog).mock.calls[0]
    expect(callArgs[0].amount).toBe(1)

    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].amount).toBe(1)
  })

  it('serializa clicks rápidos: no pierde montos ni duplica logs', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()

    store.logs = []

    // Simula el upsert real de SQLite: ON CONFLICT(goal_id, log_date) conserva
    // el id de la fila existente y pisa amount con el valor entrante.
    let dbRow: { id: string; amount: number } | null = null
    vi.mocked(db.upsertGoalLog).mockImplementation(async (draft, id, created_at) => {
      await new Promise((r) => setTimeout(r, 5))
      if (dbRow) {
        dbRow = { id: dbRow.id, amount: draft.amount ?? 1 }
      } else {
        dbRow = { id, amount: draft.amount ?? 1 }
      }
      return {
        id: dbRow.id,
        goal_id: draft.goal_id,
        log_date: draft.log_date ?? today,
        amount: dbRow.amount,
        note: null,
        created_at,
      }
    })

    await Promise.all([
      store.incrementLog(goalId, 1),
      store.incrementLog(goalId, 1),
      store.incrementLog(goalId, 1),
    ])

    const sentAmounts = vi.mocked(db.upsertGoalLog).mock.calls.map((c) => c[0].amount)
    expect(sentAmounts).toEqual([1, 2, 3])
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].amount).toBe(3)
    expect(store.logs[0].log_date).toBe(today)
    expect(dbRow).toMatchObject({ amount: 3 })
  })
})

describe('goals store - setLogAmount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should upsert log with absolute amount', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()
    const now = new Date().toISOString()

    store.logs = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        goal_id: goalId,
        log_date: today,
        amount: 5,
        note: null,
        created_at: now,
      },
    ]

    const mockLogRow = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      goal_id: goalId,
      log_date: today,
      amount: 10,
      note: null,
      created_at: now,
    }

    vi.mocked(db.upsertGoalLog).mockResolvedValue(mockLogRow)

    await store.setLogAmount(goalId, 10)

    expect(db.upsertGoalLog).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.upsertGoalLog).mock.calls[0]
    expect(callArgs[0].amount).toBe(10)

    expect(store.logs[0].amount).toBe(10)
  })

  it('should delete log if amount <= 0', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()
    const now = new Date().toISOString()
    const logId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    store.logs = [
      {
        id: logId,
        goal_id: goalId,
        log_date: today,
        amount: 5,
        note: null,
        created_at: now,
      },
    ]

    await store.setLogAmount(goalId, 0)

    expect(db.deleteGoalLog).toHaveBeenCalledWith(logId)
    expect(store.logs).toHaveLength(0)
  })
})

describe('goals store - undoLog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should delete log for given date', async () => {
    const store = useGoalsStore()
    const goalId = '11111111-1111-1111-1111-111111111111'
    const today = todayLocalDate()
    const now = new Date().toISOString()
    const logId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    store.logs = [
      {
        id: logId,
        goal_id: goalId,
        log_date: today,
        amount: 5,
        note: null,
        created_at: now,
      },
    ]

    await store.undoLog(goalId, today)

    expect(db.deleteGoalLog).toHaveBeenCalledWith(logId)
    expect(store.logs).toHaveLength(0)
  })
})

describe('currentPeriodStart', () => {
  it('should return today for daily frequency', () => {
    const today = todayLocalDate()
    const goal = makeGoal({ frequency: { type: 'daily' } })
    expect(currentPeriodStart(goal, today)).toBe(today)
  })

  it('should return Monday for weekly frequency', () => {
    const today = todayLocalDate()
    const monday = getMonday(today)
    const goal = makeGoal({ frequency: { type: 'weekly' } })
    expect(currentPeriodStart(goal, today)).toBe(monday)
  })

  it('should return correct interval start', () => {
    const today = todayLocalDate()
    const createdDate = addDays(today, -10)
    const goal = makeGoal({
      created_at: `${createdDate}T00:00:00.000Z`,
      frequency: { type: 'interval', interval_days: 3 },
    })
    const start = currentPeriodStart(goal, today)
    expect(start).toBeDefined()
    const daysFromCreated = Math.round(
      (new Date(start).getTime() - new Date(createdDate).getTime()) / 86400000
    )
    expect(daysFromCreated % 3).toBe(0)
    const daysUntilToday = Math.round(
      (new Date(today).getTime() - new Date(start).getTime()) / 86400000
    )
    expect(daysUntilToday).toBeGreaterThanOrEqual(0)
    expect(daysUntilToday).toBeLessThan(3)
  })
})

describe('currentProgress', () => {
  it('should sum logs in current period', () => {
    const today = todayLocalDate()
    const goal = makeGoal({ frequency: { type: 'daily' } })
    const logs = [
      {
        id: 'a',
        goal_id: goal.id,
        log_date: today,
        amount: 5,
        note: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'b',
        goal_id: goal.id,
        log_date: addDays(today, -1),
        amount: 3,
        note: null,
        created_at: new Date().toISOString(),
      },
    ]
    expect(currentProgress(goal, logs, today)).toBe(5)
  })

  it('should return 0 if no logs in period', () => {
    const today = todayLocalDate()
    const goal = makeGoal({ frequency: { type: 'daily' } })
    const logs = [
      {
        id: 'a',
        goal_id: goal.id,
        log_date: addDays(today, -1),
        amount: 5,
        note: null,
        created_at: new Date().toISOString(),
      },
    ]
    expect(currentProgress(goal, logs, today)).toBe(0)
  })
})

describe('progressPercent', () => {
  it('should return progress / target', () => {
    const goal = makeGoal({ target: 10 })
    expect(progressPercent(goal, 7)).toBe(0.7)
  })

  it('should cap at 1', () => {
    const goal = makeGoal({ target: 10 })
    expect(progressPercent(goal, 15)).toBe(1)
  })
})

describe('isGoalComplete', () => {
  it('should return true if progress >= target', () => {
    const goal = makeGoal({ target: 10 })
    expect(isGoalComplete(goal, 10)).toBe(true)
    expect(isGoalComplete(goal, 15)).toBe(true)
  })

  it('should return false if progress < target', () => {
    const goal = makeGoal({ target: 10 })
    expect(isGoalComplete(goal, 5)).toBe(false)
  })
})

describe('objetivos de descontar', () => {
  const downGoal = () => makeGoal({ direction: 'down' })

  it('currentValue muestra lo que queda de la meta', () => {
    expect(currentValue(downGoal(), 3)).toBe(7)
    expect(currentValue(downGoal(), 10)).toBe(0)
    expect(currentValue(downGoal(), 15)).toBe(0)
    expect(currentValue(makeGoal({ direction: 'up' }), 3)).toBe(3)
  })

  it('progressPercent mide el avance hacia completar en ambos modos', () => {
    expect(progressPercent(downGoal(), 3)).toBe(0.3)
    expect(progressPercent(downGoal(), 10)).toBe(1)
    expect(progressPercent(downGoal(), 15)).toBe(1)
  })

  it('isGoalComplete al llegar a la meta', () => {
    expect(isGoalComplete(downGoal(), 10)).toBe(true)
    expect(isGoalComplete(downGoal(), 11)).toBe(true)
    expect(isGoalComplete(downGoal(), 9)).toBe(false)
  })

  it('currentProgress suma los montos del período sin importar la dirección', () => {
    const today = todayLocalDate()
    const goal = downGoal()
    const logs = [
      {
        id: 'a',
        goal_id: goal.id,
        log_date: today,
        amount: 3,
        note: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'b',
        goal_id: goal.id,
        log_date: addDays(today, -1),
        amount: 99,
        note: null,
        created_at: new Date().toISOString(),
      },
    ]
    expect(currentProgress(goal, logs, today)).toBe(3)
  })
})
