// =============================================================
// lib/db.ts — Único punto de contacto con Rust.
//
// Regla: todo lo que sale hacia Rust pasa por acá, y todo lo que
// vuelve de Rust se valida con Zod antes de llegar a un store.
// =============================================================

import { invoke } from '@tauri-apps/api/core'
import {
  CreateHabitDraftSchema,
  CreateHabitLogDraftSchema,
  type CreateHabitDraft,
  type CreateHabitLogDraft,
  HabitLogRowSchema,
  HabitRowSchema,
  type HabitLogRow,
  type HabitRow,
  type UpdateHabitDraft,
  UpdateHabitDraftSchema,
} from '../schemas/habits'
import {
  CreateTaskDraftSchema,
  type CreateTaskDraft,
  type UpdateTaskDraft,
  UpdateTaskDraftSchema,
  TaskRowSchema,
  type TaskRow,
  taskToRow,
} from '../schemas/tasks'
import {
  CreateNoteDraftSchema,
  type CreateNoteDraft,
  type UpdateNoteDraft,
  UpdateNoteDraftSchema,
  NoteRowSchema,
  type NoteRow,
  noteToRow,
} from '../schemas/notes'
import {
  CreateGoalDraftSchema,
  type CreateGoalDraft,
  type UpdateGoalDraft,
  UpdateGoalDraftSchema,
  GoalRowSchema,
  type GoalRow,
  CreateGoalLogDraftSchema,
  type CreateGoalLogDraft,
  GoalLogRowSchema,
  type GoalLogRow,
  goalToRow,
} from '../schemas/goals'
import {
  CreateScheduleBlockDraftSchema,
  CreateScheduleSlotDraftSchema,
  ScheduleBlockRowSchema,
  ScheduleSlotRowSchema,
  UpdateScheduleBlockDraftSchema,
  WeeklyScheduleSettingsSchema,
  DEFAULT_WEEKLY_SCHEDULE_SETTINGS,
  type CreateScheduleBlockDraft,
  type CreateScheduleSlotDraft,
  type ScheduleBlockRow,
  type ScheduleSlotRow,
  type UpdateScheduleBlockDraft,
  type WeeklyScheduleSettings,
} from '../schemas/weeklySchedule'
import {
  GcalVisibleCalendarsSchema,
  parseGcalVisibleCalendarsJson,
  type GcalVisibleCalendars,
} from '../schemas/calendar'
import { DATA_CONFIG_KEYS, DATA_TABLES } from './dataScope'

// ───────────────────────────────────────────────────────────────
// Hábitos
// ───────────────────────────────────────────────────────────────

export async function createHabit(
  draft: CreateHabitDraft,
  id: string,
  created_at: string,
  updated_at: string
): Promise<HabitRow> {
  const validated = CreateHabitDraftSchema.parse(draft)
  const raw = await invoke<unknown>('create_habit', {
    input: {
      id,
      name: validated.name,
      description: validated.description ?? null,
      icon: validated.icon ?? null,
      color: validated.color,
      frequency: validated.frequency,
      sort_order: validated.sort_order ?? 0,
      created_at,
      updated_at,
    },
  })
  return HabitRowSchema.parse(raw)
}

export async function listHabits(includeArchived = false): Promise<HabitRow[]> {
  const raw = await invoke<unknown>('list_habits', { includeArchived })
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => HabitRowSchema.parse(r))
}

export async function updateHabit(
  id: string,
  patch: UpdateHabitDraft,
  updated_at: string
): Promise<HabitRow> {
  const validated = UpdateHabitDraftSchema.parse(patch)
  const input = {
    id,
    name: validated.name,
    description: validated.description ?? undefined,
    icon: validated.icon ?? undefined,
    color: validated.color,
    frequency: validated.frequency,
    sort_order: validated.sort_order,
    updated_at,
  }
  const raw = await invoke<unknown>('update_habit', { input })
  return HabitRowSchema.parse(raw)
}

export async function archiveHabit(id: string, archived_at: string): Promise<void> {
  await invoke('archive_habit', { id, archivedAt: archived_at })
}

export async function restoreHabit(id: string, updated_at: string): Promise<void> {
  await invoke('restore_habit', { id, updatedAt: updated_at })
}

