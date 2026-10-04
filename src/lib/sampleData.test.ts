import { describe, expect, it } from 'vitest'
import { buildSampleData, SAMPLE_YEAR } from './sampleData'
import type { SampleGoalLog } from './sampleData'
import { CreateHabitDraftSchema, CreateHabitLogDraftSchema } from '@/schemas/habits'
import { CreateTaskDraftSchema } from '@/schemas/tasks'
import { CreateGoalDraftSchema, CreateGoalLogDraftSchema } from '@/schemas/goals'
import { CreateNoteDraftSchema } from '@/schemas/notes'
import {
  CreateScheduleBlockDraftSchema,
  CreateScheduleSlotDraftSchema,
} from '@/schemas/weeklySchedule'
import { CalendarEventSchema } from '@/schemas/calendar'
import { isoTimestamp, uuid } from '@/schemas/primitives'

// Referencia fija para que los tests no dependan del día en que corren.
const TODAY = new Date(2026, 5, 15, 12, 0, 0)

function fmt(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function dateNDaysAgo(n: number): Date {
  return new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - n)
}

const todayStr = fmt(TODAY)
const data = buildSampleData(TODAY)
const logsByHabit = new Map(data.habits.map((h) => [h.id, [] as string[]]))
for (const log of data.habitLogs) {
  logsByHabit.get(log.habit_id)?.push(log.log_date)
}

describe('buildSampleData — cantidades (issue #86)', () => {
  it('genera 8-10 hábitos', () => {
    expect(data.habits.length).toBeGreaterThanOrEqual(8)
    expect(data.habits.length).toBeLessThanOrEqual(10)
  })

  it('genera 6-8 tareas', () => {
    expect(data.tasks.length).toBeGreaterThanOrEqual(6)
    expect(data.tasks.length).toBeLessThanOrEqual(8)
  })

  it('genera 3-4 metas', () => {
    expect(data.goals.length).toBeGreaterThanOrEqual(3)
    expect(data.goals.length).toBeLessThanOrEqual(4)
  })

  it('genera 4-5 notas', () => {
    expect(data.notes.length).toBeGreaterThanOrEqual(4)
    expect(data.notes.length).toBeLessThanOrEqual(5)
  })

  it('genera 5-6 bloques de agenda semanal', () => {
    expect(data.scheduleBlocks.length).toBeGreaterThanOrEqual(5)
    expect(data.scheduleBlocks.length).toBeLessThanOrEqual(6)
  })

  it('genera 10-15 eventos locales de calendario', () => {
    expect(data.calendarEvents.length).toBeGreaterThanOrEqual(10)
    expect(data.calendarEvents.length).toBeLessThanOrEqual(15)
  })

  it('incluye historial de check-ins (60-90 días) en total', () => {
    expect(data.habitLogs.length).toBeGreaterThanOrEqual(60)
  })

  it('es determinista para una misma fecha de referencia', () => {
    expect(buildSampleData(TODAY)).toEqual(data)
  })

  it('no incluye datos del pomodoro', () => {
    expect(Object.keys(data)).not.toContain('pomodoro')
  })
})

describe('buildSampleData — hábitos', () => {
  it('cubre los tres tipos de frecuencia (daily, weekly, interval)', () => {
    const types = new Set(data.habits.map((h) => h.draft.frequency.type))
    expect(types).toEqual(new Set(['daily', 'weekly', 'interval']))
  })

  it('cada hábito se creó entre 60 y 90 días antes de hoy', () => {
    for (const habit of data.habits) {
      const createdAt = parseLocalDate(habit.created_at.slice(0, 10))
      const age = daysBetween(createdAt, TODAY)
      expect(age).toBeGreaterThanOrEqual(60)
      expect(age).toBeLessThanOrEqual(90)
    }
  })

  it('los check-ins cubren un rango de 60 a 90 días sin fechas futuras', () => {
    for (const habit of data.habits) {
      const dates = logsByHabit.get(habit.id) ?? []
      expect(dates.length).toBeGreaterThan(0)
      const sorted = [...dates].sort()
      expect(sorted[0] <= todayStr).toBe(true)
      expect(sorted[sorted.length - 1] <= todayStr).toBe(true)
      expect(sorted[0] >= fmt(dateNDaysAgo(90))).toBe(true)
      const span = daysBetween(parseLocalDate(sorted[0]), TODAY)
      expect(span).toBeGreaterThanOrEqual(60)
      expect(span).toBeLessThanOrEqual(90)
    }
  })

  it('al menos un hábito tiene huecos (check-ins faltantes)', () => {
    const withGaps = data.habits.some((habit) => {
      const dates = new Set(logsByHabit.get(habit.id) ?? [])
      const createdAt = parseLocalDate(habit.created_at.slice(0, 10))
      const historyDays = daysBetween(createdAt, TODAY)
      for (let d = 1; d < historyDays; d++) {
        if (!dates.has(fmt(dateNDaysAgo(d)))) return true
      }
      return false
    })
    expect(withGaps).toBe(true)
  })

  it('al menos un hábito queda pendiente hoy para que el usuario pueda registrarlo', () => {
    const pendingToday = data.habits.some((habit) => {
      const dates = logsByHabit.get(habit.id) ?? []
      return !dates.includes(todayStr)
    })
    expect(pendingToday).toBe(true)
  })

  it('los drafts pasan la validación de Zod', () => {
    for (const habit of data.habits) {
      expect(CreateHabitDraftSchema.safeParse(habit.draft).success).toBe(true)
    }
  })

  it('los check-ins referencian hábitos existentes y pasan Zod', () => {
    const ids = new Set(data.habits.map((h) => h.id))
    for (const log of data.habitLogs) {
      expect(ids.has(log.habit_id)).toBe(true)
      expect(CreateHabitLogDraftSchema.safeParse(log).success).toBe(true)
    }
  })
})

