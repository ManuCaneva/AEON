import { clearAllData } from '@/lib/db'
import { useHabitsStore } from '@/stores/habits'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useNotesStore } from '@/stores/notes'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useCalendarStore } from '@/stores/calendar'
import { usePomodoroStore } from '@/stores/pomodoro'

/**
 * «Borrar datos» — borra todo el contenido de la app y refresca el estado
 * en memoria para que el Dashboard quede vacío.
 *
 * Se conserva toda la configuración: distribución de Widgets, conexión y
 * tokens de Google Calendar, wallpaper, ajustes del cronograma y del
 * Pomodoro, preferencias de UI y la marca de primera ejecución. El
 * alcance exacto vive en `lib/dataScope.ts`.
 */
export async function clearAppData(): Promise<void> {
  await clearAllData()
  useHabitsStore().reset()
  useTasksStore().reset()
  useGoalsStore().reset()
  useNotesStore().reset()
  useWeeklyScheduleStore().reset()
  useCalendarStore().resetLocalEvents()
  usePomodoroStore().resetSession()
}
