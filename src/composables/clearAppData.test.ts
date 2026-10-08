import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clearAppData } from './clearAppData'
import { useHabitsStore } from '@/stores/habits'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useNotesStore } from '@/stores/notes'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useCalendarStore } from '@/stores/calendar'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useDashboardStore } from '@/stores/dashboard'
import { useUiStore } from '@/stores/ui'
import type { Habit, HabitLog } from '@/schemas/habits'
import type { Task } from '@/schemas/tasks'
import type { Goal, GoalLog } from '@/schemas/goals'
import type { Note } from '@/schemas/notes'
import {
  DEFAULT_WEEKLY_SCHEDULE_SETTINGS,
  type ScheduleBlockWithSlots,
} from '@/schemas/weeklySchedule'
import type { CalendarEvent } from '@/schemas/calendar'
import { defaultPomodoroSettings } from '@/schemas/pomodoro'

// La capa de persistencia se mockea por completo: este test fija el alcance
// (qué se borra y qué no se toca) sobre la orquestación de stores en memoria.
const dbMocks = vi.hoisted(() => ({
  clearAllData: vi.fn().mockResolvedValue(undefined),
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  loadGcalVisibleCalendars: vi.fn().mockResolvedValue({ hiddenCalendarIds: [] }),
  saveGcalVisibleCalendars: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => dbMocks)

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }))

const habit = { id: 'h1' } as unknown as Habit
const habitLog = { id: 'hl1', habit_id: 'h1' } as unknown as HabitLog
const task = { id: 't1' } as unknown as Task
const goal = { id: 'g1' } as unknown as Goal
const goalLog = { id: 'gl1', goal_id: 'g1' } as unknown as GoalLog
const note = { id: 'n1' } as unknown as Note
const block = { id: 'b1', slots: [{ id: 's1' }] } as unknown as ScheduleBlockWithSlots
const localEvent = {
  id: 'local_1',
  calendarId: 'local',
  date: '2026-01-01',
} as unknown as CalendarEvent
const gcalEvent = {
  id: 'gcal_1',
  calendarId: 'primary',
  date: '2026-01-02',
} as unknown as CalendarEvent

function seedAllData(): void {
  useHabitsStore().$patch({ habits: [habit], logs: [habitLog] })
  useTasksStore().$patch({ tasks: [task] })
  useGoalsStore().$patch({ goals: [goal], logs: [goalLog] })
  useNotesStore().$patch({ notes: [note] })
  useWeeklyScheduleStore().$patch({ blocksWithSlots: [block] })
  useCalendarStore().$patch({ events: [localEvent, gcalEvent] })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  dbMocks.loadConfig.mockResolvedValue(null)
  dbMocks.saveConfig.mockResolvedValue(undefined)
  dbMocks.loadGcalVisibleCalendars.mockResolvedValue({ hiddenCalendarIds: [] })
})

describe('clearAppData — alcance de borrado', () => {
  it('borra hábitos y check-ins', async () => {
    seedAllData()
    await clearAppData()

    const habits = useHabitsStore()
    expect(habits.habits).toEqual([])
    expect(habits.logs).toEqual([])
  })

  it('borra tareas y pasos', async () => {
    seedAllData()
    await clearAppData()

    expect(useTasksStore().tasks).toEqual([])
  })

  it('borra objetivos y logs', async () => {
    seedAllData()
    await clearAppData()

    const goals = useGoalsStore()
    expect(goals.goals).toEqual([])
    expect(goals.logs).toEqual([])
  })

  it('borra notas', async () => {
    seedAllData()
    await clearAppData()

    expect(useNotesStore().notes).toEqual([])
  })

  it('borra bloques y slots del cronograma pero conserva sus ajustes', async () => {
    seedAllData()
    const schedule = useWeeklyScheduleStore()
    schedule.$patch({ settings: { ...DEFAULT_WEEKLY_SCHEDULE_SETTINGS, granularity_minutes: 60 } })

    await clearAppData()

    expect(schedule.blocksWithSlots).toEqual([])
    expect(schedule.settings.granularity_minutes).toBe(60)
  })

  it('borra solo los eventos locales del calendario y conserva Google Calendar y sus tokens', async () => {
    seedAllData()
    const calendar = useCalendarStore()
    calendar.$patch({
      connected: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    await clearAppData()

    expect(calendar.events).toEqual([gcalEvent])
    expect(calendar.connected).toBe(true)
    expect(calendar.accessToken).toBe('access-token')
    expect(calendar.refreshToken).toBe('refresh-token')
  })

  it('reinicia la sesión del Pomodoro sin persistirla y conserva sus ajustes', async () => {
    seedAllData()
    const pomodoro = usePomodoroStore()
    pomodoro.$patch({
      settings: { ...defaultPomodoroSettings, focusMinutes: 40 },
      session: { phase: 'shortBreak', isRunning: true, endsAt: null, remainingMs: 1 },
    })

    await clearAppData()

    expect(pomodoro.session.phase).toBe('focus')
    expect(pomodoro.session.isRunning).toBe(false)
    expect(pomodoro.session.completedFocusSessions).toBe(0)
    expect(pomodoro.session.remainingMs).toBe(40 * 60_000)
    expect(pomodoro.remainingMs).toBe(40 * 60_000)
    expect(pomodoro.settings.focusMinutes).toBe(40)
    expect(dbMocks.saveConfig).not.toHaveBeenCalled()
  })

  it('conserva la distribución de Widgets', async () => {
    seedAllData()
    const dashboard = useDashboardStore()
    const layout = dashboard.layout
    const snapshot = JSON.stringify(layout)

    await clearAppData()

    expect(JSON.stringify(dashboard.layout)).toBe(snapshot)
    expect(dashboard.layout).toBe(layout)
  })

  it('no cambia de vista: conserva la vista activa y las preferencias de UI', async () => {
    seedAllData()
    const ui = useUiStore()
    ui.setViewMode('settings')
    ui.sidebarCollapsed = true

    await clearAppData()

    expect(ui.viewMode).toBe('settings')
    expect(ui.sidebarCollapsed).toBe(true)
  })

  it('delega el borrado a la persistencia una sola vez', async () => {
    seedAllData()

    await clearAppData()

    expect(dbMocks.clearAllData).toHaveBeenCalledTimes(1)
  })
})
