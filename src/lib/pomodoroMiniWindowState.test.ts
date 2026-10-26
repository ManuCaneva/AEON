import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadPomodoroMiniWindowState, savePomodoroMiniWindowState } from './pomodoroMiniWindowState'
import { defaultPomodoroMiniWindowState } from '@/schemas/pomodoroMiniWindow'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}))

describe('persistencia del estado de la ventana mini', () => {
  beforeEach(() => {
    vi.mocked(db.loadConfig).mockReset()
    vi.mocked(db.saveConfig).mockReset()
  })

  it('carga el estado desde la clave de config de la ventana mini', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue(JSON.stringify({ isOpen: true, x: 100, y: 200 }))

    const state = await loadPomodoroMiniWindowState()

    expect(db.loadConfig).toHaveBeenCalledWith('pomodoro-mini-window')
    expect(state).toEqual({ isOpen: true, x: 100, y: 200, width: null, height: null })
  })

  it('un dato persistido corrupto devuelve el estado por defecto sin lanzar', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue('{roto')

    await expect(loadPomodoroMiniWindowState()).resolves.toEqual(defaultPomodoroMiniWindowState)
  })

  it('guarda el estado serializado en la misma clave', async () => {
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)

    await savePomodoroMiniWindowState({
      isOpen: true,
      x: 66.5,
      y: -10,
      width: 160,
      height: 180,
    })

    expect(db.saveConfig).toHaveBeenCalledWith(
      'pomodoro-mini-window',
      JSON.stringify({ isOpen: true, x: 66.5, y: -10, width: 160, height: 180 })
    )
  })

  it('round-trip: lo guardado se recupera idéntico', async () => {
    const stored = new Map<string, string>()
    vi.mocked(db.loadConfig).mockImplementation(async (key) => stored.get(key) ?? null)
    vi.mocked(db.saveConfig).mockImplementation(async (key, value) => {
      stored.set(key, value)
    })
    const saved = { isOpen: true, x: 1920, y: 1120, width: 140, height: 150 }

    await savePomodoroMiniWindowState(saved)

    expect(await loadPomodoroMiniWindowState()).toEqual(saved)
  })
})
