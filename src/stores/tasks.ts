import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/lib/db'
import { blockColorRgb } from '@/lib/scheduleColors'
import { eventKey, type EventChoice, type LinkedEventItem } from '@/lib/entityEventLink'
import { createEntityEventLifecycle } from '@/lib/entityEventLifecycle'
import { taskInAgenda } from '@/lib/taskAgenda'
import {
  rowToTask,
  pruneEmptySteps,
  type Task,
  type TaskStep,
  type CreateTaskDraft,
  type UpdateTaskDraft,
  type TaskRow,
} from '@/schemas/tasks'
import type { ScheduleBlock } from '@/schemas/weeklySchedule'
import { useWeeklyScheduleStore } from './weeklySchedule'
import { useCalendarStore } from './calendar'

function nowIsoUtc(): string {
  return new Date().toISOString()
}

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function uuidv4(): string {
  return crypto.randomUUID()
}

function localDateToIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}

export function daysUntilDue(dueDate: string | null): number {
  if (!dueDate) return 0
  const today = todayLocalDate()
  const todayMs = new Date(localDateToIso(today)).getTime()
  const dueMs = new Date(localDateToIso(dueDate)).getTime()
  return Math.round((dueMs - todayMs) / 86400000)
}

export function urgencyLevel(dueDate: string | null): 'none' | 'overdue' | 'warning' | 'normal' {
  if (!dueDate) return 'none'
  const days = daysUntilDue(dueDate)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'warning'
  return 'normal'
}

