import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  updateHabit,
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  createGoal,
  listGoals,
  updateGoal,
  deleteGoal,
  upsertGoalLog,
  deleteGoalLog,
  listGoalLogsInRange,
  upsertHabitLog,
  loadGcalVisibleCalendars,
  saveGcalVisibleCalendars,
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  clearAllData,
} from './db'
import { DATA_TABLES, DATA_CONFIG_KEYS, PRESERVED_CONFIG_KEYS } from './dataScope'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'

const mockRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
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
  updated_at: '2026-07-05T00:00:00.000Z',
  archived_at: null,
}

const mockTaskRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Task',
  description: null,
  color: '#ff5500',
  status: 'todo',
  due_date: null,
  steps: '[]',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-07-05T00:00:00.000Z',
  archived_at: null,
}

const mockGoalRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Goal',
  description: null,
  color: '#ff5500',
  target: 10,
  unit: null,
  frequency_type: 'daily',
  interval_days: null,
  days_of_week: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-07-05T00:00:00.000Z',
  archived_at: null,
}

const mockGoalLogRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  goal_id: '223e4567-e89b-12d3-a456-426614174000',
  log_date: '2026-07-05',
  amount: 5,
  note: null,
  created_at: '2026-07-05T00:00:00.000Z',
}

describe('db.updateHabit - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockRow)
  })

  it('aplana el patch al shape que espera Rust (no envía { patch: { ... } })', async () => {
    await updateHabit(
      '123e4567-e89b-12d3-a456-426614174000',
      { name: 'Nuevo', color: '#eb5757', icon: 'dumbbell' },
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith(
      'update_habit',
      expect.objectContaining({
        input: expect.objectContaining({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Nuevo',
          color: '#eb5757',
          icon: 'dumbbell',
          updated_at: '2026-07-05T00:00:00.000Z',
        }),
      })
    )
    const call = vi.mocked(invoke).mock.calls[0]
    const input = (call[1] as { input: Record<string, unknown> }).input
    expect(input).not.toHaveProperty('patch')
  })
})

describe('db.createTask - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockTaskRow)
  })

  it('envía input con steps serializado como JSON string', async () => {
    await createTask(
      { title: 'Test', color: '#ff5500', status: 'todo', steps: [] },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('create_task', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        color: '#ff5500',
        status: 'todo',
        steps: '[]',
      }),
    })
  })

  it('rechaza draft inválido sin invocar', async () => {
    await expect(
      createTask(
        { title: '', color: '#ff5500' } as any,
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      )
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('db.listTasks', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue([mockTaskRow])
  })

  it('retorna array de TaskRow parseados', async () => {
    const result = await listTasks()
    expect(invoke).toHaveBeenCalledWith('list_tasks', { includeArchived: false })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test Task')
  })
})

describe('db.updateTask - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockTaskRow)
  })

  it('aplana el patch al shape que espera Rust', async () => {
    await updateTask(
      '123e4567-e89b-12d3-a456-426614174000',
      { title: 'Nuevo', color: '#eb5757' },
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('update_task', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Nuevo',
        color: '#eb5757',
        updated_at: '2026-07-05T00:00:00.000Z',
      }),
    })
  })

  it('omite steps cuando el patch no los incluye (preserva los pasos persistidos)', async () => {
    await updateTask(
      '123e4567-e89b-12d3-a456-426614174000',
      { status: 'done' },
      '2026-07-05T00:00:00.000Z'
    )
    const payload = vi.mocked(invoke).mock.calls[0][1] as { input: Record<string, unknown> }
    expect(payload.input.steps).toBeUndefined()
  })

  it('envía steps cuando el patch los incluye', async () => {
    await updateTask(
      '123e4567-e89b-12d3-a456-426614174000',
      { steps: [{ id: '660e8400-e29b-41d4-a716-446655440000', title: 'Paso', done: true }] },
      '2026-07-05T00:00:00.000Z'
    )
    const payload = vi.mocked(invoke).mock.calls[0][1] as { input: Record<string, unknown> }
    expect(payload.input.steps).toBe(
      JSON.stringify([{ id: '660e8400-e29b-41d4-a716-446655440000', title: 'Paso', done: true }])
    )
  })
})

