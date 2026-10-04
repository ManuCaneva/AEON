import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as db from '@/lib/db'
import {
  rowToGoal,
  rowToGoalLog,
  type Goal,
  type GoalLog,
  type CreateGoalDraft,
  type UpdateGoalDraft,
  type GoalRow,
  type GoalLogRow,
  type CreateGoalLogDraft,
} from '@/schemas/goals'

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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function currentPeriodStart(goal: Goal, today: string): string {
  switch (goal.frequency.type) {
    case 'daily':
      return today
    case 'weekly':
      return getMonday(today)
    case 'interval': {
      const createdDate = goal.created_at.split('T')[0]
      if (!createdDate) return today
      const daysDiff = Math.round(
        (new Date(localDateToIso(today)).getTime() -
          new Date(localDateToIso(createdDate)).getTime()) /
          86400000
      )
      const intervalDays = goal.frequency.interval_days
      const periodsPassed = Math.floor(daysDiff / intervalDays)
      return addDays(createdDate, periodsPassed * intervalDays)
    }
  }
}

export function currentProgress(goal: Goal, logs: GoalLog[], today: string): number {
  const start = currentPeriodStart(goal, today)
  return logs
    .filter((l) => l.goal_id === goal.id && l.log_date >= start && l.log_date <= today)
    .reduce((sum, l) => sum + l.amount, 0)
}

export function progressPercent(goal: Goal, progress: number): number {
  return Math.min(progress / goal.target, 1)
}

export function isGoalComplete(goal: Goal, progress: number): boolean {
  return progress >= goal.target
}

export const useGoalsStore = defineStore('goals', () => {
  const goals = ref<Goal[]>([])
  const logs = ref<GoalLog[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  const activeGoals = computed(() => goals.value.filter((g) => g.archived_at === null))

  const archivedGoals = computed(() => goals.value.filter((g) => g.archived_at !== null))

  /** Vacía el contenido en memoria (objetivos y sus logs). Para «Borrar datos». */
  function reset(): void {
    goals.value = []
    logs.value = []
    lastError.value = null
  }

  async function loadGoals(includeArchived = false): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows: GoalRow[] = await db.listGoals(includeArchived)
      goals.value = rows.map(rowToGoal)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function loadLogsForRange(
    fromDate: string,
    toDate: string,
    goalId?: string
  ): Promise<void> {
    const rows: GoalLogRow[] = await db.listGoalLogsInRange(fromDate, toDate, goalId)
    logs.value = rows.map(rowToGoalLog)
  }

  async function createGoal(draft: CreateGoalDraft): Promise<Goal> {
    const now = nowIsoUtc()
    const id = uuidv4()
    const row = await db.createGoal(draft, id, now, now)
    const goal = rowToGoal(row)
    goals.value = [...goals.value, goal]
    return goal
  }

  async function updateGoal(id: string, patch: UpdateGoalDraft): Promise<Goal> {
    const now = nowIsoUtc()
    const row = await db.updateGoal(id, patch, now)
    const goal = rowToGoal(row)
    goals.value = goals.value.map((g) => (g.id === id ? goal : g))
    return goal
  }

  async function deleteGoal(id: string): Promise<void> {
    await db.deleteGoal(id)
    goals.value = goals.value.filter((g) => g.id !== id)
    logs.value = logs.value.filter((l) => l.goal_id !== id)
  }

  async function archiveGoal(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.archiveGoal(id, now)
    goals.value = goals.value.map((g) =>
      g.id === id ? { ...g, archived_at: now, updated_at: now } : g
    )
  }

  async function restoreGoal(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.restoreGoal(id, now)
    goals.value = goals.value.map((g) =>
      g.id === id ? { ...g, archived_at: null, updated_at: now } : g
    )
  }

  async function incrementLog(goalId: string, delta: number = 1): Promise<void> {
    const today = todayLocalDate()
    const existingLog = logs.value.find((l) => l.goal_id === goalId && l.log_date === today)

    const newAmount = existingLog ? existingLog.amount + delta : delta
    const draft: CreateGoalLogDraft = {
      goal_id: goalId,
      log_date: today,
      amount: newAmount,
    }

    const id = existingLog?.id || uuidv4()
    const now = existingLog?.created_at || nowIsoUtc()

    const row = await db.upsertGoalLog(draft, id, now)
    const log = rowToGoalLog(row)

    if (existingLog) {
      logs.value = logs.value.map((l) => (l.id === log.id ? log : l))
    } else {
      logs.value = [...logs.value, log]
    }
  }

  async function setLogAmount(goalId: string, amount: number): Promise<void> {
    const today = todayLocalDate()
    const existingLog = logs.value.find((l) => l.goal_id === goalId && l.log_date === today)

    if (amount <= 0) {
      if (existingLog) {
        await db.deleteGoalLog(existingLog.id)
        logs.value = logs.value.filter((l) => l.id !== existingLog.id)
      }
      return
    }

    const draft: CreateGoalLogDraft = {
      goal_id: goalId,
      log_date: today,
      amount,
    }

    const id = existingLog?.id || uuidv4()
    const now = existingLog?.created_at || nowIsoUtc()

    const row = await db.upsertGoalLog(draft, id, now)
    const log = rowToGoalLog(row)

    if (existingLog) {
      logs.value = logs.value.map((l) => (l.id === log.id ? log : l))
    } else {
      logs.value = [...logs.value, log]
    }
  }

  async function undoLog(goalId: string, logDate: string): Promise<void> {
    const log = logs.value.find((l) => l.goal_id === goalId && l.log_date === logDate)
    if (!log) return

    await db.deleteGoalLog(log.id)
    logs.value = logs.value.filter((l) => l.id !== log.id)
  }

  return {
    goals,
    logs,
    loading,
    lastError,
    activeGoals,
    archivedGoals,
    reset,
    loadGoals,
    loadLogsForRange,
    createGoal,
    updateGoal,
    deleteGoal,
    archiveGoal,
    restoreGoal,
    incrementLog,
    setLogAmount,
    undoLog,
  }
})