// ───────────────────────────────────────────────────────────────
// Logs
// ───────────────────────────────────────────────────────────────

export async function deleteLog(id: string): Promise<void> {
  await invoke('delete_log', { id })
}

export async function upsertHabitLog(
  draft: CreateHabitLogDraft,
  id: string,
  completed_at: string,
  created_at: string
): Promise<HabitLogRow> {
  const validated = CreateHabitLogDraftSchema.parse(draft)
  if (!validated.log_date) {
    throw new Error('upsertHabitLog: log_date es obligatorio (calcular en el store)')
  }
  const raw = await invoke<unknown>('upsert_habit_log', {
    input: {
      id,
      habit_id: validated.habit_id,
      log_date: validated.log_date,
      completed_at,
      note: validated.note ?? null,
      count: validated.count ?? 1,
      created_at,
    },
  })
  return HabitLogRowSchema.parse(raw)
}

export async function listLogsInRange(
  fromDate: string, // YYYY-MM-DD
  toDate: string,
  habitId?: string
): Promise<HabitLogRow[]> {
  const raw = await invoke<unknown>('list_logs_in_range', {
    habitId: habitId ?? null,
    fromDate,
    toDate,
  })
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => HabitLogRowSchema.parse(r))
}

// ───────────────────────────────────────────────────────────────
// Tasks
// ───────────────────────────────────────────────────────────────

export async function createTask(
  draft: CreateTaskDraft,
  id: string,
  created_at: string,
  updated_at: string
): Promise<TaskRow> {
  const validated = CreateTaskDraftSchema.parse(draft)
  const row = taskToRow(validated)
  const raw = await invoke<unknown>('create_task', {
    input: {
      id,
      title: row.title,
      description: row.description,
      color: row.color,
      status: row.status,
      due_date: row.due_date,
      steps: row.steps,
      sort_order: row.sort_order,
      created_at,
      updated_at,
    },
  })
  return TaskRowSchema.parse(raw)
}

export async function listTasks(includeArchived = false): Promise<TaskRow[]> {
  const raw = await invoke<unknown>('list_tasks', { includeArchived })
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => TaskRowSchema.parse(r))
}

export async function updateTask(
  id: string,
  patch: UpdateTaskDraft,
  updated_at: string
): Promise<TaskRow> {
  const validated = UpdateTaskDraftSchema.parse(patch)
  const row = taskToRow(validated)
  const raw = await invoke<unknown>('update_task', {
    input: {
      id,
      title: row.title,
      description: row.description ?? undefined,
      color: row.color,
      status: row.status,
      due_date: row.due_date ?? undefined,
      steps: validated.steps !== undefined ? row.steps : undefined,
      sort_order: row.sort_order,
      updated_at,
    },
  })
  return TaskRowSchema.parse(raw)
}

export async function deleteTask(id: string): Promise<void> {
  await invoke('delete_task', { id })
}

export async function archiveTask(id: string, archived_at: string): Promise<void> {
  await invoke('archive_task', { id, archivedAt: archived_at })
}

export async function restoreTask(id: string, updated_at: string): Promise<void> {
  await invoke('restore_task', { id, updatedAt: updated_at })
}

// ───────────────────────────────────────────────────────────────
// Notes
// ───────────────────────────────────────────────────────────────

export async function createNote(
  draft: CreateNoteDraft,
  id: string,
  created_at: string,
  updated_at: string
): Promise<NoteRow> {
  const validated = CreateNoteDraftSchema.parse(draft)
  const row = noteToRow(validated)
  const raw = await invoke<unknown>('create_note', {
    input: {
      id,
      title: row.title,
      description: row.description,
      color: row.color,
      created_at,
      updated_at,
    },
  })
  return NoteRowSchema.parse(raw)
}

export async function listNotes(): Promise<NoteRow[]> {
  const raw = await invoke<unknown>('list_notes')
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => NoteRowSchema.parse(r))
}

export async function updateNote(
  id: string,
  patch: UpdateNoteDraft,
  updated_at: string
): Promise<NoteRow> {
  const validated = UpdateNoteDraftSchema.parse(patch)
  const raw = await invoke<unknown>('update_note', {
    input: {
      id,
      // Double-Option: undefined se omite al serializar (no toca),
      // null llega a Rust como Some(None) (limpia el campo).
      title: validated.title,
      description: validated.description,
      color: validated.color,
      updated_at,
    },
  })
  return NoteRowSchema.parse(raw)
}

