import {
  archiveTask,
  createGoal,
  createHabit,
  createNote,
  createScheduleBlock,
  createScheduleSlot,
  createTask,
  listGoalLogsInRange,
  listGoals,
  listHabits,
  listLogsInRange,
  listNotes,
  listScheduleBlocks,
  listScheduleSlots,
  listTasks,
  loadConfig,
  saveConfig,
  upsertGoalLog,
  upsertHabitLog,
} from '@/lib/db'
import { DATA_CONFIG_KEYS, DATA_TABLES, SEED_MARKER_KEY } from '@/lib/dataScope'
import type { SampleData } from '@/lib/sampleData'
import { buildSampleData } from '@/lib/sampleData'

// Reexportado para que los consumidores no dependan de dataScope.
export { SEED_MARKER_KEY }

const CALENDAR_EVENTS_KEY = DATA_CONFIG_KEYS[0]

const WIDE_FROM = '0000-01-01'
const WIDE_TO = '9999-12-31'

/** Chequea cada tabla de datos de DATA_TABLES con su lector correspondiente. */
const TABLE_CHECKERS: Record<(typeof DATA_TABLES)[number], () => Promise<unknown>> = {
  habits: () => listHabits(true),
  habit_logs: () => listLogsInRange(WIDE_FROM, WIDE_TO),
  goals: () => listGoals(true),
  goal_logs: () => listGoalLogsInRange(WIDE_FROM, WIDE_TO),
  tasks: () => listTasks(true),
  notes: () => listNotes(),
  schedule_blocks: () => listScheduleBlocks(),
  schedule_block_slots: () => listScheduleSlots(),
}

function isEmptyResult(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

async function isAppDataEmpty(): Promise<boolean> {
  const tableResults = await Promise.all(DATA_TABLES.map((table) => TABLE_CHECKERS[table]()))
  const configResults = await Promise.all(DATA_CONFIG_KEYS.map((key) => loadConfig(key)))
  return [...tableResults, ...configResults].every(isEmptyResult)
}

async function persist(data: SampleData): Promise<void> {
  for (const habit of data.habits) {
    await createHabit(habit.draft, habit.id, habit.created_at, habit.created_at)
  }
  for (const log of data.habitLogs) {
    await upsertHabitLog(
      { habit_id: log.habit_id, log_date: log.log_date, count: log.count },
      log.id,
      log.created_at,
      log.created_at
    )
  }
  for (const task of data.tasks) {
    await createTask(task.draft, task.id, task.created_at, task.created_at)
    if (task.draft.status === 'done') {
      await archiveTask(task.id, task.created_at)
    }
  }
  for (const goal of data.goals) {
    await createGoal(goal.draft, goal.id, goal.created_at, goal.created_at)
  }
  for (const log of data.goalLogs) {
    await upsertGoalLog(
      { goal_id: log.goal_id, log_date: log.log_date, amount: log.amount },
      log.id,
      log.created_at
    )
  }
  for (const note of data.notes) {
    await createNote(note.draft, note.id, note.created_at, note.created_at)
  }
  for (const block of data.scheduleBlocks) {
    await createScheduleBlock(block.draft, block.id, block.created_at, block.created_at)
    for (const slot of block.slots) {
      await createScheduleSlot(slot.draft, slot.id, block.id, slot.created_at, slot.created_at)
    }
  }
  await saveConfig(CALENDAR_EVENTS_KEY, JSON.stringify(data.calendarEvents))
}

/**
 * Siembra los datos de ejemplo solo en la primera ejecución real de la app:
 * no hay marcador y todas las tablas están vacías. El marcador se guarda
 * pase lo que pase, para no volver a sembrar nunca (ni tras "Borrar datos").
 *
 * @returns true si los datos de ejemplo se escribieron en esta corrida.
 */
export async function seedSampleDataIfFirstRun(): Promise<boolean> {
  let marker: string | null = null
  try {
    marker = await loadConfig(SEED_MARKER_KEY)
  } catch {
    return false
  }
  if (marker !== null) return false

  let seeded = false
  try {
    if (await isAppDataEmpty()) {
      await persist(buildSampleData())
      seeded = true
    }
  } catch (error) {
    console.error('seedSampleData: no se pudieron guardar los datos de ejemplo', error)
  }

  try {
    await saveConfig(SEED_MARKER_KEY, '1')
  } catch (error) {
    console.error('seedSampleData: no se pudo guardar el marcador', error)
  }

  return seeded
}
