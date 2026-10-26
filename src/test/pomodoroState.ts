import { reactive } from 'vue'

/**
 * Estado del store de pomodoro para mockear `@/stores/pomodoro` en tests de
 * superficies (widget, mini, disco): configuración de fábrica, sesión en
 * reposo y el tiempo restante del cronómetro.
 */
export function createPomodoroState() {
  return reactive({
    settings: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      autoStartBreak: true,
      autoStartFocus: false,
      volume: 0.7,
      muted: false,
    },
    session: {
      phase: 'focus' as const,
      isRunning: false,
      endsAt: null,
      remainingMs: 25 * 60 * 1000,
      completedFocusSessions: 0,
    },
    remainingMs: 25 * 60 * 1000,
  })
}
