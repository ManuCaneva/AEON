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

/** Cadencia del chequeo de expiración de fase. */
const TICK_INTERVAL_MS = 250

export const usePomodoroStore = defineStore('pomodoro', () => {
  const settings = ref<PomodoroSettings>({ ...defaultPomodoroSettings })

  /** Sesión en reposo calculada con la configuración vigente, no con la de fábrica. */
  function freshSession(): ActivePomodoroSession {
    return {
      phase: 'focus',
      isRunning: false,
      endsAt: null,
      remainingMs: getPhaseDurationMs('focus', settings.value),
      completedFocusSessions: 0,
    }
  }

  const session = ref<ActivePomodoroSession>(freshSession())
  const loaded = ref(false)

  /**
   * Único reloj reactivo de la app. El tiempo restante se deriva de él, así que
   * las superficies solo leen y quedan sincronizadas por diseño.
   */
  const clock = ref(Date.now())
  const remainingMs = computed(() => {
    if (session.value.isRunning && session.value.endsAt) {
      return getRemainingMs(session.value.endsAt, new Date(clock.value))
    }
    return session.value.remainingMs ?? 0
  })

  let ticker: ReturnType<typeof setInterval> | undefined

  /**
   * Un solo tick para toda la app: chequea la expiración cada 250 ms y muta el
   * reloj solo cuando cambia el segundo entero, para repintar una vez por segundo.
   */
  function tick(): void {
    void advanceIfExpired()
    const now = Date.now()
    if (Math.floor(now / 1000) !== Math.floor(clock.value / 1000)) {
      clock.value = now
    }
  }

  function startTicker(): void {
    if (ticker) return
    ticker = setInterval(tick, TICK_INTERVAL_MS)
  }

  function stopTicker(): void {
    if (ticker !== undefined) clearInterval(ticker)
    ticker = undefined
  }

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
    if (isRunning) clock.value = startsAt
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
        session.value = freshSession()
      }
    } else {
      session.value = freshSession()
    }
    loaded.value = true
    clock.value = Date.now()
    await advanceIfExpired()
  }

  async function start(): Promise<void> {
    await advanceIfExpired()
    if (session.value.isRunning) return
    const remaining =
      session.value.remainingMs ?? getPhaseDurationMs(session.value.phase, settings.value)
    const now = Date.now()
    clock.value = now
    session.value = {
      ...session.value,
      isRunning: true,
      endsAt: new Date(now + remaining).toISOString(),
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
    session.value = freshSession()
    await persistSession()
  }

  /**
   * Reinicia la sesión en memoria sin persistir. Para «Borrar datos», donde
   * la clave de sesión ya fue eliminada y no debe volver a crearse.
   */
  function resetSession(): void {
    session.value = freshSession()
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
    startTicker,
    stopTicker,
  }
})
