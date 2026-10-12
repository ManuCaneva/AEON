import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as db from '@/lib/db'
import {
  rowToExam,
  type Exam,
  type CreateExamDraft,
  type UpdateExamDraft,
  type ExamRow,
} from '@/schemas/exams'
import { useWeeklyScheduleStore } from './weeklySchedule'
import type { BlockColorToken, ScheduleBlock } from '@/schemas/weeklySchedule'

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
    const row = await db.createExam(draft, id, now, now)
    const exam = rowToExam(row)
    setExams([...exams.value, exam])
    return exam
  }

  async function updateExam(id: string, patch: UpdateExamDraft): Promise<Exam> {
    const now = nowIsoUtc()
    const row = await db.updateExam(id, patch, now)
    const exam = rowToExam(row)
    setExams(exams.value.map((e) => (e.id === id ? exam : e)))
    return exam
  }

  async function deleteExam(id: string): Promise<void> {
    await db.deleteExam(id)
    exams.value = exams.value.filter((e) => e.id !== id)
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

  /** Invierte `completed` del tema; NO cambia el estado del examen. */
  async function toggleTopic(examId: string, topicId: string): Promise<void> {
    const exam = exams.value.find((e) => e.id === examId)
    if (!exam) return
    await updateExam(examId, {
      topics: exam.topics.map((t) => (t.id === topicId ? { ...t, completed: !t.completed } : t)),
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
   * Color vivo del examen: el token del bloque mientras exista; si no, el
   * color de respaldo propio. Nunca se persiste el color derivado.
   */
  function colorFor(exam: Exam): BlockColorToken {
    return blockFor(exam)?.color ?? exam.fallback_color
  }

  return {
    exams,
    loading,
    lastError,
    reset,
    loadExams,
    createExam,
    updateExam,
    deleteExam,
    addTopic,
    updateTopic,
    removeTopic,
    toggleTopic,
    blockFor,
    colorFor,
  }
})
