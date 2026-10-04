// =============================================================
// stores/habits.ts
//
// Estado global de hábitos + logs. Aquí vive TODA la lógica de
// negocio del lado frontend: generación de IDs, timestamps, fechas
// locales, normalización, deduplicación, orden, etc.
// =============================================================

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as db from '../lib/db'
import {
  type CreateHabitDraft,
  type CreateHabitLogDraft,
  type Habit,
  type HabitFrequency,
  type HabitLog,
  rowToHabit,
  rowToHabitLog,
  type UpdateHabitDraft,
} from '../schemas/habits'

// ───────────────────────────────────────────────────────────────
// Helpers de fecha (TS puro — no se delega a Rust ni a SQL)
// ───────────────────────────────────────────────────────────────

function nowIsoUtc(): string {
  return new Date().toISOString()
}

function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function uuidv4(): string {
  // crypto.randomUUID() está disponible en WebView2, WebKitGTK y navegadores modernos.
  return crypto.randomUUID()
}

// ───────────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────────

export const useHabitsStore = defineStore('habits', () => {
  // ── estado reactivo ─────────────────────────────────────────
  const habits = ref<Habit[]>([])
  const logs = ref<HabitLog[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  // ── getters ────────────────────────────────────────────────
  const activeHabits = computed(() => habits.value.filter((h) => h.archived_at === null))

  const archivedHabits = computed(() => habits.value.filter((h) => h.archived_at !== null))

  const logsByHabit = computed(() => {
    const map = new Map<string, HabitLog[]>()
    for (const log of logs.value) {
      const list = map.get(log.habit_id) ?? []
      list.push(log)
      map.set(log.habit_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
    }
    return map
  })

  const completedToday = computed(() => {
    const today = todayLocalDate()
    const map = new Map<string, number>()
    for (const l of logs.value) {
      if (l.log_date === today) {
        map.set(l.habit_id, l.count)
      }
    }
    return map
  })

  function isCompletedToday(habitId: string): boolean {
    return (completedToday.value.get(habitId) ?? 0) >= 1
  }

  // ── acciones: hábitos ──────────────────────────────────────
  async function loadHabits(includeArchived = false): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows = await db.listHabits(includeArchived)
      habits.value = rows.map(rowToHabit)
    } catch (e) {
      lastError.value = errMsg(e)
    } finally {
      loading.value = false
    }
  }

  async function createHabit(draft: CreateHabitDraft): Promise<Habit> {
    const now = nowIsoUtc()
    const id = uuidv4()
    const row = await db.createHabit(draft, id, now, now)
    const habit = rowToHabit(row)
    habits.value = [...habits.value, habit]
    return habit
  }

  async function updateHabit(id: string, patch: UpdateHabitDraft): Promise<Habit> {
    const now = nowIsoUtc()
    const row = await db.updateHabit(id, patch, now)
    const habit = rowToHabit(row)
    habits.value = habits.value.map((h) => (h.id === id ? habit : h))
    return habit
  }

  async function archiveHabit(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.archiveHabit(id, now)
    habits.value = habits.value.map((h) =>
      h.id === id ? { ...h, archived_at: now, updated_at: now } : h
    )
  }

  async function restoreHabit(id: string): Promise<void> {
    const now = nowIsoUtc()
    await db.restoreHabit(id, now)
    habits.value = habits.value.map((h) =>
      h.id === id ? { ...h, archived_at: null, updated_at: now } : h
    )
  }

  // ── acciones: logs ─────────────────────────────────────────
  async function loadLogsForRange(
    fromDate: string,
    toDate: string,
    habitId?: string
  ): Promise<void> {
    const rows = await db.listLogsInRange(fromDate, toDate, habitId)
    const newLogs = rows.map(rowToHabitLog)
    if (habitId) {
      const others = logs.value.filter((l) => l.habit_id !== habitId)
      logs.value = [...others, ...newLogs]
    } else {
      logs.value = newLogs
    }
  }

  async function incrementCheckIn(habitId: string): Promise<HabitLog> {
    const habit = habits.value.find((h) => h.id === habitId)
    if (!habit) throw new Error(`incrementCheckIn: hábito no encontrado (${habitId})`)
    const log_date = todayLocalDate()
    const existing = logs.value.find((l) => l.habit_id === habitId && l.log_date === log_date)
    const target = habit.frequency.target_per_period
    const newCount = Math.min((existing?.count ?? 0) + 1, target)

    const draft: CreateHabitLogDraft = {
      habit_id: habitId,
      log_date,
      count: newCount,
      note: existing?.note ?? null,
    }
    const id = existing?.id ?? uuidv4()
    const now = existing?.created_at ?? nowIsoUtc()
    const row = await db.upsertHabitLog(draft, id, now, now)
    const log = rowToHabitLog(row)
    logs.value = [...logs.value.filter((l) => l.id !== log.id), log]
    return log
  }

  async function resetCheckIn(habitId: string): Promise<void> {
    const log_date = todayLocalDate()
    const existing = logs.value.find((l) => l.habit_id === habitId && l.log_date === log_date)
    if (!existing) return
    await db.deleteLog(existing.id)
    logs.value = logs.value.filter((l) => l.id !== existing.id)
  }

  async function decrementCheckIn(habitId: string): Promise<void> {
    const log_date = todayLocalDate()
    const existing = logs.value.find((l) => l.habit_id === habitId && l.log_date === log_date)
    if (!existing) return
    if (existing.count <= 1) {
      await db.deleteLog(existing.id)
      logs.value = logs.value.filter((l) => l.id !== existing.id)
      return
    }
    const draft: CreateHabitLogDraft = {
      habit_id: habitId,
      log_date,
      count: existing.count - 1,
      note: existing.note,
    }
    const row = await db.upsertHabitLog(
      draft,
      existing.id,
      existing.created_at,
      existing.created_at
    )
    const log = rowToHabitLog(row)
    logs.value = logs.value.map((l) => (l.id === log.id ? log : l))
  }

  // ── lógica de dominio: ¿le toca hoy? ───────────────────────
  function isHabitDueOn(habit: Habit, date: string): boolean {
    const f: HabitFrequency = habit.frequency
    if (f.type === 'daily') return true
    if (f.type === 'weekly') {
      // weekly sin days_of_week: le toca cualquier día (la meta es target_per_period por semana)
      return true
    }
    if (f.type === 'interval') {
      const start = new Date(habit.created_at)
      const target = new Date(date + 'T00:00:00')
      const diffDays = Math.floor((target.getTime() - start.getTime()) / 86_400_000)
      return diffDays >= 0 && diffDays % f.interval_days === 0
    }
    return false
  }

  function isHabitDueToday(habit: Habit): boolean {
    return isHabitDueOn(habit, todayLocalDate())
  }

  // ── lógica de dominio: racha actual ────────────────────────
  function currentStreak(habitId: string): number {
    const habit = habits.value.find((h) => h.id === habitId)
    if (!habit) return 0
    const set = new Set(logs.value.filter((l) => l.habit_id === habitId).map((l) => l.log_date))
    let streak = 0
    const cursor = new Date()
    while (true) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${d}`
      if (set.has(key)) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else {
        // Permitimos que "hoy" no esté marcado aún sin romper la racha
        if (streak === 0 && key === todayLocalDate()) {
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        break
      }
    }
    return streak
  }

  function getTodayDate(): string {
    return todayLocalDate()
  }

  function streakFor(habitId: string): number {
    return currentStreak(habitId)
  }

  function clearError(): void {
    lastError.value = null
  }

  /** Vacía el contenido en memoria (hábitos y check-in). Para «Borrar datos». */
  function reset(): void {
    habits.value = []
    logs.value = []
    lastError.value = null
  }

  async function loadInitialData(): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows = await db.listHabits(true)
      habits.value = rows.map(rowToHabit)
      // 364 días de grilla + 1: cubre todo el heatmap visible
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 364)
      const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`
      const to = todayLocalDate()
      const logRows = await db.listLogsInRange(from, to)
      const validLogs: HabitLog[] = []
      for (const row of logRows) {
        try {
          validLogs.push(rowToHabitLog(row))
        } catch (e) {
          console.warn('[loadInitialData] Log inválido ignorado:', row, e)
        }
      }
      logs.value = validLogs
    } catch (e) {
      lastError.value = errMsg(e)
    } finally {
      loading.value = false
    }
  }

  return {
    // estado
    habits,
    logs,
    loading,
    lastError,
    // getters
    activeHabits,
    archivedHabits,
    logsByHabit,
    completedToday,
    isCompletedToday,
    // hábitos
    loadHabits,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    // logs
    loadLogsForRange,
    incrementCheckIn,
    decrementCheckIn,
    resetCheckIn,
    // boot
    loadInitialData,
    reset,
    // lógica de dominio
    isHabitDueOn,
    isHabitDueToday,
    currentStreak,
    streakFor,
    getTodayDate,
    clearError,
  }
})

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
