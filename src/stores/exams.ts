import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as db from '@/lib/db'
import { blockColorRgb } from '@/lib/scheduleColors'
import {
  rowToExam,
  pruneEmptyTopics,
  type Exam,
  type CreateExamDraft,
  type UpdateExamDraft,
  type ExamRow,
} from '@/schemas/exams'
import { useWeeklyScheduleStore } from './weeklySchedule'
import { useCalendarStore } from './calendar'
import type { ScheduleBlock } from '@/schemas/weeklySchedule'
import type { DayOverlayByDate } from '@/schemas/calendar'
import { resolvedEntityLinkKeys } from '@/lib/entityEventLink'
import type { EventChoice } from '@/lib/entityEventLink'
import { createEntityEventLifecycle } from '@/lib/entityEventLifecycle'

function nowIsoUtc(): string {
  return new Date().toISOString()
}

function uuidv4(): string {
  return crypto.randomUUID()
}

/** Orden de la lista: fecha ascendente (el más próximo primero). */
function byDateAsc(a: Exam, b: Exam): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return 0
}

export const useExamsStore = defineStore('exams', () => {
  const exams = ref<Exam[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  /** Vacía el contenido en memoria (exámenes). Para «Borrar datos». */
  function reset(): void {
    exams.value = []
    lastError.value = null
  }

  function setExams(list: Exam[]): void {
    exams.value = [...list].sort(byDateAsc)
  }

  async function loadExams(): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows: ExamRow[] = await db.listExams()
      setExams(rows.map(rowToExam))
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createExam(draft: CreateExamDraft): Promise<Exam> {
    const now = nowIsoUtc()
    const id = uuidv4()
    // Las filas sin título se descartan antes de persistir: no bloquean el alta.
    const prepared: CreateExamDraft =
      draft.topics !== undefined ? { ...draft, topics: pruneEmptyTopics(draft.topics) } : draft
    const row = await db.createExam(prepared, id, now, now)
    const exam = rowToExam(row)
    setExams([...exams.value, exam])
    return exam
  }

  async function updateExam(id: string, patch: UpdateExamDraft): Promise<Exam> {
    const now = nowIsoUtc()
    // Igual que al crear: sólo se filtran los temas cuando el patch los trae.
    const prepared: UpdateExamDraft =
      patch.topics !== undefined ? { ...patch, topics: pruneEmptyTopics(patch.topics) } : patch
    const row = await db.updateExam(id, prepared, now)
    const exam = rowToExam(row)
    setExams(exams.value.map((e) => (e.id === id ? exam : e)))
    return exam
  }

  async function deleteExam(id: string): Promise<void> {
    await db.deleteExam(id)
    exams.value = exams.value.filter((e) => e.id !== id)
  }

  // Ciclo de vida del vínculo entidad→evento (ADR 0010), compartido con las
  // tareas. El store aporta la fecha (`date`), el título, el vínculo y la
  // persistencia; el runtime genérico orquesta el resto.
  const lifecycle = createEntityEventLifecycle<Exam, CreateExamDraft, UpdateExamDraft>({
    calendar: () => useCalendarStore(),
    date: (exam) => exam.date,
    draftDate: (patch) => patch.date,
    link: (exam) => exam.event_link,
    find: (id) => exams.value.find((e) => e.id === id),
    persistCreate: (draft) => createExam(draft),
    persistUpdate: (id, patch) => updateExam(id, patch),
    persistLink: (id, link) => updateExam(id, { event_link: link }),
    persistDelete: (id) => deleteExam(id),
    missingDateMessage: 'El examen necesita una fecha para crear su evento.',
  })

  /**
   * Crea el examen y, según la elección, su evento. El examen se persiste
   * primero (es la fuente de verdad de su fecha y su título); recién después
   * se crea el evento. Si eso falla, el examen queda SIN vínculo y el error se
   * devuelve para que la UI lo muestre y se reintente desde edición.
   */
  async function createExamWithEvent(
    draft: CreateExamDraft,
    choice: EventChoice
  ): Promise<{ exam: Exam; eventError: string | null }> {
    const { entity, eventError } = await lifecycle.createWithEvent(draft, choice)
    return { exam: entity, eventError }
  }

  /**
   * Edita el examen y su evento. `none` limpia el vínculo (el evento queda
   * intacto); `existing` fija el vínculo elegido y, si el vínculo previo
   * seguía vigente y el título o la fecha cambiaron, actualiza ese evento;
   * `local`/`new` crean un evento nuevo y lo vinculan.
   */
  async function updateExamWithEvent(
    id: string,
    patch: UpdateExamDraft,
    choice: EventChoice
  ): Promise<{ exam: Exam; eventError: string | null }> {
    const { entity, eventError } = await lifecycle.updateWithEvent(id, patch, choice)
    return { exam: entity, eventError }
  }

  /**
   * Borra el examen y, si se pide, el evento de su vínculo vigente (mismo
   * día). Un vínculo huérfano o de otro día degrada en silencio: sólo se borra
   * el examen.
   */
  async function deleteExamWithEvent(id: string, deleteEvent: boolean): Promise<void> {
    await lifecycle.deleteWithEvent(id, deleteEvent)
  }

  /** Temas: lista embebida. Cada acción persiste vía updateExam. */

  async function addTopic(examId: string, title: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: [...exam.topics, { id: uuidv4(), title, completed: false }],
    })
  }

  async function updateTopic(examId: string, topicId: string, title: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) => (t.id === topicId ? { ...t, title } : t)),
    })
  }

  async function removeTopic(examId: string, topicId: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.filter((t) => t.id !== topicId),
    })
  }

  /**
   * Invierte `completed` del tema; NO cambia el estado del examen. Marcar el
   * tema marca todos sus subtemas de una sola acción; desmarcarlo no toca los
   * subtemas (no hay propagación inversa).
   */
  async function toggleTopic(examId: string, topicId: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) => {
        if (t.id !== topicId) return t
        if (t.completed) return { ...t, completed: false }
        return {
          ...t,
          completed: true,
          subtopics: t.subtopics.map((s) => ({ ...s, completed: true })),
        }
      }),
    })
  }

  /** Subtemas: lista embebida de un tema. Cada acción persiste vía updateExam. */

  async function addSubtopic(examId: string, topicId: string, title: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) =>
        t.id === topicId
          ? { ...t, subtopics: [...t.subtopics, { id: uuidv4(), title, completed: false }] }
          : t
      ),
    })
  }

  async function updateSubtopic(
    examId: string,
    topicId: string,
    subtopicId: string,
    title: string
  ): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) =>
        t.id === topicId
          ? {
              ...t,
              subtopics: t.subtopics.map((s) => (s.id === subtopicId ? { ...s, title } : s)),
            }
          : t
      ),
    })
  }

  async function removeSubtopic(
    examId: string,
    topicId: string,
    subtopicId: string
  ): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) =>
        t.id === topicId ? { ...t, subtopics: t.subtopics.filter((s) => s.id !== subtopicId) } : t
      ),
    })
  }

  /** Invierte `completed` del subtema; no toca el tema ni los demás subtemas. */
  async function toggleSubtopic(
    examId: string,
    topicId: string,
    subtopicId: string
  ): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) =>
        t.id === topicId
          ? {
              ...t,
              subtopics: t.subtopics.map((s) =>
                s.id === subtopicId ? { ...s, completed: !s.completed } : s
              ),
            }
          : t
      ),
    })
  }

  /**
   * Bloque asociado (la materia), resuelto contra el Cronograma semanal.
   * Degrada en silencio: si no hay asociación o el bloque ya no existe
   * (borrado, SET NULL), devuelve undefined.
   */
  function blockFor(exam: Exam): ScheduleBlock | undefined {
    if (!exam.block_id) return undefined
    return useWeeklyScheduleStore().blocksWithSlots.find((b) => b.id === exam.block_id)
  }

  /**
   * Color vivo del examen como color CSS: el del bloque mientras exista; si
   * no, el de respaldo. Nunca se persiste. Misma forma que `tasks.colorFor`,
   * para que las vistas no tengan que envolver uno sí y el otro no.
   */
  function colorFor(exam: Exam): string {
    return blockColorRgb(blockFor(exam)?.color ?? exam.fallback_color)
  }

  /**
   * Overlay derivado para el Calendario anual: cada examen es un punto más,
   * agrupado por fecha, con su color vivo ya resuelto a variable CSS. No crea
   * ningún evento espejo: el examen sigue siendo la única fuente de su fecha.
   * El id usa el prefijo `exam_` (nunca `local_`, que el calendario trataría
   * como evento local editable).
   */
  const overlayByDate = computed<DayOverlayByDate>(() => {
    const map: DayOverlayByDate = new Map()
    for (const exam of exams.value) {
      const dot = { id: `exam_${exam.id}`, color: colorFor(exam) }
      const list = map.get(exam.date)
      if (list) list.push(dot)
      else map.set(exam.date, [dot])
    }
    return map
  })

  /**
   * Claves de los eventos del calendario que ya están vinculados a un examen
   * del mismo día. El calendario anual las omite para no pintar dos puntos el
   * mismo día (el punto del examen se conserva). Un vínculo huérfano o de otro
   * día no aporta clave: degrada en silencio.
   */
  const linkedEventKeys = computed<Set<string>>(() =>
    resolvedEntityLinkKeys(exams.value, useCalendarStore().events)
  )

  return {
    exams,
    loading,
    lastError,
    reset,
    loadExams,
    createExam,
    updateExam,
    deleteExam,
    createExamWithEvent,
    updateExamWithEvent,
    deleteExamWithEvent,
    addTopic,
    updateTopic,
    removeTopic,
    toggleTopic,
    addSubtopic,
    updateSubtopic,
    removeSubtopic,
    toggleSubtopic,
    blockFor,
    colorFor,
    overlayByDate,
    linkedEventKeys,
  }
})
