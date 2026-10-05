import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSampleData } from '@/lib/sampleData'
import { CreateHabitDraftSchema } from '@/schemas/habits'
import { uuid } from '@/schemas/primitives'
import { SEED_MARKER_KEY, seedSampleDataIfFirstRun } from './seedSampleData'

const dbMocks = vi.hoisted(() => ({
  createHabit: vi.fn(),
  listHabits: vi.fn(),
  upsertHabitLog: vi.fn(),
  listLogsInRange: vi.fn(),
  createTask: vi.fn(),
  listTasks: vi.fn(),
  archiveTask: vi.fn(),
  createNote: vi.fn(),
  listNotes: vi.fn(),
  createGoal: vi.fn(),
  listGoals: vi.fn(),
  upsertGoalLog: vi.fn(),
  listGoalLogsInRange: vi.fn(),
  createScheduleBlock: vi.fn(),
  listScheduleBlocks: vi.fn(),
  createScheduleSlot: vi.fn(),
  listScheduleSlots: vi.fn(),
  saveConfig: vi.fn(),
  loadConfig: vi.fn(),
}))

vi.mock('@/lib/db', () => dbMocks)

function resetDefaults(): void {
  dbMocks.loadConfig.mockResolvedValue(null)
  dbMocks.listHabits.mockResolvedValue([])
  dbMocks.listLogsInRange.mockResolvedValue([])
  dbMocks.listTasks.mockResolvedValue([])
  dbMocks.listGoals.mockResolvedValue([])
  dbMocks.listGoalLogsInRange.mockResolvedValue([])
  dbMocks.listNotes.mockResolvedValue([])
  dbMocks.listScheduleBlocks.mockResolvedValue([])
  dbMocks.listScheduleSlots.mockResolvedValue([])
  dbMocks.saveConfig.mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.resetAllMocks()
  resetDefaults()
})

describe('seedSampleDataIfFirstRun — primera ejecución', () => {
  it('siembra todas las entidades, eventos locales y guarda el marcador', async () => {
    const expected = buildSampleData()

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(true)
    expect(dbMocks.createHabit).toHaveBeenCalledTimes(expected.habits.length)
    expect(dbMocks.upsertHabitLog).toHaveBeenCalledTimes(expected.habitLogs.length)
    expect(dbMocks.createTask).toHaveBeenCalledTimes(expected.tasks.length)
    expect(dbMocks.createGoal).toHaveBeenCalledTimes(expected.goals.length)
    expect(dbMocks.upsertGoalLog).toHaveBeenCalledTimes(expected.goalLogs.length)
    expect(dbMocks.createNote).toHaveBeenCalledTimes(expected.notes.length)
    expect(dbMocks.createScheduleBlock).toHaveBeenCalledTimes(expected.scheduleBlocks.length)
    const slotCount = expected.scheduleBlocks.reduce((n, b) => n + b.slots.length, 0)
    expect(dbMocks.createScheduleSlot).toHaveBeenCalledTimes(slotCount)
    expect(dbMocks.archiveTask).toHaveBeenCalledTimes(
      expected.tasks.filter((t) => t.draft.status === 'done').length
    )
    expect(dbMocks.saveConfig).toHaveBeenCalledWith(SEED_MARKER_KEY, expect.any(String))
  })

  it('escribe los eventos en local-calendar-events, todos locales', async () => {
    const expected = buildSampleData()

    await seedSampleDataIfFirstRun()

    const call = dbMocks.saveConfig.mock.calls.find(([key]) => key === 'local-calendar-events')
    expect(call).toBeDefined()
    const events = JSON.parse(call![1] as string)
    expect(events).toHaveLength(expected.calendarEvents.length)
    expect(
      events.every(
        (e: { calendarId: string; id: string }) =>
          e.calendarId === 'local' && e.id.startsWith('local_')
      )
    ).toBe(true)
  })

  it('los hábitos se escriben con draft válido e id UUID', async () => {
    await seedSampleDataIfFirstRun()

    const [draft, id, createdAt, updatedAt] = dbMocks.createHabit.mock.calls[0]
    expect(CreateHabitDraftSchema.safeParse(draft).success).toBe(true)
    expect(uuid.safeParse(id).success).toBe(true)
    expect(typeof createdAt).toBe('string')
    expect(typeof updatedAt).toBe('string')
  })
})

