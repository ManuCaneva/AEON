import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as db from '@/lib/db'
import { useUiStore } from './ui'

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('ui store: wallpaper', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
  })

  it('arranca con wallpaperUrl null', () => {
    const ui = useUiStore()
    expect(ui.wallpaperUrl).toBeNull()
  })

  it('loadWallpaper restaura la data URL persistida', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue(JSON.stringify({ dataUrl: PNG_DATA_URL }))
    const ui = useUiStore()
    await ui.loadWallpaper()
    expect(ui.wallpaperUrl).toBe(PNG_DATA_URL)
  })

  it('loadWallpaper cae a null con config corrupta, sin lanzar', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue('{roto')
    const ui = useUiStore()
    await expect(ui.loadWallpaper()).resolves.not.toThrow()
    expect(ui.wallpaperUrl).toBeNull()
  })

  it('loadWallpaper cae a null con config que no es imagen', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue(
      JSON.stringify({ dataUrl: 'data:text/html;base64,PGgxPg==' })
    )
    const ui = useUiStore()
    await ui.loadWallpaper()
    expect(ui.wallpaperUrl).toBeNull()
  })

  it('setWallpaper persiste el JSON en el KV y actualiza el estado', async () => {
    const ui = useUiStore()
    await ui.setWallpaper(PNG_DATA_URL)
    expect(db.saveConfig).toHaveBeenCalledWith(
      'wallpaper-settings',
      JSON.stringify({ dataUrl: PNG_DATA_URL, widgetGlassAlpha: 0.8 })
    )
    expect(ui.wallpaperUrl).toBe(PNG_DATA_URL)
  })

  it('setWallpaper preserva el alpha de widgets configurado', async () => {
    const ui = useUiStore()
    await ui.setWidgetGlassAlpha(0.6)
    vi.mocked(db.saveConfig).mockClear()
    await ui.setWallpaper(PNG_DATA_URL)
    expect(db.saveConfig).toHaveBeenCalledWith(
      'wallpaper-settings',
      JSON.stringify({ dataUrl: PNG_DATA_URL, widgetGlassAlpha: 0.6 })
    )
  })

  it('removeWallpaper persiste null y limpia el estado', async () => {
    const ui = useUiStore()
    await ui.setWallpaper(PNG_DATA_URL)
    vi.mocked(db.saveConfig).mockClear()
    await ui.removeWallpaper()
    expect(db.saveConfig).toHaveBeenCalledWith(
      'wallpaper-settings',
      JSON.stringify({ dataUrl: null, widgetGlassAlpha: 0.8 })
    )
    expect(ui.wallpaperUrl).toBeNull()
  })

  it('arranca con widgetGlassAlpha 0.8', () => {
    const ui = useUiStore()
    expect(ui.widgetGlassAlpha).toBe(0.8)
  })

  it('loadWallpaper restaura el alpha persistido y lo aplica como CSS var', async () => {
    vi.mocked(db.loadConfig).mockResolvedValue(
      JSON.stringify({ dataUrl: null, widgetGlassAlpha: 0.55 })
    )
    const ui = useUiStore()
    await ui.loadWallpaper()
    expect(ui.widgetGlassAlpha).toBe(0.55)
    expect(document.documentElement.style.getPropertyValue('--glass-widget-alpha')).toBe('0.55')
  })

  it('loadWallpaper aplica el default 0.8 como CSS var cuando no hay config', async () => {
    document.documentElement.style.removeProperty('--glass-widget-alpha')
    const ui = useUiStore()
    await ui.loadWallpaper()
    expect(ui.widgetGlassAlpha).toBe(0.8)
    expect(document.documentElement.style.getPropertyValue('--glass-widget-alpha')).toBe('0.8')
  })

  it('setWidgetGlassAlpha persiste y actualiza la CSS var', async () => {
    const ui = useUiStore()
    await ui.setWidgetGlassAlpha(0.7)
    expect(db.saveConfig).toHaveBeenCalledWith(
      'wallpaper-settings',
      JSON.stringify({ dataUrl: null, widgetGlassAlpha: 0.7 })
    )
    expect(ui.widgetGlassAlpha).toBe(0.7)
    expect(document.documentElement.style.getPropertyValue('--glass-widget-alpha')).toBe('0.7')
  })

  it('setWidgetGlassAlpha rechaza valores fuera de rango y no persiste', async () => {
    const ui = useUiStore()
    await expect(ui.setWidgetGlassAlpha(0.3)).rejects.toThrow()
    expect(db.saveConfig).not.toHaveBeenCalled()
    expect(ui.widgetGlassAlpha).toBe(0.8)
  })

  it('setWallpaper rechaza una data URL no imagen y no persiste', async () => {
    const ui = useUiStore()
    await expect(ui.setWallpaper('https://ejemplo.com/foto.png')).rejects.toThrow()
    expect(db.saveConfig).not.toHaveBeenCalled()
    expect(ui.wallpaperUrl).toBeNull()
  })
})

describe('ui store: tamaño de letra', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
    document.documentElement.style.removeProperty('--text-scale')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('arranca con Mediano (default) y lo aplica como --text-scale', () => {
    const ui = useUiStore()
    expect(ui.textSize).toBe('medium')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1')
  })

  it('setTextSize persiste la elección en localStorage', () => {
    const ui = useUiStore()
    ui.setTextSize('large')
    expect(ui.textSize).toBe('large')
    expect(JSON.parse(localStorage.getItem('aeon.textSize') as string)).toBe('large')
  })

  it('setTextSize aplica --text-scale al instante', () => {
    const ui = useUiStore()
    ui.setTextSize('small')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('0.9')
    ui.setTextSize('large')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15')
  })

  it('lee una elección persistida válida al iniciar', () => {
    localStorage.setItem('aeon.textSize', JSON.stringify('large'))
    const ui = useUiStore()
    expect(ui.textSize).toBe('large')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15')
  })

  it('cae a Mediano con una elección persistida inválida', () => {
    localStorage.setItem('aeon.textSize', JSON.stringify('enorme'))
    const ui = useUiStore()
    expect(ui.textSize).toBe('medium')
  })
})
