import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import * as db from '@/lib/db'
import {
  ActivePomodoroSessionSchema,
  defaultPomodoroSettings,
  PomodoroSettingsSchema,
  PomodoroSyncPayloadSchema,
  type ActivePomodoroSession,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomodoroSyncPayload,
} from '@/schemas/pomodoro'
import { getPhaseDurationMs, getRemainingMs, nextPhase } from '@/lib/pomodoro'
import { flushPomodoroMiniWindowClosed, POMODORO_MINI_LABEL } from '@/lib/pomodoroMiniWindow'
import { isPomodoroOwnerWindow } from '@/lib/pomodoroOwner'
import { createPomodoroSoundPlayer, type PomodoroSoundPlayer } from '@/lib/pomodoroSounds'

export const POMODORO_SETTINGS_KEY = 'pomodoro-settings'
export const POMODORO_SESSION_KEY = 'pomodoro-session'

/** Canal de sincronización del pomodoro entre webviews (broadcast de Tauri). */
const POMODORO_SYNC_EVENT = 'pomodoro-state-changed'

/**
 * Cadencia de la red de seguridad del fin de fase: si el deadline se atrasa
 * (throttling de timers en segundo plano) o la ventana dueña del aviso cede,
 * este polling termina resolviendo la expiración, como antes.
 */
const SAFETY_POLL_MS = 250

