import { z } from 'zod'
import { uuid, isoTimestamp, localDate, hexColor, trimmed, normalizeTimestamp } from './primitives'

export const TaskStatusSchema = z.enum(['todo', 'doing', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskStepSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  done: z.boolean(),
})
export type TaskStep = z.infer<typeof TaskStepSchema>

/**
 * Descarta los pasos sin título antes de persistirlos: una fila vacía en el
 * editor no bloquea el alta de la tarea. La validación del paso persistido
 * (`title` no vacío) sigue vigente, pero se aplica recién sobre lo que llega
 * a la fila.
 */
export function pruneEmptySteps(steps: TaskStep[]): TaskStep[] {
  return steps.filter((step) => step.title.trim() !== '')
}

export const TaskSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  description: z.string().trim().max(500).nullable().default(null),
  color: hexColor,
  status: TaskStatusSchema,
  due_date: localDate.nullable().default(null),
  steps: TaskStepSchema.array().default([]),
  sort_order: z.number().int().default(0),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
  archived_at: isoTimestamp.nullable().default(null),
})
export type Task = z.infer<typeof TaskSchema>

export const CreateTaskDraftSchema = z.object({
  title: trimmed(1, 100),
  description: z.string().trim().max(500).nullable().optional(),
  color: hexColor,
  status: TaskStatusSchema.default('todo'),
  due_date: localDate.optional(),
  steps: TaskStepSchema.array().default([]),
  sort_order: z.number().int().optional(),
})
export type CreateTaskDraft = z.infer<typeof CreateTaskDraftSchema>

export const UpdateTaskDraftSchema = CreateTaskDraftSchema.partial()
export type UpdateTaskDraft = z.infer<typeof UpdateTaskDraftSchema>

export const TaskRowSchema = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  status: z.string(),
  due_date: z.string().nullable(),
  steps: z.string(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable(),
})
export type TaskRow = z.infer<typeof TaskRowSchema>

export function rowToTask(row: TaskRow): Task {
  const steps: unknown = JSON.parse(row.steps)
  const parsedSteps = TaskStepSchema.array().parse(steps)

  return TaskSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    color: row.color,
    status: row.status,
    due_date: row.due_date,
    steps: parsedSteps,
    sort_order: row.sort_order,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
    archived_at: row.archived_at ? normalizeTimestamp(row.archived_at) : null,
  })
}

export function taskToRow(t: CreateTaskDraft | UpdateTaskDraft | Task): {
  title?: string
  description: string | null
  color?: string
  status: TaskStatus
  due_date: string | null
  steps: string
  sort_order: number
} {
  return {
    ...('title' in t && t.title !== undefined ? { title: t.title } : {}),
    ...('color' in t && t.color !== undefined ? { color: t.color } : {}),
    description: ('description' in t ? t.description : null) ?? null,
    status: ('status' in t ? t.status : 'todo') as TaskStatus,
    due_date: ('due_date' in t ? t.due_date : null) ?? null,
    steps: JSON.stringify('steps' in t && t.steps ? t.steps : []),
    sort_order: 'sort_order' in t && t.sort_order !== undefined ? t.sort_order : 0,
  }
}
