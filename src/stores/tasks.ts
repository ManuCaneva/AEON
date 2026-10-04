import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/lib/db'
import {
  rowToTask,
  type Task,
  type TaskStep,
  type CreateTaskDraft,
  type UpdateTaskDraft,
  type TaskRow,
} from '@/schemas/tasks'

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
    const row = await db.createTask(draft, id, now, now)
    const task = rowToTask(row)
    tasks.value = [...tasks.value, task]
    return task
  }

  async function updateTask(id: string, patch: UpdateTaskDraft): Promise<Task> {
    const now = nowIsoUtc()
    const row = await db.updateTask(id, patch, now)
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
  }
})
