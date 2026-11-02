import type { PomodoroSettings, PomodoroSoundId } from '@/schemas/pomodoro'
import { POMODORO_SOUND_OPTIONS } from './pomodoroSoundCatalog'

export interface PomodoroSoundPlayer {
  /**
   * Crea el AudioContext sin necesidad de un gesto de usuario, para que el
   * primer click no pague la creación. No despierta el contexto ni descarga
   * alarmas: eso ocurre en `prepareFromUserGesture`.
   */
  prewarm(): void
  /**
   * Desbloquea el audio dentro del gesto y deja lista solo la alarma elegida.
   * Si no se indica ninguna, la carga queda para la primera reproducción.
   */
  prepareFromUserGesture(soundId?: PomodoroSoundId): Promise<{ available: boolean; state: string }>
  /** La alarma elegida suena igual al terminar un enfoque o un descanso. */
  playFocusEndChime(settings: PomodoroSettings): boolean
  playBreakEndChime(settings: PomodoroSettings): boolean
  /** Preview de la configuración: el toggle «Silenciar» no lo bloquea. */
  playTestChime(settings: PomodoroSettings): boolean
}

const AUTO_SUSPEND_MS = 700
const PLAYBACK_TAIL_MS = 250

export function createPomodoroSoundPlayer(): PomodoroSoundPlayer {
  let context: AudioContext | null = null
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let activeSounds = 0
  /**
   * Una sola alarma decodificada a la vez: cambiar de sonido libera la anterior.
   * Evita tener los cuatro WAV completos en memoria sin necesidad.
   */
  let cachedSound: { id: PomodoroSoundId; buffer: AudioBuffer } | null = null
  const pendingLoads = new Map<PomodoroSoundId, Promise<AudioBuffer | null>>()

  /** Crea el contexto una sola vez. false si el backend no tiene audio. */
  function ensureContext(): boolean {
    if (context !== null) return true
    try {
      context = new AudioContext()
      return true
    } catch (error) {
      context = null
      console.warn('[pomodoro] AudioContext unavailable:', error)
      return false
    }
  }

  function prewarm(): void {
    ensureContext()
  }

  function armAutoSuspend(): void {
    if (suspendTimer !== undefined) clearTimeout(suspendTimer)
    suspendTimer = setTimeout(() => {
      suspendTimer = undefined
      if (activeSounds === 0 && context !== null && context.state === 'running') {
        void context.suspend().catch(() => {})
      }
    }, AUTO_SUSPEND_MS)
  }

  async function loadSound(soundId: PomodoroSoundId): Promise<AudioBuffer | null> {
    if (cachedSound?.id === soundId) return cachedSound.buffer

    const pending = pendingLoads.get(soundId)
    if (pending !== undefined) return pending

    const option = POMODORO_SOUND_OPTIONS.find(({ id }) => id === soundId)
    if (option === undefined) {
      console.warn(`[pomodoro] unknown sound "${soundId}"; alarm skipped`)
      return null
    }

    const load = (async () => {
      try {
        const response = await fetch(option.src)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const encoded = await response.arrayBuffer()
        const buffer = await context!.decodeAudioData(encoded)
        cachedSound = { id: soundId, buffer }
        return buffer
      } catch (error) {
        console.warn(`[pomodoro] sound "${soundId}" unavailable:`, error)
        return null
      } finally {
        pendingLoads.delete(soundId)
      }
    })()

    pendingLoads.set(soundId, load)
    return load
  }

  function schedule(buffer: AudioBuffer, volume: number): boolean {
    const ctx = context
    if (ctx === null || ctx.state !== 'running') return false

    activeSounds += 1
    try {
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.connect(ctx.destination)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gain)

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        activeSounds = Math.max(0, activeSounds - 1)
        armAutoSuspend()
      }
      source.onended = finish
      source.start()
      setTimeout(finish, buffer.duration * 1000 + PLAYBACK_TAIL_MS)
      return true
    } catch (error) {
      activeSounds = Math.max(0, activeSounds - 1)
      console.warn('[pomodoro] alarm could not start:', error)
      return false
    }
  }

  function start(buffer: AudioBuffer, volume: number): boolean {
    const ctx = context
    if (ctx === null) return false
    if (ctx.state === 'running') return schedule(buffer, volume)

    // El contexto se duerme entre fases. Ya fue desbloqueado por un gesto, así
    // que se puede reanudar sin interacción; si el navegador lo impide, se omite
    // la alarma en vez de romper el cambio de fase.
    void ctx
      .resume()
      .then(() => {
        if (context !== null && context.state === 'running') schedule(buffer, volume)
        else console.warn('[pomodoro] audio context could not be resumed; alarm skipped')
      })
      .catch((error) => {
        console.warn('[pomodoro] audio context could not be resumed; alarm skipped', error)
      })
    return true
  }

  function play(settings: PomodoroSettings, options: { ignoreMuted?: boolean } = {}): boolean {
    if ((settings.muted && !options.ignoreMuted) || settings.volume <= 0) return false
    if (context === null) return false

    if (cachedSound?.id === settings.soundId) {
      return start(cachedSound.buffer, settings.volume)
    }

    // Sin preparación previa la alarma se carga igual, pero nunca se adelanta
    // trabajo de red al arranque de la app.
    void loadSound(settings.soundId).then((buffer) => {
      if (buffer !== null) start(buffer, settings.volume)
    })
    return true
  }

  async function prepareFromUserGesture(
    soundId?: PomodoroSoundId
  ): Promise<{ available: boolean; state: string }> {
    if (!ensureContext() || context === null) return { available: false, state: 'unavailable' }
    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch (error) {
        console.warn('[pomodoro] AudioContext resume failed:', error)
      }
    }
    if (soundId !== undefined) await loadSound(soundId)
    if (activeSounds === 0) armAutoSuspend()
    return { available: true, state: context.state }
  }

  return {
    prewarm,
    prepareFromUserGesture,
    playFocusEndChime: (settings) => play(settings),
    playBreakEndChime: (settings) => play(settings),
    playTestChime: (settings) => play(settings, { ignoreMuted: true }),
  }
}
