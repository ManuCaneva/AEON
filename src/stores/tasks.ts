import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/lib/db'
import { blockColorRgb } from '@/lib/scheduleColors'
import {
  eventKey,
  resolveEntityLink,
  type EntityEventLink,
  type EventChoice,
  type EventLinkedEntity,
} from '@/lib/entityEventLink'
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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Adapta la tarea a la forma genérica del resolutor de vínculos. */
function taskLinkEntity(task: Task): EventLinkedEntity {
  return { date: task.due_date ?? '', event_link: task.event_link }
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

  const archivedTasks = computed(() => tasks.value.filter((t) => t.archived_at !== null))

  const pendingTasks = computed(() => activeTasks.value.filter((t) => t.status !== 'done'))

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

  async function archiveTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.archiveTask(id, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, archived_at: now, updated_at: now } : t
    )
  }

  async function restoreTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.restoreTask(id, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, archived_at: null, updated_at: now } : t
    )
  }

  async function completeTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.updateTask(id, { status: 'done' }, now)
    await db.archiveTask(id, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, status: 'done' as const, archived_at: now, updated_at: now } : t
    )
  }

  async function uncompleteTask(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.updateTask(id, { status: 'doing' }, now)
    await db.restoreTask(id, now)
    tasks.value = tasks.value.map((t) =>
      t.id === id ? { ...t, status: 'doing' as const, archived_at: null, updated_at: now } : t
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

  /**
   * Crea el evento de la tarea (siempre de todo el día) y devuelve su vínculo.
   * `local` va al almacenamiento local; `new` al calendario elegido.
   */
  async function createEventForTask(task: Task, choice: EventChoice): Promise<EntityEventLink> {
    if (!task.due_date) throw new Error('La tarea necesita una fecha para crear su evento.')
    const calendar = useCalendarStore()
    const calendarId = choice.mode === 'new' ? choice.calendarId : 'local'
    const before = new Set(calendar.events.map((e) => eventKey(e.calendarId, e.id)))
    await calendar.createEvent(calendarId, {
      title: task.title,
      allDay: true,
      start: task.due_date,
      end: '',
    })
    const created = calendar.events.find((e) => !before.has(eventKey(e.calendarId, e.id)))
    if (!created) throw new Error('No se pudo resolver el evento recién creado.')
    return { calendarId: created.calendarId, eventId: created.id }
  }

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
    const link = choice.mode === 'existing' ? choice.link : null
    const task = await createTask({ ...draft, event_link: link })
    if (choice.mode !== 'local' && choice.mode !== 'new') {
      return { task, eventError: null }
    }
    try {
      const createdLink = await createEventForTask(task, choice)
      const linked = await updateTask(task.id, { event_link: createdLink })
      return { task: linked, eventError: null }
    } catch (e) {
      return { task, eventError: errorMessage(e) }
    }
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
    const calendar = useCalendarStore()
    const previous = tasks.value.find((t) => t.id === id)

    if (choice.mode === 'none') {
      const task = await updateTask(id, { ...patch, event_link: null })
      return { task, eventError: null }
    }

    if (choice.mode === 'existing') {
      const task = await updateTask(id, { ...patch, event_link: choice.link })
      const previousLink = previous?.event_link ?? null
      const sameEvent =
        previousLink !== null &&
        previousLink.calendarId === choice.link.calendarId &&
        previousLink.eventId === choice.link.eventId
      const wasVigente =
        previous !== undefined &&
        previousLink !== null &&
        resolveEntityLink(taskLinkEntity(previous), calendar.events) !== undefined
      const titleChanged =
        previous !== undefined && patch.title !== undefined && patch.title !== previous.title
      const dateChanged =
        previous !== undefined &&
        patch.due_date !== undefined &&
        patch.due_date !== previous.due_date
      if (wasVigente && sameEvent && (titleChanged || dateChanged)) {
        try {
          await calendar.updateEvent(choice.link.calendarId, choice.link.eventId, {
            title: task.title,
            allDay: true,
            start: task.due_date ?? '',
            end: '',
          })
        } catch (e) {
          return { task, eventError: errorMessage(e) }
        }
      }
      return { task, eventError: null }
    }

    // local | new: primero la entidad, después el evento.
    const task = await updateTask(id, patch)
    try {
      const createdLink = await createEventForTask(task, choice)
      const linked = await updateTask(id, { event_link: createdLink })
      return { task: linked, eventError: null }
    } catch (e) {
      return { task, eventError: errorMessage(e) }
    }
  }

  /**
   * Borra la tarea y, si se pide, el evento de su vínculo vigente (mismo día).
   * Un vínculo huérfano o de otro día degrada en silencio: sólo se borra la
   * tarea.
   */
  async function deleteTaskWithEvent(id: string, deleteEvent: boolean): Promise<void> {
    const task = tasks.value.find((t) => t.id === id)
    if (deleteEvent && task && task.event_link) {
      const resolved = resolveEntityLink(taskLinkEntity(task), useCalendarStore().events)
      if (resolved) {
        await useCalendarStore().deleteEvent(resolved.calendarId, resolved.id)
      }
    }
    await deleteTask(id)
  }

  return {
    tasks,
    loading,
    lastError,
    activeTasks,
    archivedTasks,
    pendingTasks,
    reset,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    archiveTask,
    restoreTask,
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