export const usePomodoroStore = defineStore('pomodoro', () => {
  /** Identifica a esta instancia entre las demás webviews para descartar su eco. */
  const origin = crypto.randomUUID()

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
  let tickDeReloj: ReturnType<typeof setTimeout> | undefined
  let deadlineDeFase: ReturnType<typeof setTimeout> | undefined

  /**
   * true cuando la fase que corre ya venció y falta resolverla.
   */
  function faseExpirada(): boolean {
    return (
      session.value.isRunning &&
      session.value.endsAt !== null &&
      new Date(session.value.endsAt).getTime() <= Date.now()
    )
  }

  /**
   * Programa dos timers sobre la fase que corre, y solo mientras corre:
   *
   * - `deadlineDeFase` vence en `endsAt` exacto: el fin de fase se resuelve en
   *   el instante justo, sin la latencia del polling.
   * - `tickDeReloj` cae en el borde del segundo del fin de fase (no del reloj
   *   de pared): cada segundo del countdown dura exactamente 1000 ms y el
   *   display salta en el instante correspondiente, sin jitter.
   *
   * Sin fase corriendo no hay timers: el reloj se congela con la pausa.
   */
  function programarTimersDeFase(): void {
    if (tickDeReloj !== undefined) clearTimeout(tickDeReloj)
    if (deadlineDeFase !== undefined) clearTimeout(deadlineDeFase)
    tickDeReloj = undefined
    deadlineDeFase = undefined

    if (!session.value.isRunning || session.value.endsAt === null) return

    const finMs = new Date(session.value.endsAt).getTime()
    const hastaElFin = finMs - Date.now()
    if (hastaElFin <= 0) {
      void advanceIfExpired()
      return
    }

    deadlineDeFase = setTimeout(() => {
      deadlineDeFase = undefined
      void advanceIfExpired()
    }, hastaElFin)

    const hastaElBorde = hastaElFin % 1000 === 0 ? 1000 : hastaElFin % 1000
    tickDeReloj = setTimeout(() => {
      tickDeReloj = undefined
      clock.value = Date.now()
      programarTimersDeFase()
    }, hastaElBorde)
  }

  /**
   * Un solo ticker para toda la app: el polling queda solo como red de
   * seguridad del fin de fase; el reloj y el deadline llevan el ritmo.
   */
  function startTicker(): void {
    if (ticker) return
    ticker = setInterval(() => {
      void advanceIfExpired()
    }, SAFETY_POLL_MS)
    programarTimersDeFase()
  }

  function stopTicker(): void {
    if (ticker !== undefined) clearInterval(ticker)
    ticker = undefined
    programarTimersDeFase()
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

  /**
   * Publica el estado completo a las demás webviews. La ventana que muta es la
   * única que persiste; las demás aplican el snapshot sin volver a escribirlo
   * ni re-emitirlo.
   */
  function publish(): void {
    const snapshot: PomodoroSyncPayload = {
      origin,
      settings: { ...settings.value },
      session: { ...session.value },
    }
    void emit(POMODORO_SYNC_EVENT, snapshot)
  }

  /**
   * Único escritor de la sesión persistida: la ventana que muta escribe en
   * SQLite y publica el snapshot a las demás, que solo lo aplican.
   */
  async function persistAndPublish(): Promise<void> {
    await persistSession()
    publish()
  }

  /**
   * Aplica el snapshot de otra ventana sin persistir ni re-emitir: la ventana
   * que originó el cambio ya escribió en SQLite y el eco propio se descarta.
   */
  function applyRemote(payload: unknown): void {
    const snapshot = PomodoroSyncPayloadSchema.safeParse(payload)
    if (!snapshot.success || snapshot.data.origin === origin) return
    settings.value = snapshot.data.settings
    session.value = snapshot.data.session
    clock.value = Date.now()
    programarTimersDeFase()
  }

  let syncRegistered = false

  /**
   * true cuando esta ventana se está cerrando: deja de resolver fines de fase y
   * de sonar, para que el aviso no se juegue contra el cierre de la ventana.
   */
  let windowClosing = false
  /** Las fases vencidas antes de cargar se recuperan sin alarmas atrasadas. */
  let silentUntil = 0

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
    programarTimersDeFase()
  }

  async function advanceToNextPhase(
    completedNaturally: boolean,
    startsAt = Date.now()
  ): Promise<void> {
    const current = session.value.phase
    const focusCompletado = completedNaturally && current === 'focus'
    if (focusCompletado) session.value.completedFocusSessions += 1

    const phase = nextPhase(
      current,
      session.value.completedFocusSessions,
      settings.value.longBreakInterval
    )
    const isRunning =
      phase === 'focus' ? settings.value.autoStartFocus : settings.value.autoStartBreak
    setPhase(phase, isRunning, startsAt)
    // La transición se publica antes de sonar: la otra ventana la aplica y cede
    // antes de que suene nada. Si esta ventana muere en el medio, se pierde el
    // aviso en vez de sonar dos veces.
    await persistAndPublish()

    if (!completedNaturally || windowClosing || startsAt <= silentUntil) return
    if (focusCompletado) player().playFocusEndChime(settings.value)
    else player().playBreakEndChime(settings.value)
  }

  async function advanceIfExpired(): Promise<void> {
    while (
      !windowClosing &&
      session.value.isRunning &&
      session.value.endsAt &&
      new Date(session.value.endsAt).getTime() <= Date.now()
    ) {
      const expirada = session.value.endsAt
      // Solo la ventana dueña resuelve el fin de fase: suena y persiste una
      // sola vez; la otra se queda quieta y aplica el snapshot que llegue.
      if (!(await isPomodoroOwnerWindow())) return
      // La ventana pudo cerrarse o un snapshot ajeno pudo resolver la
      // expiración mientras se decidía la dueña.
      if (windowClosing) return
      if (session.value.endsAt !== expirada) continue
      await advanceToNextPhase(true, new Date(expirada).getTime())
      if (!session.value.isRunning) return
    }
  }

  async function prepareAudio(): Promise<void> {
    await player().prepareFromUserGesture()
  }

  function playTestSound(): boolean {
    return player().playTestChime(settings.value)
  }

  async function load(): Promise<void> {
    if (!syncRegistered) {
      syncRegistered = true
      await listen(POMODORO_SYNC_EVENT, (event) => applyRemote(event.payload))
      // Al cerrarse, esta ventana entrega el fin de fase a la otra: con la
      // principal cerrándose en la expiración, el aviso suena una sola vez.
      const ventana = getCurrentWebviewWindow()
      await ventana.onCloseRequested(async () => {
        windowClosing = true
        stopTicker()
        if (ventana.label === POMODORO_MINI_LABEL) {
          // La ventana se destruye cuando este handler termina: persistir el
          // cierre acá evita que el destroy gane la carrera contra el guardado.
          try {
            await flushPomodoroMiniWindowClosed()
          } catch {
            // Cerrar manda: un fallo de persistencia no puede dejar la X muerta.
          }
        }
      })
    }
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
    silentUntil = clock.value
    // El contexto de audio se crea acá, fuera de cualquier click: el primer
    // play no paga la creación (el gesto solo lo despierta).
    player().prewarm()
    programarTimersDeFase()
    await advanceIfExpired()
  }

  async function start(): Promise<void> {
    // Solo se resuelve una expiración pendiente; sin expiración no hay await:
    // el click muta la sesión en el mismo frame que la vista lo pidió.
    if (faseExpirada()) await advanceIfExpired()
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
    programarTimersDeFase()
    await persistAndPublish()
  }

  async function pause(): Promise<void> {
    if (!session.value.isRunning || !session.value.endsAt) return
    session.value = {
      ...session.value,
      isRunning: false,
      endsAt: null,
      remainingMs: getRemainingMs(session.value.endsAt),
    }
    programarTimersDeFase()
    await persistAndPublish()
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
    programarTimersDeFase()
    await persistAndPublish()
  }

  /**
   * Reinicia la sesión en memoria sin persistir. Para «Borrar datos», donde
   * la clave de sesión ya fue eliminada y no debe volver a crearse.
   */
  function resetSession(): void {
    session.value = freshSession()
    programarTimersDeFase()
    publish()
  }

  async function saveSettings(patch: Partial<PomodoroSettings>): Promise<void> {
    settings.value = PomodoroSettingsSchema.parse({ ...settings.value, ...patch })
    if (!session.value.isRunning) {
      session.value.remainingMs = getPhaseDurationMs(session.value.phase, settings.value)
      await persistSession()
    }
    await persistSettings()
    publish()
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