export async function deleteNote(id: string): Promise<void> {
  await invoke('delete_note', { id })
}

// ───────────────────────────────────────────────────────────────
// Goals
// ───────────────────────────────────────────────────────────────

export async function createGoal(
  draft: CreateGoalDraft,
  id: string,
  created_at: string,
  updated_at: string
): Promise<GoalRow> {
  const validated = CreateGoalDraftSchema.parse(draft)
  const row = goalToRow(validated)
  const raw = await invoke<unknown>('create_goal', {
    input: {
      id,
      title: row.title,
      description: row.description,
      color: row.color,
      target: validated.target,
      unit: row.unit,
      frequency: {
        type: row.frequency_type,
        interval_days: row.interval_days,
        days_of_week: row.days_of_week,
      },
      sort_order: row.sort_order,
      created_at,
      updated_at,
    },
  })
  return GoalRowSchema.parse(raw)
}

export async function listGoals(includeArchived = false): Promise<GoalRow[]> {
  const raw = await invoke<unknown>('list_goals', { includeArchived })
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => GoalRowSchema.parse(r))
}

export async function updateGoal(
  id: string,
  patch: UpdateGoalDraft,
  updated_at: string
): Promise<GoalRow> {
  const validated = UpdateGoalDraftSchema.parse(patch)
  const row = goalToRow(validated)
  const raw = await invoke<unknown>('update_goal', {
    input: {
      id,
      title: row.title,
      description: row.description ?? undefined,
      color: row.color,
      target: validated.target,
      unit: row.unit ?? undefined,
      frequency: validated.frequency
        ? {
            type: validated.frequency.type,
            interval_days:
              validated.frequency.type === 'interval' ? validated.frequency.interval_days : null,
            days_of_week: null,
          }
        : undefined,
      sort_order: row.sort_order,
      updated_at,
    },
  })
  return GoalRowSchema.parse(raw)
}

export async function deleteGoal(id: string): Promise<void> {
  await invoke('delete_goal', { id })
}

export async function archiveGoal(id: string, archived_at: string): Promise<void> {
  await invoke('archive_goal', { id, archivedAt: archived_at })
}

export async function restoreGoal(id: string, updated_at: string): Promise<void> {
  await invoke('restore_goal', { id, updatedAt: updated_at })
}

// ───────────────────────────────────────────────────────────────
// Goal Logs
// ───────────────────────────────────────────────────────────────

export async function upsertGoalLog(
  draft: CreateGoalLogDraft,
  id: string,
  created_at: string
): Promise<GoalLogRow> {
  const validated = CreateGoalLogDraftSchema.parse(draft)
  if (!validated.log_date) {
    throw new Error('upsertGoalLog: log_date es obligatorio (calcular en el store)')
  }
  const raw = await invoke<unknown>('upsert_goal_log', {
    input: {
      id,
      goal_id: validated.goal_id,
      log_date: validated.log_date,
      amount: validated.amount ?? 1,
      note: validated.note ?? null,
      created_at,
    },
  })
  return GoalLogRowSchema.parse(raw)
}

export async function deleteGoalLog(id: string): Promise<void> {
  await invoke('delete_goal_log', { id })
}

export async function listGoalLogsInRange(
  fromDate: string, // YYYY-MM-DD
  toDate: string,
  goalId?: string
): Promise<GoalLogRow[]> {
  const raw = await invoke<unknown>('list_goal_logs_in_range', {
    goalId: goalId ?? null,
    fromDate,
    toDate,
  })
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => GoalLogRowSchema.parse(r))
}

// ───────────────────────────────────────────────────────────────
// Config (key-value persistida en SQLite)
// ───────────────────────────────────────────────────────────────

export async function saveConfig(key: string, value: string): Promise<void> {
  await invoke('save_config', { key, value })
}

export async function loadConfig(key: string): Promise<string | null> {
  const raw = await invoke<string | null>('load_config', { key })
  return raw
}

