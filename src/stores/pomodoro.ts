import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as db from '@/lib/db'
import {
  ActivePomodoroSessionSchema,
  defaultPomodoroSettings,
  PomodoroSettingsSchema,
  type ActivePomodoroSession,
  type PomodoroPhase,
  type PomodoroSettings,
} from '@/schemas/pomodoro'
import { getPhaseDurationMs, getRemainingMs, nextPhase } from '@/lib/pomodoro'
import { createPomodoroSoundPlayer, type PomodoroSoundPlayer } from '@/lib/pomodoroSounds'

export const POMODORO_SETTINGS_KEY = 'pomodoro-settings'
export const POMODORO_SESSION_KEY = 'pomodoro-session'

const initialSession: ActivePomodoroSession = {
  phase: 'focus',
  isRunning: false,
  endsAt: null,
  remainingMs: getPhaseDurationMs('focus', defaultPomodoroSettings),
  completedFocusSessions: 0,
}

function copyInitialSession(): ActivePomodoroSession {
  return { ...initialSession }
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const settings = ref<PomodoroSettings>({ ...defaultPomodoroSettings })
  const session = ref<ActivePomodoroSession>(copyInitialSession())
  const loaded = ref(false)
  const remainingMs = computed(() =>
    session.value.isRunning && session.value.endsAt
      ? getRemainingMs(session.value.endsAt)
      : (session.value.remainingMs ?? 0)
  )

  let soundPlayer: PomodoroSoundPlayer | undefined

  function player(): PomodoroSoundPlayer {
    return (soundPlayer ??= createPomodoroSoundPlayer())
  }

  async function persistSession(): Promise<void> {
    await db.saveConfig(POMODORO_SESSION_KEY, JSON.stringify(session.value))
  }

  async function persistSettings(): Promise<void> {
    await db.saveConfig(POMODORO_SETTINGS_KEY, JSON.stringify(settings.value))
  }

  function setPhase(
    phase: Exclude<PomodoroPhase, 'idle'>,
    isRunning: boolean,
    startsAt = Date.now()
  ): void {
    session.value = isRunning
      ? {
          ...session.value,
          phase,
          isRunning: true,
          endsAt: new Date(startsAt + getPhaseDurationMs(phase, settings.value)).toISOString(),
          remainingMs: null,
        }
      : {
          ...session.value,
          phase,
          isRunning: false,
          endsAt: null,
          remainingMs: getPhaseDurationMs(phase, settings.value),
        }
  }

  async function advanceToNextPhase(
    completedNaturally: boolean,
    startsAt = Date.now()
  ): Promise<void> {
    const current = session.value.phase
    if (completedNaturally && current === 'focus') {
      session.value.completedFocusSessions += 1
      player().playFocusEndChime(settings.value)
    } else if (completedNaturally) {
      player().playBreakEndChime(settings.value)
    }

    const phase = nextPhase(
      current,
      session.value.completedFocusSessions,
      settings.value.longBreakInterval
    )
    const isRunning =
      phase === 'focus' ? settings.value.autoStartFocus : settings.value.autoStartBreak
    setPhase(phase, isRunning, startsAt)
    await persistSession()
  }

  async function advanceIfExpired(): Promise<void> {
    while (
      session.value.isRunning &&
      session.value.endsAt &&
      new Date(session.value.endsAt).getTime() <= Date.now()
    ) {
      await advanceToNextPhase(true, new Date(session.value.endsAt).getTime())
      if (!session.value.isRunning) return
    }
  }

  async function prepareAudio(): Promise<void> {
    await player().prepareFromUserGesture()
  }

  function playTestSound(): boolean {
    return player().playFocusEndChime(settings.value)
  }

  async function load(): Promise<void> {
    const [rawSettings, rawSession] = await Promise.all([
      db.loadConfig(POMODORO_SETTINGS_KEY),
      db.loadConfig(POMODORO_SESSION_KEY),
    ])

    if (rawSettings) {
      try {
        settings.value = PomodoroSettingsSchema.parse(JSON.parse(rawSettings))
      } catch {
        settings.value = { ...defaultPomodoroSettings }
      }
    }
    if (rawSession) {
      try {
        session.value = ActivePomodoroSessionSchema.parse(JSON.parse(rawSession))
      } catch {
        session.value = copyInitialSession()
      }
    }
    loaded.value = true
    await advanceIfExpired()
  }

  async function start(): Promise<void> {
    await advanceIfExpired()
    if (session.value.isRunning) return
    const remaining =
      session.value.remainingMs ?? getPhaseDurationMs(session.value.phase, settings.value)
    session.value = {
      ...session.value,
      isRunning: true,
      endsAt: new Date(Date.now() + remaining).toISOString(),
      remainingMs: null,
    }
    await persistSession()
  }

  async function pause(): Promise<void> {
    if (!session.value.isRunning || !session.value.endsAt) return
    session.value = {
      ...session.value,
      isRunning: false,
      endsAt: null,
      remainingMs: getRemainingMs(session.value.endsAt),
    }
    await persistSession()
  }

  async function resume(): Promise<void> {
    await start()
  }

  async function skip(): Promise<void> {
    const wasRunning = session.value.isRunning
    await advanceIfExpired()
    if (wasRunning && !session.value.isRunning) return
    await advanceToNextPhase(false)
  }

  async function reset(): Promise<void> {
    session.value = copyInitialSession()
    await persistSession()
  }

  /**
   * Reinicia la sesión en memoria sin persistir. Para «Borrar datos», donde
   * la clave de sesión ya fue eliminada y no debe volver a crearse.
   */
  function resetSession(): void {
    session.value = copyInitialSession()
  }

  async function saveSettings(patch: Partial<PomodoroSettings>): Promise<void> {
    settings.value = PomodoroSettingsSchema.parse({ ...settings.value, ...patch })
    if (!session.value.isRunning) {
      session.value.remainingMs = getPhaseDurationMs(session.value.phase, settings.value)
      await persistSession()
    }
    await persistSettings()
  }

  return {
    settings,
    session,
    loaded,
    remainingMs,
    load,
    start,
    pause,
    resume,
    skip,
    reset,
    resetSession,
    saveSettings,
    playTestSound,
    advanceIfExpired,
    prepareAudio,
  }
})
