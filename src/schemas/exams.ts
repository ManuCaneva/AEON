import { z } from 'zod'
import { uuid, isoTimestamp, localDate, trimmed, normalizeTimestamp } from './primitives'
import { blockColorSchema } from './weeklySchedule'

// Capa dual de validación de Examen: dominio (lo que consume el frontend)
// + drafts (create/update) + fila permisiva (espejo de SQLite) + mappers.
// Alcance de #133 (walking skeleton): id, título, fecha, estado, color de
// respaldo, orden y timestamps. Las columnas T1 restantes (temas, bloque,
// nota, vínculo al calendario) existen en SQL pero se cablean en tickets
// posteriores.

export const ExamStatusSchema = z.enum(['pendiente', 'estudiando', 'rendido'])
export type ExamStatus = z.infer<typeof ExamStatusSchema>

export const ExamSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  date: localDate,
  status: ExamStatusSchema,
  fallback_color: blockColorSchema,
  sort_order: z.number().int().default(0),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
})
export type Exam = z.infer<typeof ExamSchema>

export const CreateExamDraftSchema = z.object({
  title: trimmed(1, 100),
  date: localDate,
  status: ExamStatusSchema.default('pendiente'),
  fallback_color: blockColorSchema.default('lavender'),
  sort_order: z.number().int().optional(),
})
// Tipo de ENTRADA: los defaults (estado, color) viven en el schema y quien
// crea un examen no necesita repetirlos.
export type CreateExamDraft = z.input<typeof CreateExamDraftSchema>

export const UpdateExamDraftSchema = CreateExamDraftSchema.partial()
export type UpdateExamDraft = z.input<typeof UpdateExamDraftSchema>

// Fila permisiva: refleja las columnas SQLite tal cual (sin trimear, con
// timestamps crudos y JSON de temas como string). La validación fuerte
// ocurre al mapear a dominio en `rowToExam`.
export const ExamRowSchema = z.object({
  id: uuid,
  title: z.string(),
  date: z.string(),
  status: z.string(),
  grade: z.number().nullable(),
  block_id: z.string().nullable(),
  fallback_color: z.string(),
  calendar_id: z.string().nullable(),
  event_id: z.string().nullable(),
  topics: z.string(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type ExamRow = z.infer<typeof ExamRowSchema>

export function rowToExam(row: ExamRow): Exam {
  return ExamSchema.parse({
    id: row.id,
    title: row.title,
    date: row.date,
    status: row.status,
    fallback_color: row.fallback_color,
    sort_order: row.sort_order,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  })
}

export function examToRow(e: CreateExamDraft | UpdateExamDraft | Exam): {
  title?: string
  date?: string
  status?: ExamStatus
  fallback_color?: string
  sort_order?: number
} {
  return {
    ...('title' in e && e.title !== undefined ? { title: e.title } : {}),
    ...('date' in e && e.date !== undefined ? { date: e.date } : {}),
    ...('status' in e && e.status !== undefined ? { status: e.status } : {}),
    ...('fallback_color' in e && e.fallback_color !== undefined
      ? { fallback_color: e.fallback_color }
      : {}),
    ...('sort_order' in e && e.sort_order !== undefined ? { sort_order: e.sort_order } : {}),
  }
}