describe('db.deleteTask', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
  })

  it('envía id directamente', async () => {
    await deleteTask('123e4567-e89b-12d3-a456-426614174000')
    expect(invoke).toHaveBeenCalledWith('delete_task', {
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
})

describe('db.createGoal - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockGoalRow)
  })

  it('envía input con frequency como objeto anidado', async () => {
    await createGoal(
      { title: 'Test', color: '#ff5500', target: 10, frequency: { type: 'daily' } },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('create_goal', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        color: '#ff5500',
        target: 10,
        frequency: {
          type: 'daily',
          interval_days: null,
          days_of_week: null,
        },
      }),
    })
  })

  it('rechaza draft inválido sin invocar', async () => {
    await expect(
      createGoal(
        { title: '', color: '#ff5500', target: 10, frequency: { type: 'daily' } } as any,
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      )
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('db.listGoals', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue([mockGoalRow])
  })

  it('retorna array de GoalRow parseados', async () => {
    const result = await listGoals()
    expect(invoke).toHaveBeenCalledWith('list_goals', { includeArchived: false })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test Goal')
  })
})

describe('db.updateGoal - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockGoalRow)
  })

  it('envía input con frequency anidado o undefined', async () => {
    await updateGoal(
      '123e4567-e89b-12d3-a456-426614174000',
      { title: 'Nuevo', color: '#eb5757' },
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('update_goal', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Nuevo',
        color: '#eb5757',
        updated_at: '2026-07-05T00:00:00.000Z',
        frequency: undefined,
      }),
    })
  })

  it('envía frequency anidado en updateGoal cuando el patch incluye frequency', async () => {
    await updateGoal(
      '123e4567-e89b-12d3-a456-426614174000',
      { frequency: { type: 'interval', interval_days: 3 } },
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('update_goal', {
      input: expect.objectContaining({
        frequency: {
          type: 'interval',
          interval_days: 3,
          days_of_week: null,
        },
      }),
    })
  })
})

