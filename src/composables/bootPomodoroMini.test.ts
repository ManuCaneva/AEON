import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootPomodoroMini } from './bootPomodoroMini'
import * as db from '@/lib/db'

const { useHabitsStore, useTasksStore, useGoalsStore, useExamsStore, showPomodoroInMainWindow } =
  vi.hoisted(() => ({
    useHabitsStore: vi.fn(),
    useTasksStore: vi.fn(),
    useGoalsStore: vi.fn(),
    useExamsStore: vi.fn(),
    showPomodoroInMainWindow: vi.fn().mockResolvedValue(undefined),
  }))

vi.mock('@/stores/habits', () => ({ useHabitsStore }))
vi.mock('@/stores/tasks', () => ({ useTasksStore }))
vi.mock('@/stores/goals', () => ({ useGoalsStore }))
vi.mock('@/stores/exams', () => ({ useExamsStore }))
vi.mock('@/lib/pomodoroMainWindow', () => ({ showPomodoroInMainWindow }))

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/pomodoroSounds', () => ({
  createPomodoroSoundPlayer: () => ({
    prepareFromUserGesture: vi.fn().mockResolvedValue(undefined),
    playFocusEndChime: vi.fn(() => true),
    playBreakEndChime: vi.fn(() => true),
    playTestChime: vi.fn(() => true),
  }),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
}))

function countdown(): string {
  return (
    document.querySelector('[data-testid="pomodoro-mini-countdown"]')?.textContent?.trim() ?? ''
  )
}

describe('arranque de la ventana mini', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    showPomodoroInMainWindow.mockClear()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00.000Z'))
    vi.mocked(db.loadConfig).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('monta la réplica y arranca el reloj compartido, con tema y escala de texto propios', async () => {
    localStorage.setItem('aeon.textSize', JSON.stringify('large'))
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-session'
        ? JSON.stringify({
            phase: 'focus',
            isRunning: true,
            endsAt: '2026-09-01T12:25:00.000Z',
            remainingMs: null,
            completedFocusSessions: 0,
          })
        : null
    )

    await bootPomodoroMini()

    expect(document.querySelector('[data-testid="pomodoro-mini"]')).not.toBeNull()
    expect(countdown()).toBe('25:00')
    expect(document.documentElement.style.getPropertyValue('--color-canvas')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15')

    await vi.advanceTimersByTimeAsync(3_000)
    expect(countdown()).toBe('24:57')
  })

  it('no dispara el arranque completo de la app: ningún dominio se carga', async () => {
    await bootPomodoroMini()

    expect(useHabitsStore).not.toHaveBeenCalled()
    expect(useTasksStore).not.toHaveBeenCalled()
    expect(useGoalsStore).not.toHaveBeenCalled()
    expect(useExamsStore).not.toHaveBeenCalled()
  })

  it('el título de la mini pide la página Pomodoro en la ventana principal, con click y teclado', async () => {
    await bootPomodoroMini()
    const header = document.querySelector('[data-testid="pomodoro-mini-header"]')

    header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    header?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    header?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))

    expect(showPomodoroInMainWindow).toHaveBeenCalledTimes(3)
  })

  it('el disco y los controles de la mini no piden navegación', async () => {
    await bootPomodoroMini()
    const click = (testId: string) =>
      document
        .querySelector(`[data-testid="${testId}"]`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    click('pomodoro-mini-disc')
    click('pomodoro-mini-reset')
    click('pomodoro-mini-toggle')
    click('pomodoro-mini-skip')

    expect(showPomodoroInMainWindow).not.toHaveBeenCalled()
  })
})
