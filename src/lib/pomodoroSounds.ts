import type { PomodoroSettings } from '@/schemas/pomodoro'

type ChimeNote = {
  frequency: number
  offsetSeconds: number
}
type Chime = readonly ChimeNote[]

const focusEndChime: Chime = [
  { frequency: 880, offsetSeconds: 0 },
  { frequency: 1174.66, offsetSeconds: 0.16 },
]

const breakEndChime: Chime = [
  { frequency: 523.25, offsetSeconds: 0 },
  { frequency: 659.25, offsetSeconds: 0.16 },
]

export interface PomodoroSoundPlayer {
  prepareFromUserGesture(): Promise<{ available: boolean; state: string }>
  playFocusEndChime(settings: PomodoroSettings): boolean
  playBreakEndChime(settings: PomodoroSettings): boolean
  /** Preview de la configuración: el toggle «Silenciar» no lo bloquea. */
  playTestChime(settings: PomodoroSettings): boolean
}

export function createPomodoroSoundPlayer(): PomodoroSoundPlayer {
  let context: AudioContext | null = null
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let activeChimes = 0

  const CHIME_WINDOW_MS = 700

  function armAutoSuspend(): void {
    if (suspendTimer !== undefined) clearTimeout(suspendTimer)
    suspendTimer = setTimeout(() => {
      suspendTimer = undefined
      if (activeChimes === 0 && context !== null && context.state === 'running') {
        void context.suspend().catch(() => {})
      }
    }, CHIME_WINDOW_MS)
  }

  async function prepareFromUserGesture(): Promise<{ available: boolean; state: string }> {
    if (context === null) {
      try {
        context = new AudioContext()
      } catch (error) {
        context = null
        console.warn('[pomodoro] AudioContext unavailable:', error)
        return { available: false, state: 'unavailable' }
      }
    }
    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch (error) {
        console.warn('[pomodoro] AudioContext resume failed:', error)
      }
    }
    if (activeChimes === 0) armAutoSuspend()
    return { available: true, state: context.state }
  }

  function play(
    chime: Chime,
    settings: PomodoroSettings,
    options: { ignoreMuted?: boolean } = {}
  ): boolean {
    if ((settings.muted && !options.ignoreMuted) || settings.volume <= 0) return false
    if (context === null) return false

    const schedule = (): boolean => {
      const ctx = context
      if (ctx === null || ctx.state !== 'running') return false

      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(settings.volume, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      gain.connect(ctx.destination)

      const notes = chime.map(({ frequency, offsetSeconds }) => {
        const oscillator = ctx.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, now + offsetSeconds)
        oscillator.connect(gain)
        oscillator.start(now + offsetSeconds)
        oscillator.stop(now + offsetSeconds + 0.45)
        return { oscillator, endsAt: now + offsetSeconds + 0.45 }
      })

      activeChimes += 1
      const windowMs = Math.max(...notes.map((n) => n.endsAt)) * 1000 + 250 - Date.now()
      setTimeout(
        () => {
          activeChimes = Math.max(0, activeChimes - 1)
          armAutoSuspend()
        },
        Math.max(0, windowMs)
      )
      return true
    }

    if (context.state !== 'running') {
      // idle: resume (autoplay already unlocked by an earlier user gesture) then schedule
      void context
        .resume()
        .catch(() => {})
        .finally(() => {
          if (context !== null && context.state === 'running') {
            schedule()
          } else {
            console.warn('[pomodoro] audio context could not be resumed; chime skipped')
          }
        })
      return true
    }
    return schedule()
  }

  return {
    prepareFromUserGesture,
    playFocusEndChime: (settings) => play(focusEndChime, settings),
    playBreakEndChime: (settings) => play(breakEndChime, settings),
    playTestChime: (settings) => play(focusEndChime, settings, { ignoreMuted: true }),
  }
}