describe('db.deleteGoal', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
  })

  it('envía id directamente', async () => {
    await deleteGoal('123e4567-e89b-12d3-a456-426614174000')
    expect(invoke).toHaveBeenCalledWith('delete_goal', {
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
})

describe('db.upsertGoalLog - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockGoalLogRow)
  })

  it('envía input con amount y log_date', async () => {
    await upsertGoalLog(
      { goal_id: '223e4567-e89b-12d3-a456-426614174000', log_date: '2026-07-05', amount: 5 },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('upsert_goal_log', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        goal_id: '223e4567-e89b-12d3-a456-426614174000',
        log_date: '2026-07-05',
        amount: 5,
        created_at: '2026-07-05T00:00:00.000Z',
      }),
    })
  })

  it('rechaza draft inválido sin invocar', async () => {
    await expect(
      upsertGoalLog(
        { goal_id: '223e4567-e89b-12d3-a456-426614174000', amount: 0 } as any,
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-07-05T00:00:00.000Z'
      )
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('db.deleteGoalLog', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
  })

  it('envía id directamente', async () => {
    await deleteGoalLog('123e4567-e89b-12d3-a456-426614174000')
    expect(invoke).toHaveBeenCalledWith('delete_goal_log', {
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
})

describe('db.upsertHabitLog - shape hacia Rust', () => {
  const mockHabitLogRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    habit_id: '223e4567-e89b-12d3-a456-426614174000',
    log_date: '2026-07-05',
    completed_at: '2026-07-05T12:00:00.000Z',
    note: null,
    count: 4,
    created_at: '2026-07-05T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockHabitLogRow)
  })

  it('envía input con count y log_date', async () => {
    await upsertHabitLog(
      { habit_id: '223e4567-e89b-12d3-a456-426614174000', log_date: '2026-07-05', count: 4 },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-07-05T12:00:00.000Z',
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('upsert_habit_log', {
      input: expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        habit_id: '223e4567-e89b-12d3-a456-426614174000',
        log_date: '2026-07-05',
        completed_at: '2026-07-05T12:00:00.000Z',
        note: null,
        count: 4,
        created_at: '2026-07-05T00:00:00.000Z',
      }),
    })
  })

  it('usa count=1 por defecto cuando el draft no lo incluye', async () => {
    await upsertHabitLog(
      { habit_id: '223e4567-e89b-12d3-a456-426614174000', log_date: '2026-07-05' },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-07-05T12:00:00.000Z',
      '2026-07-05T00:00:00.000Z'
    )
    const call = vi.mocked(invoke).mock.calls[0]
    const input = (call[1] as { input: Record<string, unknown> }).input
    expect(input.count).toBe(1)
  })

  it('rechaza draft inválido sin invocar', async () => {
    await expect(
      upsertHabitLog(
        { habit_id: '223e4567-e89b-12d3-a456-426614174000', count: 0 } as any,
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-07-05T12:00:00.000Z',
        '2026-07-05T00:00:00.000Z'
      )
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('valida la fila devuelta con HabitLogRowSchema incluyendo count', async () => {
    const result = await upsertHabitLog(
      { habit_id: '223e4567-e89b-12d3-a456-426614174000', log_date: '2026-07-05', count: 4 },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-07-05T12:00:00.000Z',
      '2026-07-05T00:00:00.000Z'
    )
    expect(result.count).toBe(4)
  })
})

describe('db.listGoalLogsInRange', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue([mockGoalLogRow])
  })

  it('envía fromDate, toDate, goalId', async () => {
    const result = await listGoalLogsInRange(
      '2026-07-01',
      '2026-07-31',
      '223e4567-e89b-12d3-a456-426614174000'
    )
    expect(invoke).toHaveBeenCalledWith('list_goal_logs_in_range', {
      goalId: '223e4567-e89b-12d3-a456-426614174000',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    })
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5)
  })

  it('acepta goalId null para listar todos', async () => {
    await listGoalLogsInRange('2026-07-01', '2026-07-31')
    expect(invoke).toHaveBeenCalledWith('list_goal_logs_in_range', {
      goalId: null,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    })
  })
})

describe('db gcal visible calendars', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
  })

  it('load devuelve default cuando la key no existe', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    const result = await loadGcalVisibleCalendars()
    expect(invoke).toHaveBeenCalledWith('load_config', { key: 'gcal-visible-calendars' })
    expect(result).toEqual({ hiddenCalendarIds: [] })
  })

  it('load parsea una preferencia persistida válida', async () => {
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({ hiddenCalendarIds: ['work'] }))
    const result = await loadGcalVisibleCalendars()
    expect(result).toEqual({ hiddenCalendarIds: ['work'] })
  })

  it('load devuelve default ante JSON corrupto', async () => {
    vi.mocked(invoke).mockResolvedValue('{no-json')
    const result = await loadGcalVisibleCalendars()
    expect(result).toEqual({ hiddenCalendarIds: [] })
  })

  it('save persiste la preferencia validada bajo su key', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    await saveGcalVisibleCalendars({ hiddenCalendarIds: ['work', 'utn'] })
    expect(invoke).toHaveBeenCalledWith('save_config', {
      key: 'gcal-visible-calendars',
      value: JSON.stringify({ hiddenCalendarIds: ['work', 'utn'] }),
    })
  })

  it('save rechaza preferencia inválida sin invocar', async () => {
    await expect(
      saveGcalVisibleCalendars({ hiddenCalendarIds: 42 } as unknown as {
        hiddenCalendarIds: string[]
      })
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('roundtrip save/load conserva los ids ocultos', async () => {
    const stored = new Map<string, string>()
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: unknown) => {
      const params = args as { key: string; value?: string }
      if (cmd === 'save_config') {
        stored.set(params.key, params.value ?? '')
        return undefined
      }
      if (cmd === 'load_config') {
        return stored.get(params.key) ?? null
      }
      throw new Error(`unexpected invoke: ${cmd}`)
    })
    await saveGcalVisibleCalendars({ hiddenCalendarIds: ['work'] })
    expect(await loadGcalVisibleCalendars()).toEqual({ hiddenCalendarIds: ['work'] })
  })
})

const mockNoteRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Lo que dijo el profesor',
  description: 'Repasar capítulo 3',
  color: '#6e56cf',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-07-05T00:00:00.000Z',
}

describe('db.createNote - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockNoteRow)
  })

  it('envía input plano con id y timestamps generados en el store', async () => {
    await createNote(
      { title: 'Título', description: 'Desc', color: '#6e56cf' },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('create_note', {
      input: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Título',
        description: 'Desc',
        color: '#6e56cf',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    })
  })

  it('convierte título ausente a null para Rust', async () => {
    await createNote(
      { title: null, description: 'Solo desc', color: '#6e56cf' },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    const call = vi.mocked(invoke).mock.calls[0]
    const input = (call[1] as { input: Record<string, unknown> }).input
    expect(input.title).toBeNull()
  })

  it('rechaza draft sin contenido antes de invocar', async () => {
    await expect(
      createNote(
        { title: null, description: null, color: '#6e56cf' },
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      )
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('valida la fila devuelta con NoteRowSchema', async () => {
    const result = await createNote(
      { title: 'Título', description: null, color: '#6e56cf' },
      '123e4567-e89b-12d3-a456-426614174000',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    expect(result.title).toBe('Lo que dijo el profesor')
  })
})

describe('db.listNotes', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue([mockNoteRow])
  })

  it('invoca list_notes sin args y parsea cada row', async () => {
    const result = await listNotes()
    expect(invoke).toHaveBeenCalledWith('list_notes')
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Repasar capítulo 3')
  })

  it('tolera respuesta no-array devolviendo vacío', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    expect(await listNotes()).toEqual([])
  })
})

describe('db.updateNote - shape hacia Rust', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(mockNoteRow)
  })

  it('envía double-Option: title null limpia, ausente no toca', async () => {
    await updateNote(
      '123e4567-e89b-12d3-a456-426614174000',
      { title: null, description: 'Nueva desc' },
      '2026-07-05T00:00:00.000Z'
    )
    expect(invoke).toHaveBeenCalledWith('update_note', {
      input: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: null,
        description: 'Nueva desc',
        color: undefined,
        updated_at: '2026-07-05T00:00:00.000Z',
      },
    })
  })

  it('convierte título vacío a null (limpia título)', async () => {
    await updateNote(
      '123e4567-e89b-12d3-a456-426614174000',
      { title: '   ' },
      '2026-07-05T00:00:00.000Z'
    )
    const call = vi.mocked(invoke).mock.calls[0]
    const input = (call[1] as { input: Record<string, unknown> }).input
    expect(input.title).toBeNull()
  })
})

describe('db.deleteNote', () => {
  it('invoca delete_note con el id', async () => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
    await deleteNote('123e4567-e89b-12d3-a456-426614174000')
    expect(invoke).toHaveBeenCalledWith('delete_note', {
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
})

describe('db.clearAllData — alcance de borrado (persistencia)', () => {
  it('invoca clear_all_data pasando exactamente las tablas y las claves de datos', async () => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
    await clearAllData()
    expect(invoke).toHaveBeenCalledWith('clear_all_data', {
      tables: [...DATA_TABLES],
      dataConfigKeys: [...DATA_CONFIG_KEYS],
    })
  })

  it('qué se borra y qué no se toca: las claves pasadas son datos, jamás configuración', async () => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
    await clearAllData()
    const arg = vi.mocked(invoke).mock.calls[0][1] as {
      tables: string[]
      dataConfigKeys: string[]
    }
    // Se vacían exactamente las tablas de contenido.
    expect([...arg.tables].sort()).toEqual([...DATA_TABLES].sort())
    const sent = new Set(arg.dataConfigKeys)
    // Se borra: todos los datos de config.
    for (const key of DATA_CONFIG_KEYS) {
      expect(sent.has(key)).toBe(true)
    }
    // No se toca: ninguna clave de configuración viaja al borrado.
    for (const key of PRESERVED_CONFIG_KEYS) {
      expect(sent.has(key)).toBe(false)
    }
  })
})
