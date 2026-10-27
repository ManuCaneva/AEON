import { describe, expect, it } from 'vitest'
import {
  GoalFrequencySchema,
  GoalSchema,
  GoalLogSchema,
  CreateGoalDraftSchema,
  UpdateGoalDraftSchema,
  CreateGoalLogDraftSchema,
  GoalRowSchema,
  GoalLogRowSchema,
  rowToGoal,
  goalToRow,
  rowToGoalLog,
} from './goals'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validUuid2 = '660e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-06-27T10:00:00.000Z'
const validDate = '2026-06-27'

describe('GoalFrequencySchema', () => {
  it('acepta daily', () => {
    expect(GoalFrequencySchema.parse({ type: 'daily' })).toEqual({ type: 'daily' })
  })

  it('acepta weekly', () => {
    expect(GoalFrequencySchema.parse({ type: 'weekly' })).toEqual({ type: 'weekly' })
  })

  it('acepta interval con interval_days', () => {
    expect(GoalFrequencySchema.parse({ type: 'interval', interval_days: 3 })).toEqual({
      type: 'interval',
      interval_days: 3,
    })
  })

  it('rechaza interval sin interval_days', () => {
    expect(() => GoalFrequencySchema.parse({ type: 'interval' })).toThrow()
  })

  it('rechaza interval_days fuera de rango', () => {
    expect(() => GoalFrequencySchema.parse({ type: 'interval', interval_days: 0 })).toThrow()
    expect(() => GoalFrequencySchema.parse({ type: 'interval', interval_days: 400 })).toThrow()
  })

  it('rechaza type inválido', () => {
    expect(() => GoalFrequencySchema.parse({ type: 'monthly' })).toThrow()
  })
})

describe('GoalSchema', () => {
  const validGoal = {
    id: validUuid,
    title: 'Leer 10 páginas',
    description: null,
    color: '#ff5500',
    target: 10,
    unit: null,
    direction: 'up' as const,
    frequency: { type: 'daily' as const },
    sort_order: 0,
    created_at: validIso,
    updated_at: validIso,
    archived_at: null,
  }

  it('acepta goal válido mínimo', () => {
    expect(GoalSchema.parse(validGoal)).toEqual(validGoal)
  })

  it('aplica default direction up', () => {
    const { direction: _d, ...sinCamposNuevos } = validGoal
    expect(GoalSchema.parse(sinCamposNuevos)).toMatchObject({ direction: 'up' })
  })

  it('acepta objetivo de descontar con la misma meta', () => {
    const goal = { ...validGoal, direction: 'down' as const }
    expect(GoalSchema.parse(goal)).toMatchObject({ direction: 'down', target: 10 })
  })

  it('acepta goal con unit', () => {
    const goal = { ...validGoal, unit: 'páginas' }
    expect(GoalSchema.parse(goal).unit).toBe('páginas')
  })

  it('acepta frequency weekly', () => {
    const goal = { ...validGoal, frequency: { type: 'weekly' as const } }
    expect(GoalSchema.parse(goal).frequency.type).toBe('weekly')
  })

  it('acepta frequency interval', () => {
    const goal = { ...validGoal, frequency: { type: 'interval' as const, interval_days: 7 } }
    expect(GoalSchema.parse(goal).frequency).toEqual({ type: 'interval', interval_days: 7 })
  })

  it('rechaza target <= 0', () => {
    expect(() => GoalSchema.parse({ ...validGoal, target: 0 })).toThrow()
    expect(() => GoalSchema.parse({ ...validGoal, target: -1 })).toThrow()
    expect(() => GoalSchema.parse({ ...validGoal, direction: 'down', target: 0 })).toThrow()
  })

  it('rechaza title vacío', () => {
    expect(() => GoalSchema.parse({ ...validGoal, title: '' })).toThrow()
  })

  it('rechaza color mal formato', () => {
    expect(() => GoalSchema.parse({ ...validGoal, color: 'red' })).toThrow()
  })

  it('rechaza unit demasiado largo', () => {
    expect(() => GoalSchema.parse({ ...validGoal, unit: 'a'.repeat(31) })).toThrow()
  })
})

