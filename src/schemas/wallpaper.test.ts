import { describe, expect, it } from 'vitest'
import {
  WallpaperSettingsSchema,
  parseWallpaperSettingsJson,
  defaultWallpaperSettings,
} from './wallpaper'

const pngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('WallpaperSettingsSchema', () => {
  it('acepta settings con data URL de imagen', () => {
    const result = WallpaperSettingsSchema.parse({ dataUrl: pngDataUrl })
    expect(result.dataUrl).toBe(pngDataUrl)
  })

  it('tiene dataUrl null por defecto', () => {
    const result = WallpaperSettingsSchema.parse({})
    expect(result.dataUrl).toBeNull()
    expect(defaultWallpaperSettings.dataUrl).toBeNull()
  })

  it('tiene presetId null por defecto y lo completa en configs viejas', () => {
    expect(WallpaperSettingsSchema.parse({}).presetId).toBeNull()
    expect(defaultWallpaperSettings.presetId).toBeNull()
    expect(WallpaperSettingsSchema.parse({ dataUrl: pngDataUrl }).presetId).toBeNull()
  })

  it('acepta presetId explícito y null', () => {
    expect(WallpaperSettingsSchema.parse({ presetId: 'fondo-01' }).presetId).toBe('fondo-01')
    expect(WallpaperSettingsSchema.parse({ presetId: null }).presetId).toBeNull()
  })

  it('rechaza presetId vacío o no string', () => {
    expect(() => WallpaperSettingsSchema.parse({ presetId: '' })).toThrow()
    expect(() => WallpaperSettingsSchema.parse({ presetId: 42 })).toThrow()
  })

  it('acepta dataUrl null explícito', () => {
    const result = WallpaperSettingsSchema.parse({ dataUrl: null })
    expect(result.dataUrl).toBeNull()
  })

  it('rechaza un string arbitrario que no es data URL', () => {
    expect(() =>
      WallpaperSettingsSchema.parse({ dataUrl: 'https://example.com/fondo.png' })
    ).toThrow()
  })

  it('rechaza una data URL que no es de imagen', () => {
    expect(() =>
      WallpaperSettingsSchema.parse({ dataUrl: 'data:text/html;base64,PGgxPmgvbGk8L2gxPg==' })
    ).toThrow()
    expect(() =>
      WallpaperSettingsSchema.parse({ dataUrl: 'data:application/pdf;base64,JVBERi0=' })
    ).toThrow()
  })

  it('rechaza tipos que no recibe el schema', () => {
    expect(() => WallpaperSettingsSchema.parse({ dataUrl: 42 })).toThrow()
    expect(() => WallpaperSettingsSchema.parse(null)).toThrow()
  })

  it('widgetGlassAlpha tiene 0.8 por defecto', () => {
    const result = WallpaperSettingsSchema.parse({})
    expect(result.widgetGlassAlpha).toBe(0.8)
    expect(defaultWallpaperSettings.widgetGlassAlpha).toBe(0.8)
  })

  it('acepta widgetGlassAlpha en el rango 0.5-1', () => {
    expect(WallpaperSettingsSchema.parse({ widgetGlassAlpha: 0.5 }).widgetGlassAlpha).toBe(0.5)
    expect(WallpaperSettingsSchema.parse({ widgetGlassAlpha: 1 }).widgetGlassAlpha).toBe(1)
    expect(WallpaperSettingsSchema.parse({ widgetGlassAlpha: 0.65 }).widgetGlassAlpha).toBe(0.65)
  })

  it('rechaza widgetGlassAlpha fuera del rango o no numérico', () => {
    expect(() => WallpaperSettingsSchema.parse({ widgetGlassAlpha: 0.49 })).toThrow()
    expect(() => WallpaperSettingsSchema.parse({ widgetGlassAlpha: 1.01 })).toThrow()
    expect(() => WallpaperSettingsSchema.parse({ widgetGlassAlpha: '0.8' })).toThrow()
  })

  it('completa widgetGlassAlpha al parsear configs viejas que solo tienen dataUrl', () => {
    const result = WallpaperSettingsSchema.parse({ dataUrl: pngDataUrl })
    expect(result.widgetGlassAlpha).toBe(0.8)
    expect(result.dataUrl).toBe(pngDataUrl)
  })
})

describe('parseWallpaperSettingsJson', () => {
  it('parsea JSON válido con data URL de imagen', () => {
    const json = JSON.stringify({ dataUrl: pngDataUrl })
    expect(parseWallpaperSettingsJson(json)).toEqual({
      dataUrl: pngDataUrl,
      presetId: null,
      widgetGlassAlpha: 0.8,
    })
  })

  it('parsea JSON con alpha persistido', () => {
    const json = JSON.stringify({ dataUrl: null, widgetGlassAlpha: 0.6 })
    expect(parseWallpaperSettingsJson(json)).toEqual({
      dataUrl: null,
      presetId: null,
      widgetGlassAlpha: 0.6,
    })
  })

  it('parsea JSON con presetId persistido', () => {
    const json = JSON.stringify({ dataUrl: null, presetId: 'fondo-03', widgetGlassAlpha: 0.8 })
    expect(parseWallpaperSettingsJson(json)).toEqual({
      dataUrl: null,
      presetId: 'fondo-03',
      widgetGlassAlpha: 0.8,
    })
  })

  it('completa presetId null en JSON viejo sin presetId', () => {
    const json = JSON.stringify({ dataUrl: pngDataUrl })
    expect(parseWallpaperSettingsJson(json)).toEqual({
      dataUrl: pngDataUrl,
      presetId: null,
      widgetGlassAlpha: 0.8,
    })
  })

  it('devuelve el default con JSON null', () => {
    expect(parseWallpaperSettingsJson(null)).toEqual(defaultWallpaperSettings)
  })

  it('devuelve el default con JSON corrupto o inválido, sin lanzar', () => {
    expect(parseWallpaperSettingsJson('{no es json')).toEqual(defaultWallpaperSettings)
    expect(parseWallpaperSettingsJson(JSON.stringify({ dataUrl: 'nope' }))).toEqual(
      defaultWallpaperSettings
    )
    expect(parseWallpaperSettingsJson(JSON.stringify({ dataUrl: 123 }))).toEqual(
      defaultWallpaperSettings
    )
    expect(parseWallpaperSettingsJson(JSON.stringify({ widgetGlassAlpha: 2 }))).toEqual(
      defaultWallpaperSettings
    )
  })
})