export function deadlineProgress(createdIso: string, dueDate: string | null): number | null {
  if (!dueDate) return null
  const createdDate = createdIso.split('T')[0]
  if (!createdDate || dueDate <= createdDate) return null

  const today = todayLocalDate()
  const createdMs = new Date(localDateToIso(createdDate)).getTime()
  const dueMs = new Date(localDateToIso(dueDate)).getTime()
  const todayMs = new Date(localDateToIso(today)).getTime()

  if (todayMs >= dueMs) return 1
  if (todayMs <= createdMs) return 0

  return (todayMs - createdMs) / (dueMs - createdMs)
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  const activeTasks = computed(() => tasks.value.filter((t) => t.archived_at === null))

  const pendingTasks = computed(() => activeTasks.value.filter((t) => t.status !== 'done'))

  const doneTasks = computed(() => activeTasks.value.filter((t) => t.status === 'done'))

  /**
   * Claves de los eventos que ya representa una tarea en la agenda, para no
   * listarlos dos veces. La tarea se agenda el día del evento (su vencimiento
   * no manda), así que la clave no exige el mismo día. Una tarea archivada sin
   * completar no entra en la agenda y por eso no aporta su evento: si el evento
   * existe, debe verse una vez en «Otros».
   */
  const representedEventKeys = computed<Set<string>>(() => {
    const keys = new Set<string>()
    for (const task of tasks.value) {
      if (!taskInAgenda(task)) continue
      const link = task.event_link
      if (link) keys.add(eventKey(link.calendarId, link.eventId))
    }
    return keys
  })

  /**
   * Cómo se pinta el evento de cada tarea agendada: con el título y el color
   * de la tarea, nunca con los del evento de Google. Espeja
   * `representedEventKeys` (misma regla de agenda) para que calendario y
   * «Agenda del Día» se vean igual.
   */
  const linkedEventItems = computed<Map<string, LinkedEventItem>>(() => {
    const items = new Map<string, LinkedEventItem>()
    for (const task of tasks.value) {
      if (!taskInAgenda(task)) continue
      const link = task.event_link
      if (!link) continue
      items.set(eventKey(link.calendarId, link.eventId), {
        id: `task_${task.id}`,
        title: task.title,
        color: colorFor(task),
      })
    }
    return items
  })

  /** Vacía el contenido en memoria (tareas y sus pasos). Para «Borrar datos». */
  function reset(): void {
    tasks.value = []
    lastError.value = null
  }

  async function loadTasks(includeArchived = false): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows: TaskRow[] = await db.listTasks(includeArchived)
      tasks.value = rows.map(rowToTask)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createTask(draft: CreateTaskDraft): Promise<Task> {
    const now = nowIsoUtc()
    const id = uuidv4()
    // Las filas sin título se descartan antes de persistir: no bloquean el alta.
    const prepared: CreateTaskDraft =
      draft.steps !== undefined ? { ...draft, steps: pruneEmptySteps(draft.steps) } : draft
    const row = await db.createTask(prepared, id, now, now)
    const task = rowToTask(row)
    tasks.value = [...tasks.value, task]
    return task
  }

  async function updateTask(id: string, patch: UpdateTaskDraft): Promise<Task> {
    const now = nowIsoUtc()
    // Igual que al crear: sólo se filtran los pasos cuando el patch los trae.
    const prepared: UpdateTaskDraft =
      patch.steps !== undefined ? { ...patch, steps: pruneEmptySteps(patch.steps) } : patch
    const row = await db.updateTask(id, prepared, now)
    const task = rowToTask(row)
    tasks.value = tasks.value.map((t) => (t.id === id ? task : t))
    return task
  }

  async function deleteTask(id: string): Promise<void> {
    await db.deleteTask(id)
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  /**
   * Marca la tarea como terminada. No la archiva ni la saca de la lista: la
   * sección de tareas muestra las terminadas al final y se pueden desmarcar.
   */
  async function completeTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.updateTask(id, { status: 'done' }, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, status: 'done' as const, updated_at: now } : t
    )
  }

  async function uncompleteTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.updateTask(id, { status: 'doing' }, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, status: 'doing' as const, updated_at: now } : t
    )
  }

  async function toggleStep(taskId: string, stepId: string): Promise<void> {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return

    const updatedSteps: TaskStep[] = task.steps.map((s) =>
      s.id === stepId ? { ...s, done: !s.done } : s
    )

    await updateTask(taskId, { steps: updatedSteps })
  }

  /**
   * Bloque asociado (la materia), resuelto contra el Cronograma semanal.
   * Degrada en silencio: si no hay asociación o el bloque ya no existe
   * (borrado, SET NULL), devuelve undefined.
   */
  function blockFor(task: Task): ScheduleBlock | undefined {
    if (!task.block_id) return undefined
    return useWeeklyScheduleStore().blocksWithSlots.find((b) => b.id === task.block_id)
  }

  /**
   * Color vivo de la tarea: el del bloque mientras exista; si no, su color
   * manual. El color derivado nunca se persiste.
   */
  function colorFor(task: Task): string {
    const block = blockFor(task)
    return block ? blockColorRgb(block.color) : task.color
  }

  // Ciclo de vida del vínculo entidad→evento (ADR 0010), compartido con los
  // exámenes. La fecha de la tarea (`due_date`) es la fuente de verdad; sin
  // fecha no hay evento posible.
  const lifecycle = createEntityEventLifecycle<Task, CreateTaskDraft, UpdateTaskDraft>({
    calendar: () => useCalendarStore(),
    date: (task) => task.due_date ?? '',
    draftDate: (patch) => patch.due_date,
    link: (task) => task.event_link,
    find: (id) => tasks.value.find((t) => t.id === id),
    persistCreate: (draft) => createTask(draft),
    persistUpdate: (id, patch) => updateTask(id, patch),
    persistLink: (id, link) => updateTask(id, { event_link: link }),
    persistDelete: (id) => deleteTask(id),
    missingDateMessage: 'La tarea necesita una fecha para crear su evento.',
  })

  /**
   * Crea la tarea y, según la elección, su evento. La entidad se persiste
   * primero (es la fuente de verdad de su fecha y su título); recién después
   * se crea el evento. Si eso falla, la tarea queda SIN vínculo y el error se
   * devuelve para que la UI lo muestre.
   */
  async function createTaskWithEvent(
    draft: CreateTaskDraft,
    choice: EventChoice
  ): Promise<{ task: Task; eventError: string | null }> {
    const { entity, eventError } = await lifecycle.createWithEvent(draft, choice)
    return { task: entity, eventError }
  }

  /**
   * Edita la tarea y su evento. `none` limpia el vínculo (el evento queda
   * intacto); `existing` fija el vínculo elegido y, si el vínculo previo
   * seguía vigente y el título o la fecha cambiaron, actualiza ese evento;
   * `local`/`new` crean un evento nuevo y lo vinculan.
   */
  async function updateTaskWithEvent(
    id: string,
    patch: UpdateTaskDraft,
    choice: EventChoice
  ): Promise<{ task: Task; eventError: string | null }> {
    const { entity, eventError } = await lifecycle.updateWithEvent(id, patch, choice)
    return { task: entity, eventError }
  }

  /**
   * Borra la tarea y, si se pide, el evento de su vínculo vigente (mismo día).
   * Un vínculo huérfano o de otro día degrada en silencio: sólo se borra la
   * tarea.
   */
  async function deleteTaskWithEvent(id: string, deleteEvent: boolean): Promise<void> {
    await lifecycle.deleteWithEvent(id, deleteEvent)
  }

  return {
    tasks,
    loading,
    lastError,
    activeTasks,
    pendingTasks,
    doneTasks,
    representedEventKeys,
    linkedEventItems,
    reset,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    toggleStep,
    blockFor,
    colorFor,
    createTaskWithEvent,
    updateTaskWithEvent,
    deleteTaskWithEvent,
  }
})
