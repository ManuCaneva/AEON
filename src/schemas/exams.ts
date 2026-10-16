import { z } from 'zod'
import { uuid, isoTimestamp, localDate, trimmed, normalizeTimestamp } from './primitives'
import { blockColorSchema } from './weeklySchedule'

// Capa dual de validación de Examen: dominio (lo que consume el frontend)
// + drafts (create/update) + fila permisiva (espejo de SQLite) + mappers.
// #133 (walking skeleton): id, título, fecha, estado, color de respaldo,
// orden y timestamps. #138 agrega la nota. #136 agrega los temas embebidos.
// #135 cablea el bloque asociado (materia) y el color vivo. La columna de
// vínculo al calendario existe en SQL pero se cablea en un ticket posterior.

export const ExamStatusSchema = z.enum(['pendiente', 'estudiando', 'rendido'])
export type ExamStatus = z.infer<typeof ExamStatusSchema>

// Tema del examen: lista embebida en la fila, igual que los Pasos de una
// Tarea. El `id` lo genera el store en TS con crypto.randomUUID.
export const ExamTopicSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  completed: z.boolean(),
})
export type ExamTopic = z.infer<typeof ExamTopicSchema>

/**
 * Descarta los temas sin título antes de persistirlos: una fila vacía en el
 * editor no bloquea el alta del examen. La validación del tema persistido
 * (`title` no vacío) sigue vigente, pero se aplica recién sobre lo que llega
 * a la fila.
 */
export function pruneEmptyTopics(topics: ExamTopic[]): ExamTopic[] {
  return topics.filter((topic) => topic.title.trim() !== '')
}

// Vínculo opcional a un evento del calendario. La identidad del evento es el
// PAR (calendarId, eventId): los ids de Google sólo son únicos por calendario.
// El examen NO crea ni espeja eventos: el vínculo es un adorno y la fecha del
// examen sigue siendo la única fuente de su fecha.
export const ExamEventLinkSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
})
export type ExamEventLink = z.infer<typeof ExamEventLinkSchema>

export const ExamSchema = z.object({
  id: uuid,
  title: trimmed(1, 100),
  date: localDate,
  status: ExamStatusSchema,
  grade: z.number().min(0).max(10).nullable(),
  // Bloque del Cronograma semanal (la materia). Opcional: null = sin bloque.
  block_id: uuid.nullable().default(null),
  fallback_color: blockColorSchema,
  // Vínculo opcional a un evento del calendario: null = sin vínculo.
  event_link: ExamEventLinkSchema.nullable().default(null),
  topics: ExamTopicSchema.array().default([]),
  sort_order: z.number().int().default(0),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
})
export type Exam = z.infer<typeof ExamSchema>

export const CreateExamDraftSchema = z.object({
  title: trimmed(1, 100),
  date: localDate,
  status: ExamStatusSchema.default('pendiente'),
  grade: z.number().min(0).max(10).nullable().optional(),
  block_id: uuid.nullable().default(null),
  fallback_color: blockColorSchema.default('lavender'),
  event_link: ExamEventLinkSchema.nullable().default(null),
  topics: ExamTopicSchema.array().default([]),
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
  const topics: unknown = JSON.parse(row.topics)
  const parsedTopics = ExamTopicSchema.array().parse(topics)

  return ExamSchema.parse({
    id: row.id,
    title: row.title,
    date: row.date,
    status: row.status,
    grade: row.grade,
    block_id: row.block_id,
    fallback_color: row.fallback_color,
    event_link: linkFromColumns(row.calendar_id, row.event_id),
    topics: parsedTopics,
    sort_order: row.sort_order,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  })
}

/** Reconstruye el par (calendarId, eventId) sólo si ambas columnas existen. */
function linkFromColumns(calendarId: string | null, eventId: string | null): ExamEventLink | null {
  if (!calendarId || !eventId) return null
  return { calendarId, eventId }
}

export function examToRow(e: CreateExamDraft | UpdateExamDraft | Exam): {
  title?: string
  date?: string
  status?: ExamStatus
  grade?: number | null
  block_id?: string | null
  fallback_color?: string
  calendar_id?: string | null
  event_id?: string | null
  topics: string
  sort_order?: number
} {
  return {
    ...('title' in e && e.title !== undefined ? { title: e.title } : {}),
    ...('date' in e && e.date !== undefined ? { date: e.date } : {}),
    ...('status' in e && e.status !== undefined ? { status: e.status } : {}),
    ...('grade' in e && e.grade !== undefined ? { grade: e.grade } : {}),
    ...('block_id' in e && e.block_id !== undefined ? { block_id: e.block_id } : {}),
    ...('fallback_color' in e && e.fallback_color !== undefined
      ? { fallback_color: e.fallback_color }
      : {}),
    // El par se persiste en dos columnas. `undefined` no toca ninguna;
    // `null` limpia ambas; un objeto las fija.
    ...('event_link' in e && e.event_link !== undefined
      ? {
          calendar_id: e.event_link?.calendarId ?? null,
          event_id: e.event_link?.eventId ?? null,
        }
      : {}),
    topics: JSON.stringify('topics' in e && e.topics ? e.topics : []),
    ...('sort_order' in e && e.sort_order !== undefined ? { sort_order: e.sort_order } : {}),
  }
}
