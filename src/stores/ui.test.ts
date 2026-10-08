import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as db from '@/lib/db'
import { useUiStore } from './ui'
import { useDashboardStore } from './dashboard'

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

describe('ui store: modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
  })

  it('al entrar al modo edición abre una sesión de borrador', () => {
    const ui = useUiStore()
    const dashboard = useDashboardStore()
    const beginEdit = vi.spyOn(dashboard, 'beginEdit')
    ui.toggleEditMode()
    expect(ui.editMode).toBe(true)
    expect(beginEdit).toHaveBeenCalledTimes(1)
  })

  it('al salir del modo edición cierra la sesión sin persistir', () => {
    const ui = useUiStore()
    const dashboard = useDashboardStore()
    const endEdit = vi.spyOn(dashboard, 'endEdit')
    ui.toggleEditMode()
    ui.toggleEditMode()
    expect(ui.editMode).toBe(false)
    expect(endEdit).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).not.toHaveBeenCalled()
  })
})

describe('ui store: exclusividad del modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
  })

  it('al navegar sin cambios, el modo edición se apaga', () => {
    const ui = useUiStore()
    ui.toggleEditMode()
    ui.setViewMode('settings')
    expect(ui.viewMode).toBe('settings')
    expect(ui.editMode).toBe(false)
    expect(ui.exitDialogOpen).toBe(false)
  })

  it('al navegar sin cambios, la sesión de borrador se cierra', () => {
    const ui = useUiStore()
    const dashboard = useDashboardStore()
    const endEdit = vi.spyOn(dashboard, 'endEdit')
    ui.toggleEditMode()
    ui.setViewMode('archived')
    expect(endEdit).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).not.toHaveBeenCalled()
  })

  it('la edición nunca queda activa con la vista fuera del dashboard', () => {
    const ui = useUiStore()
    ui.toggleEditMode()
    for (const mode of ['archived', 'pomodoro', 'settings'] as const) {
      ui.setViewMode(mode)
      expect(ui.editMode).toBe(false)
      ui.toggleEditMode()
      expect(ui.viewMode).toBe('dashboard')
      expect(ui.editMode).toBe(true)
    }
  })

  it('desde otra vista, el atajo de modo edición lleva al dashboard y lo activa', () => {
    const ui = useUiStore()
    ui.setViewMode('pomodoro')
    ui.toggleEditMode()
    expect(ui.viewMode).toBe('dashboard')
    expect(ui.editMode).toBe(true)
  })

  it('desde otra vista, el atajo abre una sesión de borrador', () => {
    const ui = useUiStore()
    const dashboard = useDashboardStore()
    const beginEdit = vi.spyOn(dashboard, 'beginEdit')
    ui.setViewMode('settings')
    ui.toggleEditMode()
    expect(beginEdit).toHaveBeenCalledTimes(1)
  })
})

describe('ui store: diálogo de salida', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
  })

  /** Entra al modo edición y quita un widget: deja cambios sin guardar. */
  function enterEditWithChanges() {
    const ui = useUiStore()
    const dashboard = useDashboardStore()
    ui.toggleEditMode()
    dashboard.removeWidget(dashboard.layout[0].i)
    return { ui, dashboard }
  }

  it('sin cambios, el toggle de modo edición sale directo', () => {
    const ui = useUiStore()
    ui.toggleEditMode()
    ui.toggleEditMode()
    expect(ui.editMode).toBe(false)
    expect(ui.exitDialogOpen).toBe(false)
  })

  it('con cambios, el toggle de modo edición abre el diálogo y no sale', () => {
    const { ui, dashboard } = enterEditWithChanges()
    ui.toggleEditMode()
    expect(ui.exitDialogOpen).toBe(true)
    expect(ui.pendingView).toBeNull()
    expect(ui.editMode).toBe(true)
    expect(dashboard.hasUnsavedChanges).toBe(true)
    expect(db.saveConfig).not.toHaveBeenCalled()
  })

  it('sin cambios, navegar a otra vista es inmediato y sin diálogo', () => {
    const ui = useUiStore()
    ui.toggleEditMode()
    ui.setViewMode('settings')
    expect(ui.viewMode).toBe('settings')
    expect(ui.exitDialogOpen).toBe(false)
  })

  it('con cambios, navegar abre el diálogo antes de cambiar de vista', () => {
    const { ui } = enterEditWithChanges()
    ui.setViewMode('settings')
    expect(ui.exitDialogOpen).toBe(true)
    expect(ui.pendingView).toBe('settings')
    expect(ui.viewMode).toBe('dashboard')
    expect(db.saveConfig).not.toHaveBeenCalled()
  })

  it('«Guardar y salir» persiste, apaga la edición y navega al destino pendiente', () => {
    const { ui } = enterEditWithChanges()
    ui.setViewMode('archived')
    ui.resolveExitDialog('save')
    expect(db.saveConfig).toHaveBeenCalledWith('aeon-dashboard-layout', expect.any(String))
    expect(ui.editMode).toBe(false)
    expect(ui.exitDialogOpen).toBe(false)
    expect(ui.pendingView).toBeNull()
    expect(ui.viewMode).toBe('archived')
  })

  it('«Guardar y salir» sin destino pendiente no navega', () => {
    const { ui } = enterEditWithChanges()
    ui.toggleEditMode()
    ui.resolveExitDialog('save')
    expect(ui.editMode).toBe(false)
    expect(ui.viewMode).toBe('dashboard')
    expect(db.saveConfig).toHaveBeenCalled()
  })

  it('«Descartar cambios» restaura el snapshot, apaga la edición y navega', () => {
    const { ui, dashboard } = enterEditWithChanges()
    const expected = dashboard.layout.length + 1
    ui.setViewMode('pomodoro')
    ui.resolveExitDialog('discard')
    expect(dashboard.layout.length).toBe(expected)
    expect(dashboard.hasUnsavedChanges).toBe(false)
    expect(ui.editMode).toBe(false)
    expect(ui.exitDialogOpen).toBe(false)
    expect(ui.viewMode).toBe('pomodoro')
    expect(db.saveConfig).not.toHaveBeenCalled()
  })

  it('«Seguir editando» cierra el diálogo sin persistir, restaurar ni navegar', () => {
    const { ui, dashboard } = enterEditWithChanges()
    ui.setViewMode('settings')
    ui.resolveExitDialog('cancel')
    expect(ui.exitDialogOpen).toBe(false)
    expect(ui.pendingView).toBeNull()
    expect(ui.editMode).toBe(true)
    expect(ui.viewMode).toBe('dashboard')
    expect(dashboard.hasUnsavedChanges).toBe(true)
    expect(db.saveConfig).not.toHaveBeenCalled()
  })

  it('cancelExitDialog es equivalente a «Seguir editando»', () => {
    const { ui } = enterEditWithChanges()
    ui.toggleEditMode()
    ui.cancelExitDialog()
    expect(ui.exitDialogOpen).toBe(false)
    expect(ui.pendingView).toBeNull()
    expect(ui.editMode).toBe(true)
  })
})
