import * as db from '@/lib/db'
import {
  parsePomodoroMiniWindowStateJson,
  type PomodoroMiniWindowState,
} from '@/schemas/pomodoroMiniWindow'

/** Clave de la tabla `config` donde vive el estado de la ventana mini. */
export const POMODORO_MINI_WINDOW_KEY = 'pomodoro-mini-window'

/** Estado persistido de la ventana mini; corrupto o ausente → estado por defecto. */
export async function loadPomodoroMiniWindowState(): Promise<PomodoroMiniWindowState> {
  return parsePomodoroMiniWindowStateJson(await db.loadConfig(POMODORO_MINI_WINDOW_KEY))
}

/** Persiste el estado completo de la ventana mini. */
export async function savePomodoroMiniWindowState(state: PomodoroMiniWindowState): Promise<void> {
  await db.saveConfig(POMODORO_MINI_WINDOW_KEY, JSON.stringify(state))
}