describe('buildSampleData — tareas', () => {
  it('incluye tareas en distintos estados (todo, doing, done)', () => {
    const statuses = new Set(data.tasks.map((t) => t.draft.status))
    expect(statuses).toEqual(new Set(['todo', 'doing', 'done']))
  })

  it('todas las tareas vencen en SAMPLE_YEAR y no antes de hoy', () => {
    for (const task of data.tasks) {
      expect(task.draft.due_date).toBeDefined()
      expect(task.draft.due_date!.startsWith(`${SAMPLE_YEAR}-`)).toBe(true)
      expect(task.draft.due_date! >= todayStr).toBe(true)
    }
  })

  it('al menos una tarea tiene pasos, con uno hecho y otro pendiente', () => {
    const withSteps = data.tasks.filter((t) => t.draft.steps.length > 0)
    expect(withSteps.length).toBeGreaterThan(0)
    const hasMixed = withSteps.some(
      (t) => t.draft.steps.some((s) => s.done) && t.draft.steps.some((s) => !s.done)
    )
    expect(hasMixed).toBe(true)
  })

  it('los drafts pasan la validación de Zod', () => {
    for (const task of data.tasks) {
      expect(CreateTaskDraftSchema.safeParse(task.draft).success).toBe(true)
      expect(task.draft.title.length).toBeGreaterThan(0)
    }
  })
})

