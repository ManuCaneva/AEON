import { describe, expect, it } from 'vitest'
import { PomodoroSettingsSchema } from '@/schemas/pomodoro'
import { POMODORO_SOUND_OPTIONS } from './pomodoroSoundCatalog'

describe('catálogo de alarmas del pomodoro', () => {
  it('ofrece las cuatro alarmas con ids estables, etiquetas claras y un archivo propio', () => {
    expect(POMODORO_SOUND_OPTIONS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'bell', label: 'Campana' },
      { id: 'happy-bells', label: 'Campanas alegres' },
      { id: 'interface-back', label: 'Interfaz' },
      { id: 'urgent-tone', label: 'Tono urgente' },
    ])

    const sources = POMODORO_SOUND_OPTIONS.map(({ src }) => src)
    expect(new Set(sources).size).toBe(POMODORO_SOUND_OPTIONS.length)
    expect(sources.every((src) => src.length > 0)).toBe(true)
  })

  it('todos los ids del catálogo son configuración válida del pomodoro', () => {
    for (const { id } of POMODORO_SOUND_OPTIONS) {
      expect(PomodoroSettingsSchema.parse({ soundId: id }).soundId).toBe(id)
    }
  })
})