/**
 * Borra todo el contenido de la app (hábitos, tareas, objetivos, notas,
 * cronograma) y las claves de config que guardan datos, conservando el
 * resto de la configuración. El alcance vive en `dataScope.ts`; el
 * borrado lo ejecuta la capa de persistencia (Rust) en una transacción.
 */
export async function clearAllData(): Promise<void> {
  await invoke('clear_all_data', {
    tables: [...DATA_TABLES],
    dataConfigKeys: [...DATA_CONFIG_KEYS],
  })
}

// ───────────────────────────────────────────────────────────────
// Cronograma Semanal
// ───────────────────────────────────────────────────────────────

export async function listScheduleBlocks(): Promise<ScheduleBlockRow[]> {
  const raw = await invoke<unknown>('list_schedule_blocks')
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => ScheduleBlockRowSchema.parse(r))
}

export async function listScheduleSlots(): Promise<ScheduleSlotRow[]> {
  const raw = await invoke<unknown>('list_schedule_slots')
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((r) => ScheduleSlotRowSchema.parse(r))
}

export async function createScheduleBlock(
  draft: CreateScheduleBlockDraft,
  id: string,
  created_at: string,
  updated_at: string
): Promise<ScheduleBlockRow> {
  const v = CreateScheduleBlockDraftSchema.parse(draft)
  const raw = await invoke<unknown>('create_schedule_block', {
    input: { id, ...v, created_at, updated_at },
  })
  return ScheduleBlockRowSchema.parse(raw)
}

export async function createScheduleSlot(
  draft: CreateScheduleSlotDraft,
  id: string,
  block_id: string,
  created_at: string,
  updated_at: string
): Promise<ScheduleSlotRow> {
  const v = CreateScheduleSlotDraftSchema.parse(draft)
  const raw = await invoke<unknown>('create_schedule_slot', {
    input: { id, block_id, ...v, created_at, updated_at },
  })
  return ScheduleSlotRowSchema.parse(raw)
}

export async function updateScheduleBlock(
  id: string,
  patch: UpdateScheduleBlockDraft,
  updated_at: string
): Promise<ScheduleBlockRow> {
  const v = UpdateScheduleBlockDraftSchema.parse(patch)
  const raw = await invoke<unknown>('update_schedule_block', {
    input: { id, ...v, updated_at },
  })
  return ScheduleBlockRowSchema.parse(raw)
}

export async function updateScheduleSlot(
  id: string,
  patch: { day_of_week?: number; start_minutes?: number; end_minutes?: number },
  updated_at: string
): Promise<ScheduleSlotRow> {
  const raw = await invoke<unknown>('update_schedule_slot', {
    input: { id, ...patch, updated_at },
  })
  return ScheduleSlotRowSchema.parse(raw)
}

export async function deleteScheduleBlock(id: string): Promise<void> {
  await invoke('delete_schedule_block', { id })
}

export async function deleteScheduleSlot(id: string): Promise<void> {
  await invoke('delete_schedule_slot', { id })
}

// Settings persisten en config table (key weekly-schedule-settings)
export async function loadWeeklyScheduleSettings(): Promise<WeeklyScheduleSettings> {
  const json = await loadConfig('weekly-schedule-settings')
  if (!json) return DEFAULT_WEEKLY_SCHEDULE_SETTINGS
  return WeeklyScheduleSettingsSchema.parse(JSON.parse(json))
}

export async function saveWeeklyScheduleSettings(settings: WeeklyScheduleSettings): Promise<void> {
  const parsed = WeeklyScheduleSettingsSchema.parse(settings)
  await saveConfig('weekly-schedule-settings', JSON.stringify(parsed))
}

// Visibilidad de calendarios de Google: persiste en config table (key gcal-visible-calendars)
export const GCAL_VISIBLE_CALENDARS_KEY = 'gcal-visible-calendars'

export async function loadGcalVisibleCalendars(): Promise<GcalVisibleCalendars> {
  const json = await loadConfig(GCAL_VISIBLE_CALENDARS_KEY)
  return parseGcalVisibleCalendarsJson(json)
}

export async function saveGcalVisibleCalendars(prefs: GcalVisibleCalendars): Promise<void> {
  const parsed = GcalVisibleCalendarsSchema.parse(prefs)
  await saveConfig(GCAL_VISIBLE_CALENDARS_KEY, JSON.stringify(parsed))
}