describe('seedSampleDataIfFirstRun — marcador de una sola vez', () => {
  it('con el marcador presente no escribe nada y devuelve false', async () => {
    dbMocks.loadConfig.mockResolvedValue('1')

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(false)
    expect(dbMocks.createHabit).not.toHaveBeenCalled()
    expect(dbMocks.upsertHabitLog).not.toHaveBeenCalled()
    expect(dbMocks.createTask).not.toHaveBeenCalled()
    expect(dbMocks.createGoal).not.toHaveBeenCalled()
    expect(dbMocks.upsertGoalLog).not.toHaveBeenCalled()
    expect(dbMocks.createNote).not.toHaveBeenCalled()
    expect(dbMocks.createScheduleBlock).not.toHaveBeenCalled()
    expect(dbMocks.createScheduleSlot).not.toHaveBeenCalled()
    expect(dbMocks.saveConfig).not.toHaveBeenCalled()
  })

  it('segunda corrida tras "Borrar datos": tablas vacías pero marcador presente, no re-siembra', async () => {
    // Primera corrida: todo vacío → siembra.
    expect(await seedSampleDataIfFirstRun()).toBe(true)

    // "Borrar datos": tablas vacías de nuevo, pero el marcador persiste.
    vi.resetAllMocks()
    resetDefaults()
    dbMocks.loadConfig.mockResolvedValue(SEED_MARKER_KEY)

    expect(await seedSampleDataIfFirstRun()).toBe(false)
    expect(dbMocks.createHabit).not.toHaveBeenCalled()
    expect(dbMocks.createTask).not.toHaveBeenCalled()
    expect(dbMocks.saveConfig).not.toHaveBeenCalled()
  })
})

describe('seedSampleDataIfFirstRun — instalación existente', () => {
  it('con datos en tablas no siembra, solo guarda el marcador', async () => {
    dbMocks.listHabits.mockResolvedValue([{ id: 'existente' }])

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(false)
    expect(dbMocks.createHabit).not.toHaveBeenCalled()
    expect(dbMocks.upsertHabitLog).not.toHaveBeenCalled()
    expect(dbMocks.createNote).not.toHaveBeenCalled()
    expect(dbMocks.createTask).not.toHaveBeenCalled()
    expect(dbMocks.saveConfig).toHaveBeenCalledTimes(1)
    expect(dbMocks.saveConfig).toHaveBeenCalledWith(SEED_MARKER_KEY, expect.any(String))
  })

  it('con eventos locales en config no siembra aunque las tablas estén vacías', async () => {
    dbMocks.loadConfig.mockImplementation(async (key: string) =>
      key === SEED_MARKER_KEY ? null : '[]'
    )

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(false)
    expect(dbMocks.createHabit).not.toHaveBeenCalled()
    expect(dbMocks.createScheduleBlock).not.toHaveBeenCalled()
    expect(dbMocks.saveConfig).toHaveBeenCalledTimes(1)
    expect(dbMocks.saveConfig).toHaveBeenCalledWith(SEED_MARKER_KEY, expect.any(String))
  })
})

describe('seedSampleDataIfFirstRun — resiliencia', () => {
  it('si la siembra falla devuelve false pero el marcador queda guardado', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    dbMocks.createHabit.mockRejectedValue(new Error('boom'))

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(false)
    expect(dbMocks.saveConfig).toHaveBeenCalledWith(SEED_MARKER_KEY, expect.any(String))
    errorSpy.mockRestore()
  })

  it('si guardar el marcador falla, la siembra igual se reporta como hecha', async () => {
    dbMocks.saveConfig.mockImplementation(async (key: string) => {
      if (key === SEED_MARKER_KEY) throw new Error('disco lleno')
    })

    await expect(seedSampleDataIfFirstRun()).resolves.toBe(true)
    expect(dbMocks.createHabit).toHaveBeenCalled()
  })

  it('sin backend (loadConfig rechaza) no escribe nada', async () => {
    dbMocks.loadConfig.mockRejectedValue(new Error('sin backend'))

    const seeded = await seedSampleDataIfFirstRun()

    expect(seeded).toBe(false)
    expect(dbMocks.createHabit).not.toHaveBeenCalled()
    expect(dbMocks.saveConfig).not.toHaveBeenCalled()
  })
})

describe('seedSampleDataIfFirstRun — nunca escribe a Google ni al pomodoro', () => {
  it('solo guarda claves de config permitidas', async () => {
    await seedSampleDataIfFirstRun()

    const keys = dbMocks.saveConfig.mock.calls.map(([key]) => key)
    expect(keys).toContain(SEED_MARKER_KEY)
    expect(keys).toContain('local-calendar-events')
    expect(keys).not.toContain('pomodoro-session')
    expect(keys.every((k) => k === SEED_MARKER_KEY || k === 'local-calendar-events')).toBe(true)
    expect(keys.some((k) => k.includes('google') || k.includes('gcal'))).toBe(false)
  })

  it('nunca hace requests de red', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await seedSampleDataIfFirstRun()

    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