describe('GoalLogSchema', () => {
  it('acepta log válido', () => {
    expect(
      GoalLogSchema.parse({
        id: validUuid,
        goal_id: validUuid2,
        log_date: validDate,
        amount: 5,
        note: null,
        created_at: validIso,
      })
    ).toMatchObject({ amount: 5 })
  })

  it('rechaza amount <= 0', () => {
    expect(() =>
      GoalLogSchema.parse({
        id: validUuid,
        goal_id: validUuid2,
        log_date: validDate,
        amount: 0,
        note: null,
        created_at: validIso,
      })
    ).toThrow()
  })

  it('rechaza log_date inválida', () => {
    expect(() =>
      GoalLogSchema.parse({
        id: validUuid,
        goal_id: validUuid2,
        log_date: 'bad',
        amount: 1,
        note: null,
        created_at: validIso,
      })
    ).toThrow()
  })

  it('acepta note null', () => {
    expect(
      GoalLogSchema.parse({
        id: validUuid,
        goal_id: validUuid2,
        log_date: validDate,
        amount: 1,
        note: null,
        created_at: validIso,
      })
    ).toMatchObject({ note: null })
  })
})

describe('CreateGoalDraftSchema', () => {
  it('acepta draft mínimo (title, color, target, frequency)', () => {
    const draft = { title: 'Leer', color: '#aabbcc', target: 10, frequency: { type: 'daily' } }
    const parsed = CreateGoalDraftSchema.parse(draft)
    expect(parsed).toMatchObject(draft)
    expect(parsed).not.toHaveProperty('id')
    expect(parsed).not.toHaveProperty('created_at')
  })

  it('acepta draft completo', () => {
    const draft = {
      title: 'Leer',
      color: '#aabbcc',
      target: 10,
      unit: 'páginas',
      description: 'Desc',
      frequency: { type: 'interval' as const, interval_days: 3 },
      sort_order: 5,
    }
    expect(CreateGoalDraftSchema.parse(draft)).toEqual(draft)
  })

  it('rechaza sin title', () => {
    expect(() =>
      CreateGoalDraftSchema.parse({ color: '#aabbcc', target: 10, frequency: { type: 'daily' } })
    ).toThrow()
  })

  it('rechaza target <= 0', () => {
    expect(() =>
      CreateGoalDraftSchema.parse({
        title: 'x',
        color: '#aabbcc',
        target: 0,
        frequency: { type: 'daily' },
      })
    ).toThrow()
  })

  it('acepta draft de restar con direction down', () => {
    const draft = {
      title: 'Porciones',
      color: '#aabbcc',
      direction: 'down' as const,
      target: 10,
      frequency: { type: 'daily' as const },
    }
    expect(CreateGoalDraftSchema.parse(draft)).toMatchObject(draft)
  })
})

describe('UpdateGoalDraftSchema', () => {
  it('acepta todo opcional', () => {
    expect(UpdateGoalDraftSchema.parse({})).toEqual({})
    expect(UpdateGoalDraftSchema.parse({ title: 'Nuevo' })).toMatchObject({ title: 'Nuevo' })
  })
})

describe('CreateGoalLogDraftSchema', () => {
  it('acepta draft mínimo (goal_id)', () => {
    const draft = { goal_id: validUuid }
    const parsed = CreateGoalLogDraftSchema.parse(draft)
    expect(parsed.goal_id).toBe(validUuid)
    expect(parsed).not.toHaveProperty('id')
    expect(parsed).not.toHaveProperty('created_at')
  })

  it('acepta draft completo', () => {
    const draft = { goal_id: validUuid, log_date: validDate, amount: 5, note: 'Nota' }
    expect(CreateGoalLogDraftSchema.parse(draft)).toEqual(draft)
  })

  it('rechaza amount <= 0', () => {
    expect(() => CreateGoalLogDraftSchema.parse({ goal_id: validUuid, amount: 0 })).toThrow()
  })
})

describe('GoalRowSchema', () => {
  it('acepta row permissive', () => {
    const row = {
      id: validUuid,
      title: '  con espacios  ',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: '2026-06-27 10:00:00',
      updated_at: '2026-06-27 10:00:00',
      archived_at: null,
    }
    const parsed = GoalRowSchema.parse(row)
    expect(parsed.title).toBe('  con espacios  ')
    expect(parsed.frequency_type).toBe('daily')
    expect(parsed.direction).toBe('up')
  })
})

