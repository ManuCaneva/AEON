import { z } from 'zod'
import { uuid, isoTimestamp, localDate, hexColor, trimmed, normalizeTimestamp } from './primitives'

const DailyGoalFrequency = z.object({ type: z.literal('daily') })
const WeeklyGoalFrequency = z.object({ type: z.literal('weekly') })
const IntervalGoalFrequency = z.object({
  type: z.literal('interval'),
  interval_days: z.number().int().min(1).max(365),
})

export const GoalFrequencySchema = z.discriminatedUnion('type', [
  DailyGoalFrequency,
  WeeklyGoalFrequency,
  IntervalGoalFrequency,
])
export type GoalFrequency = z.infer<typeof GoalFrequencySchema>

export const GoalSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  description: z.string().trim().max(500).nullable().default(null),
  color: hexColor,
  target: z.number().int().min(1),
  unit: z.string().trim().max(30).nullable().default(null),
  direction: z.enum(['up', 'down']).default('up'),
  frequency: GoalFrequencySchema,
  sort_order: z.number().int().default(0),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
  archived_at: isoTimestamp.nullable().default(null),
})
export type Goal = z.infer<typeof GoalSchema>

export const GoalLogSchema = z.object({
  id: uuid,
  goal_id: uuid,
  log_date: localDate,
  amount: z.number().int().min(1),
  note: z.string().trim().max(280).nullable().default(null),
  created_at: isoTimestamp,
})
export type GoalLog = z.infer<typeof GoalLogSchema>

const CreateGoalDraftObject = z.object({
  title: trimmed(1, 100),
  description: z.string().trim().max(500).nullable().optional(),
  color: hexColor,
  target: z.number().int().min(1),
  direction: z.enum(['up', 'down']).optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  frequency: GoalFrequencySchema,
  sort_order: z.number().int().optional(),
})

export const CreateGoalDraftSchema = CreateGoalDraftObject
export type CreateGoalDraft = z.infer<typeof CreateGoalDraftSchema>

export const UpdateGoalDraftSchema = CreateGoalDraftObject.partial()
export type UpdateGoalDraft = z.infer<typeof UpdateGoalDraftSchema>

export const CreateGoalLogDraftSchema = z.object({
  goal_id: uuid,
  log_date: localDate.optional(),
  amount: z.number().int().min(1).optional(),
  note: z.string().trim().max(280).nullable().optional(),
})
export type CreateGoalLogDraft = z.infer<typeof CreateGoalLogDraftSchema>

export const GoalRowSchema = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  target: z.number().int(),
  unit: z.string().nullable(),
  direction: z.string(),
  frequency_type: z.string(),
  interval_days: z.number().int().nullable(),
  days_of_week: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable(),
})
export type GoalRow = z.infer<typeof GoalRowSchema>

export const GoalLogRowSchema = z.object({
  id: uuid,
  goal_id: uuid,
  log_date: z.string(),
  amount: z.number().int(),
  note: z.string().nullable(),
  created_at: z.string(),
})
export type GoalLogRow = z.infer<typeof GoalLogRowSchema>

export function rowToGoal(row: GoalRow): Goal {
  const frequency: GoalFrequency =
    row.frequency_type === 'daily'
      ? { type: 'daily' }
      : row.frequency_type === 'weekly'
        ? { type: 'weekly' }
        : { type: 'interval', interval_days: row.interval_days ?? 1 }

  return GoalSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    color: row.color,
    target: row.target,
    unit: row.unit,
    direction: row.direction === 'down' ? 'down' : 'up',
    frequency,
    sort_order: row.sort_order,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
    archived_at: row.archived_at ? normalizeTimestamp(row.archived_at) : null,
  })
}

export function goalToRow(g: CreateGoalDraft | UpdateGoalDraft | Goal): {
  title?: string
  description: string | null
  color?: string
  target?: number
  unit: string | null
  direction: 'up' | 'down'
  frequency_type: 'daily' | 'weekly' | 'interval'
  interval_days: number | null
  days_of_week: null
  sort_order: number
} {
  const frequency: GoalFrequency | undefined = 'frequency' in g ? g.frequency : undefined

  const base = {
    ...('title' in g && g.title !== undefined ? { title: g.title } : {}),
    ...('color' in g && g.color !== undefined ? { color: g.color } : {}),
    ...('target' in g && g.target !== undefined ? { target: g.target } : {}),
    description: ('description' in g ? g.description : null) ?? null,
    unit: ('unit' in g ? g.unit : null) ?? null,
    direction: ('direction' in g && g.direction ? g.direction : 'up') as 'up' | 'down',
    sort_order: 'sort_order' in g && g.sort_order !== undefined ? g.sort_order : 0,
  }

  if (!frequency) {
    return {
      ...base,
      frequency_type: 'daily' as const,
      interval_days: null,
      days_of_week: null,
    }
  }

  return {
    ...base,
    frequency_type: frequency.type,
    interval_days: frequency.type === 'interval' ? frequency.interval_days : null,
    days_of_week: null,
  }
}

export function rowToGoalLog(row: GoalLogRow): GoalLog {
  return GoalLogSchema.parse({
    ...row,
    created_at: normalizeTimestamp(row.created_at),
  })
}
