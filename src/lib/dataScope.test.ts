import { describe, it, expect } from 'vitest'
import { DATA_TABLES, DATA_CONFIG_KEYS, PRESERVED_CONFIG_KEYS } from './dataScope'

describe('dataScope — frontera entre datos y configuración', () => {
  it('define exactamente las tablas de contenido que se vacían (hijos antes que padres)', () => {
    expect([...DATA_TABLES]).toEqual([
      'habit_logs',
      'habits',
      'goal_logs',
      'goals',
      'tasks',
      'notes',
      'schedule_block_slots',
      'schedule_blocks',
    ])
  })

  it('define exactamente las claves de config que son datos (se borran)', () => {
    expect([...DATA_CONFIG_KEYS].sort()).toEqual(['local-calendar-events', 'pomodoro-session'])
  })

  it('define las claves de config que son configuración (no se tocan)', () => {
    expect([...PRESERVED_CONFIG_KEYS].sort()).toEqual(
      [
        'aeon-dashboard-layout',
        'aeon-seed-done',
        'gcal-visible-calendars',
        'gcal_access_token',
        'gcal_pending_oauth',
        'gcal_refresh_token',
        'gcal_token_expiry',
        'pomodoro-settings',
        'wallpaper-settings',
        'weekly-schedule-settings',
      ].sort()
    )
  })

  it('datos y configuración son conjuntos disjuntos: nada se borra y se conserva a la vez', () => {
    for (const key of DATA_CONFIG_KEYS) {
      expect(PRESERVED_CONFIG_KEYS as readonly string[]).not.toContain(key)
    }
    for (const key of PRESERVED_CONFIG_KEYS) {
      expect(DATA_CONFIG_KEYS as readonly string[]).not.toContain(key)
    }
  })

  it('conserva explícitamente la configuración crítica: widgets, gcal, wallpaper, ajustes y primera ejecución', () => {
    const preserved = new Set<string>(PRESERVED_CONFIG_KEYS)
    // Distribución de Widgets
    expect(preserved.has('aeon-dashboard-layout')).toBe(true)
    // Conexión y tokens de Google Calendar
    expect(preserved.has('gcal_access_token')).toBe(true)
    expect(preserved.has('gcal_refresh_token')).toBe(true)
    expect(preserved.has('gcal-visible-calendars')).toBe(true)
    // Wallpaper
    expect(preserved.has('wallpaper-settings')).toBe(true)
    // Ajustes del cronograma y del Pomodoro
    expect(preserved.has('weekly-schedule-settings')).toBe(true)
    expect(preserved.has('pomodoro-settings')).toBe(true)
    // Marca de primera ejecución
    expect(preserved.has('aeon-seed-done')).toBe(true)
  })
})