describe('GoalLogRowSchema', () => {
  it('acepta row permissive', () => {
    const row = {
      id: validUuid,
      goal_id: validUuid2,
      log_date: validDate,
      amount: 5,
      note: null,
      created_at: '2026-06-27 10:00:00',
    }
    const parsed = GoalLogRowSchema.parse(row)
    expect(parsed.amount).toBe(5)
  })
})

describe('rowToGoal', () => {
  it('reconstruye frequency daily', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: '2026-06-27 10:00:00',
      updated_at: '2026-06-27 10:00:00',
      archived_at: null,
    }
    const goal = rowToGoal(row)
    expect(goal.frequency).toEqual({ type: 'daily' })
    expect(goal.created_at).toBe('2026-06-27T10:00:00Z')
  })

  it('reconstruye frequency interval', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'interval',
      interval_days: 7,
      days_of_week: null,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    const goal = rowToGoal(row)
    expect(goal.frequency).toEqual({ type: 'interval', interval_days: 7 })
  })

  it('interval_days null para interval → default 1', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: null,
      direction: 'up',
      frequency_type: 'interval',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    const goal = rowToGoal(row)
    expect(goal.frequency).toEqual({ type: 'interval', interval_days: 1 })
  })

  it('mapea direction del row', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: null,
      direction: 'down',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(rowToGoal(row)).toMatchObject({ direction: 'down', target: 10 })
    expect(rowToGoal({ ...row, direction: 'cualquiera' })).toMatchObject({ direction: 'up' })
  })
})

describe('goalToRow', () => {
  it('aplana frequency daily', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      frequency: { type: 'daily' as const },
    }
    const row = goalToRow(draft)
    expect(row.frequency_type).toBe('daily')
    expect(row.interval_days).toBeNull()
    expect(row.days_of_week).toBeNull()
  })

  it('aplana frequency interval', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      frequency: { type: 'interval' as const, interval_days: 3 },
    }
    const row = goalToRow(draft)
    expect(row.frequency_type).toBe('interval')
    expect(row.interval_days).toBe(3)
  })

  it('unit null por defecto', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      frequency: { type: 'daily' as const },
    }
    const row = goalToRow(draft)
    expect(row.unit).toBeNull()
  })

  it('unit se preserva', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      unit: 'páginas',
      frequency: { type: 'daily' as const },
    }
    const row = goalToRow(draft)
    expect(row.unit).toBe('páginas')
  })

  it('sort_order default 0', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      frequency: { type: 'daily' as const },
    }
    const row = goalToRow(draft)
    expect(row.sort_order).toBe(0)
  })

  it('aplana direction', () => {
    const down = {
      title: 'Test',
      color: '#aabbcc',
      direction: 'down' as const,
      target: 10,
      frequency: { type: 'daily' as const },
    }
    const row = goalToRow(down)
    expect(row.direction).toBe('down')
    expect(row.target).toBe(10)

    const up = goalToRow({
      title: 'Test',
      color: '#aabbcc',
      target: 10,
      frequency: { type: 'daily' as const },
    })
    expect(up.direction).toBe('up')
  })
})

describe('rowToGoalLog', () => {
  it('normaliza timestamps', () => {
    const row = {
      id: validUuid,
      goal_id: validUuid2,
      log_date: validDate,
      amount: 5,
      note: null,
      created_at: '2026-06-27 10:00:00',
    }
    const log = rowToGoalLog(row)
    expect(log.created_at).toBe('2026-06-27T10:00:00Z')
  })
})

describe('Round-trip', () => {
  it('goal → row → goal es identity', () => {
    const goal = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      target: 10,
      unit: 'páginas',
      direction: 'up' as const,
      frequency: { type: 'interval' as const, interval_days: 7 },
      sort_order: 5,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    const row = goalToRow(goal)
    const fullRow = {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      color: goal.color,
      target: goal.target,
      unit: goal.unit,
      direction: row.direction,
      frequency_type: row.frequency_type,
      interval_days: row.interval_days,
      days_of_week: row.days_of_week,
      sort_order: goal.sort_order,
      created_at: goal.created_at,
      updated_at: goal.updated_at,
      archived_at: null,
    }
    const result = rowToGoal(fullRow)
    expect(result).toEqual(goal)
  })
})
