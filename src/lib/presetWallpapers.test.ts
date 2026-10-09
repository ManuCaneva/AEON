import { describe, expect, it } from 'vitest'
import { PRESET_WALLPAPERS, isPresetWallpaperId, presetWallpaperUrl } from './presetWallpapers'

describe('presetWallpapers', () => {
  it('expone 6 presets con id único, label y url', () => {
    expect(PRESET_WALLPAPERS).toHaveLength(6)
    const ids = PRESET_WALLPAPERS.map((p) => p.id)
    expect(new Set(ids).size).toBe(6)
    for (const preset of PRESET_WALLPAPERS) {
      expect(preset.id.length).toBeGreaterThan(0)
      expect(preset.label.length).toBeGreaterThan(0)
      expect(typeof preset.url).toBe('string')
      expect(preset.url.length).toBeGreaterThan(0)
    }
  })

  it('las urls de los presets son distintas entre sí', () => {
    const urls = PRESET_WALLPAPERS.map((p) => p.url)
    expect(new Set(urls).size).toBe(6)
  })

  it('presetWallpaperUrl resuelve un id conocido', () => {
    const first = PRESET_WALLPAPERS[0]
    expect(first).toBeDefined()
    expect(presetWallpaperUrl(first!.id)).toBe(first!.url)
  })

  it('presetWallpaperUrl devuelve null con id desconocido o vacío', () => {
    expect(presetWallpaperUrl('no-existe')).toBeNull()
    expect(presetWallpaperUrl(null)).toBeNull()
    expect(presetWallpaperUrl(undefined)).toBeNull()
    expect(presetWallpaperUrl('')).toBeNull()
  })

  it('isPresetWallpaperId valida ids conocidos', () => {
    const first = PRESET_WALLPAPERS[0]
    expect(first).toBeDefined()
    expect(isPresetWallpaperId(first!.id)).toBe(true)
    expect(isPresetWallpaperId('no-existe')).toBe(false)
    expect(isPresetWallpaperId(null)).toBe(false)
    expect(isPresetWallpaperId(undefined)).toBe(false)
  })
})