describe('buildSampleData — metas', () => {
  const goalLogsByGoal = new Map(data.goals.map((g) => [g.id, [] as SampleGoalLog[]]))
  for (const log of data.goalLogs) {
    goalLogsByGoal.get(log.goal_id)?.push(log)
  }

  it('los drafts pasan la validación de Zod', () => {
    for (const goal of data.goals) {
      expect(CreateGoalDraftSchema.safeParse(goal.draft).success).toBe(true)
    }
  })

  it('los logs de meta referencian metas existentes y pasan Zod', () => {
    const ids = new Set(data.goals.map((g) => g.id))
    for (const log of data.goalLogs) {
      expect(ids.has(log.goal_id)).toBe(true)
      expect(CreateGoalLogDraftSchema.safeParse(log).success).toBe(true)
      expect(log.log_date <= todayStr).toBe(true)
    }
  })

  it('cada meta tiene progreso parcial registrado hoy (0 < progreso < objetivo)', () => {
    for (const goal of data.goals) {
      const logs = goalLogsByGoal.get(goal.id) ?? []
      const todayAmount = logs
        .filter((l) => l.log_date === todayStr)
        .reduce((sum, l) => sum + l.amount, 0)
      expect(todayAmount).toBeGreaterThan(0)
      expect(todayAmount).toBeLessThan(goal.draft.target)
    }
  })

  it('cada meta tiene historial de logs además de hoy', () => {
    for (const goal of data.goals) {
      const logs = goalLogsByGoal.get(goal.id) ?? []
      expect(logs.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('buildSampleData — notas', () => {
  it('los drafts pasan la validación de Zod y tienen contenido real', () => {
    for (const note of data.notes) {
      expect(CreateNoteDraftSchema.safeParse(note.draft).success).toBe(true)
      const text = `${note.draft.title ?? ''} ${note.draft.description ?? ''}`
      expect(text.trim().length).toBeGreaterThan(0)
      expect(text.toLowerCase()).not.toContain('lorem')
    }
  })

  it('incluye una nota de ejemplo conocida', () => {
    const titles = data.notes.map((n) => n.draft.title)
    expect(titles).toContain('Lista del súper')
  })
})

describe('buildSampleData — agenda semanal', () => {
  it('los bloques y sus slots pasan la validación de Zod', () => {
    for (const block of data.scheduleBlocks) {
      expect(CreateScheduleBlockDraftSchema.safeParse(block.draft).success).toBe(true)
      expect(block.slots.length).toBeGreaterThan(0)
      for (const slot of block.slots) {
        expect(CreateScheduleSlotDraftSchema.safeParse(slot.draft).success).toBe(true)
        expect(slot.draft.end_minutes).toBeGreaterThan(slot.draft.start_minutes)
      }
    }
  })

  it('los slots de un mismo día nunca se superponen (entre todos los bloques)', () => {
    const byDay = new Map<number, { start: number; end: number }[]>()
    for (const block of data.scheduleBlocks) {
      for (const slot of block.slots) {
        const list = byDay.get(slot.draft.day_of_week) ?? []
        list.push({ start: slot.draft.start_minutes, end: slot.draft.end_minutes })
        byDay.set(slot.draft.day_of_week, list)
      }
    }
    for (const list of byDay.values()) {
      const sorted = [...list].sort((a, b) => a.start - b.start)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end)
      }
    }
  })
})

describe('buildSampleData — eventos de calendario', () => {
  it('todos pasan la validación de Zod', () => {
    for (const event of data.calendarEvents) {
      expect(CalendarEventSchema.safeParse(event).success).toBe(true)
    }
  })

  it('todos viven en SAMPLE_YEAR', () => {
    for (const event of data.calendarEvents) {
      expect(event.date.startsWith(`${SAMPLE_YEAR}-`)).toBe(true)
    }
  })

  it('todos son locales: calendarId "local" e id con prefijo local_', () => {
    for (const event of data.calendarEvents) {
      expect(event.calendarId).toBe('local')
      expect(event.id.startsWith('local_')).toBe(true)
    }
  })

  it('start y end coinciden con el día del evento y son ISO con Z', () => {
    for (const event of data.calendarEvents) {
      expect(event.start.startsWith(event.date)).toBe(true)
      expect(event.end.startsWith(event.date)).toBe(true)
      expect(event.end > event.start).toBe(true)
      expect(event.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })
})

describe('buildSampleData — formato general', () => {
  it('todos los ids son UUIDs válidos', () => {
    const ids = [
      ...data.habits.map((x) => x.id),
      ...data.habitLogs.map((x) => x.id),
      ...data.tasks.map((x) => x.id),
      ...data.goals.map((x) => x.id),
      ...data.goalLogs.map((x) => x.id),
      ...data.notes.map((x) => x.id),
      ...data.scheduleBlocks.map((x) => x.id),
      ...data.scheduleBlocks.flatMap((b) => b.slots.map((s) => s.id)),
    ]
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(uuid.safeParse(id).success).toBe(true)
    }
  })

  it('todos los created_at son timestamps ISO válidos', () => {
    const timestamps = [
      ...data.habits.map((x) => x.created_at),
      ...data.habitLogs.map((x) => x.created_at),
      ...data.tasks.map((x) => x.created_at),
      ...data.goals.map((x) => x.created_at),
      ...data.goalLogs.map((x) => x.created_at),
      ...data.notes.map((x) => x.created_at),
      ...data.scheduleBlocks.map((x) => x.created_at),
      ...data.scheduleBlocks.flatMap((b) => b.slots.map((s) => s.created_at)),
    ]
    for (const ts of timestamps) {
      expect(isoTimestamp.safeParse(ts).success).toBe(true)
    }
  })

  it('los textos están en español y no son placeholder', () => {
    const allText = [
      ...data.habits.map((h) => h.draft.name),
      ...data.tasks.map((t) => t.draft.title),
      ...data.goals.map((g) => g.draft.title),
      ...data.notes.map((n) => n.draft.title ?? ''),
      ...data.scheduleBlocks.map((b) => b.draft.title),
    ].join(' | ')
    expect(allText.toLowerCase()).not.toContain('lorem')
    expect(allText.toLowerCase()).not.toContain('example')
    expect(allText.toLowerCase()).not.toContain('sample')
  })
})
