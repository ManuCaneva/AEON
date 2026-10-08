import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultPomodoroSettings, type ActivePomodoroSession } from '@/schemas/pomodoro'
import * as db from '@/lib/db'
import { usePomodoroStore } from './pomodoro'

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

const { prepareFromUserGesture, playFocusEndChime, playBreakEndChime } = vi.hoisted(() => ({
  prepareFromUserGesture: vi.fn().mockResolvedValue({ available: true, state: 'running' }),
  playFocusEndChime: vi.fn(() => true),
  playBreakEndChime: vi.fn(() => true),
}))

vi.mock('@/lib/pomodoroSounds', () => ({
  createPomodoroSoundPlayer: () => ({
    prepareFromUserGesture,
    playFocusEndChime,
    playBreakEndChime,
  }),
}))

const start = '2026-09-01T12:00:00.000Z'

function session(overrides: Partial<ActivePomodoroSession> = {}): ActivePomodoroSession {
  return {
    phase: 'focus',
    isRunning: false,
    endsAt: null,
    remainingMs: defaultPomodoroSettings.focusMinutes * 60_000,
    completedFocusSessions: 0,
    ...overrides,
  }
}

describe('pomodoro store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    prepareFromUserGesture.mockResolvedValue(undefined)
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('arranca en reposo: sin sesión guardada el cronómetro no corre', async () => {
    const store = usePomodoroStore()
    await store.load()
    expect(store.session.isRunning).toBe(false)
    expect(store.session.endsAt).toBeNull()
    expect(store.session.phase).toBe('focus')
    expect(store.remainingMs).toBe(defaultPomodoroSettings.focusMinutes * 60_000)
  })

  it('starts, pauses, and resumes using timestamp-based remaining time', async () => {
    const store = usePomodoroStore()
    await store.load()

    await store.start()
    expect(store.session.isRunning).toBe(true)
    expect(store.session.endsAt).toBe('2026-09-01T12:25:00.000Z')

    vi.setSystemTime(new Date('2026-09-01T12:03:12.000Z'))
    await store.pause()
    expect(store.session).toMatchObject({
      isRunning: false,
      endsAt: null,
      remainingMs: 21 * 60_000 + 48_000,
    })

    vi.setSystemTime(new Date('2026-09-01T13:00:00.000Z'))
    await store.resume()
    expect(store.session.endsAt).toBe('2026-09-01T13:21:48.000Z')
  })

  it('skips without counting focus, reset returns to initial focus, and natural completion counts', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ autoStartBreak: false })
    await store.start()
    await store.skip()
    expect(store.session).toMatchObject({
      phase: 'shortBreak',
      completedFocusSessions: 0,
      isRunning: false,
    })

    await store.reset()
    expect(store.session).toEqual(session())

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({ phase: 'shortBreak', completedFocusSessions: 1 })
  })

  it('uses a long break at the configured interval and honors auto-start toggles', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ longBreakInterval: 1, autoStartBreak: true, autoStartFocus: true })
    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({
      phase: 'longBreak',
      isRunning: true,
      completedFocusSessions: 1,
    })
    expect(store.session.endsAt).toBe('2026-09-01T12:40:00.000Z')

    vi.setSystemTime(new Date('2026-09-01T12:40:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({ phase: 'focus', isRunning: true })
  })

  it('round-trips settings and an active session, resolving expired sessions on load', async () => {
    const saved = new Map<string, string>()
    vi.mocked(db.saveConfig).mockImplementation(async (key, value) => void saved.set(key, value))
    vi.mocked(db.loadConfig).mockImplementation(async (key) => saved.get(key) ?? null)
    const first = usePomodoroStore()
    await first.load()
    await first.saveSettings({ focusMinutes: 30, muted: true })
    await first.start()
    expect(saved.has('pomodoro-settings')).toBe(true)
    expect(saved.has('pomodoro-session')).toBe(true)

    vi.setSystemTime(new Date('2026-09-01T12:31:00.000Z'))
    setActivePinia(createPinia())
    const second = usePomodoroStore()
    await second.load()
    expect(second.settings.focusMinutes).toBe(30)
    expect(second.settings.muted).toBe(true)
    expect(second.session.phase).toBe('shortBreak')
    expect(second.session.completedFocusSessions).toBe(1)
  })

  it('plays chimes on natural completion, stays silent on skip, and playTestSound previews focus chime', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ autoStartBreak: false, autoStartFocus: false })

    expect(store.playTestSound()).toBe(true)
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(playFocusEndChime).toHaveBeenCalledWith(store.settings)

    playFocusEndChime.mockReturnValueOnce(false)
    expect(store.playTestSound()).toBe(false)

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(playFocusEndChime).toHaveBeenCalledTimes(3)
    expect(playBreakEndChime).not.toHaveBeenCalled()

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:30:00.000Z'))
    await store.advanceIfExpired()
    expect(playBreakEndChime).toHaveBeenCalledTimes(1)

    await store.reset()
    await store.start()
    await store.skip()
    expect(playFocusEndChime).toHaveBeenCalledTimes(3)
    expect(playBreakEndChime).toHaveBeenCalledTimes(1)
  })

  it('inicializa la sesión con la configuración vigente en el momento de crear el store', () => {
    const factoryFocusMinutes = defaultPomodoroSettings.focusMinutes
    defaultPomodoroSettings.focusMinutes = 35
    try {
      const store = usePomodoroStore()
      expect(store.session).toEqual({
        phase: 'focus',
        isRunning: false,
        endsAt: null,
        remainingMs: 35 * 60_000,
        completedFocusSessions: 0,
      })
      expect(store.remainingMs).toBe(35 * 60_000)
    } finally {
      defaultPomodoroSettings.focusMinutes = factoryFocusMinutes
    }
  })

  it('sin sesión persistida, la carga arma el cronómetro con la configuración guardada', async () => {
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-settings' ? JSON.stringify({ focusMinutes: 35 }) : null
    )
    const store = usePomodoroStore()
    await store.load()

    expect(store.settings.focusMinutes).toBe(35)
    expect(store.session).toEqual({
      phase: 'focus',
      isRunning: false,
      endsAt: null,
      remainingMs: 35 * 60_000,
      completedFocusSessions: 0,
    })
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('«Reiniciar» deja la duración de enfoque configurada, en reposo y en foco', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 35 })
    await store.start()
    expect(store.session.isRunning).toBe(true)

    await store.reset()

    expect(store.session).toEqual({
      phase: 'focus',
      isRunning: false,
      endsAt: null,
      remainingMs: 35 * 60_000,
      completedFocusSessions: 0,
    })
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('«Reiniciar» desde una fase de descanso vuelve al enfoque con la duración configurada', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 35, autoStartBreak: false })
    await store.start()
    await store.skip()
    expect(store.session.phase).toBe('shortBreak')

    await store.reset()

    expect(store.session.phase).toBe('focus')
    expect(store.session.isRunning).toBe(false)
    expect(store.session.completedFocusSessions).toBe(0)
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('el reloj reactivo baja segundo a segundo con el ticker y se congela al pausar', async () => {
    const store = usePomodoroStore()
    await store.load()
    store.startTicker()
    await store.start()

    const inicial = store.remainingMs
    expect(inicial).toBe(defaultPomodoroSettings.focusMinutes * 60_000)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.remainingMs).toBe(inicial - 1_000)

    await vi.advanceTimersByTimeAsync(3_000)
    expect(store.remainingMs).toBe(inicial - 4_000)

    await store.pause()
    const congelado = store.remainingMs
    expect(congelado).toBe(inicial - 4_000)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(store.remainingMs).toBe(congelado)

    await store.resume()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(store.remainingMs).toBe(congelado - 2_000)

    store.stopTicker()
  })

  it('el ticker cambia de fase en el instante en que expira, sin atrasar el aviso', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 1, autoStartBreak: false })
    store.startTicker()
    await store.start()

    await vi.advanceTimersByTimeAsync(59_750)
    expect(store.session.phase).toBe('focus')
    expect(playFocusEndChime).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(250)
    expect(store.session.phase).toBe('shortBreak')
    expect(store.session.isRunning).toBe(false)
    expect(playFocusEndChime).toHaveBeenCalledOnce()

    store.stopTicker()
  })

  it('loads a still-running session and computes its current remaining time', async () => {
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-session'
        ? JSON.stringify({
            ...session(),
            isRunning: true,
            endsAt: '2026-09-01T12:25:00.000Z',
            remainingMs: null,
          })
        : null
    )
    vi.setSystemTime(new Date('2026-09-01T12:03:12.000Z'))

    const store = usePomodoroStore()
    await store.load()

    expect(store.session.isRunning).toBe(true)
    expect(store.session.endsAt).toBe('2026-09-01T12:25:00.000Z')
    expect(store.remainingMs).toBe(21 * 60_000 + 48_000)
  })
})
