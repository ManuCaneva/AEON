import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WallpaperCard from './WallpaperCard.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { MAX_WALLPAPER_BYTES } from '@/lib/wallpaper'

vi.mock('@/lib/wallpaper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallpaper')>()
  return {
    ...actual,
    fileToDataUrl: vi.fn(),
  }
})

vi.mock('@/lib/presetWallpapers', () => ({
  PRESET_WALLPAPERS: [
    { id: 'fondo-01', label: 'Fondo 1', url: '/preset/fondo-01.jpg' },
    { id: 'fondo-02', label: 'Fondo 2', url: '/preset/fondo-02.jpg' },
    { id: 'fondo-03', label: 'Fondo 3', url: '/preset/fondo-03.jpg' },
  ],
  isPresetWallpaperId: (id: unknown): boolean =>
    typeof id === 'string' && ['fondo-01', 'fondo-02', 'fondo-03'].includes(id),
  presetWallpaperUrl: (id: string | null | undefined): string | null => {
    const known: Record<string, string> = {
      'fondo-01': '/preset/fondo-01.jpg',
      'fondo-02': '/preset/fondo-02.jpg',
      'fondo-03': '/preset/fondo-03.jpg',
    }
    return typeof id === 'string' ? (known[id] ?? null) : null
  },
}))

import { fileToDataUrl } from '@/lib/wallpaper'

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const uiMock = {
  wallpaperUrl: null as string | null,
  wallpaperPresetId: null as string | null,
  widgetGlassAlpha: 0.8,
  setWallpaper: vi.fn().mockResolvedValue(undefined),
  setWallpaperPreset: vi.fn().mockResolvedValue(undefined),
  removeWallpaper: vi.fn().mockResolvedValue(undefined),
  setWidgetGlassAlpha: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function pngFile(sizeBytes = 10, name = 'fondo.png'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/png' })
}

function changeWith(w: ReturnType<typeof mount>, file: File | null) {
  const input = w.find("[data-testid='wallpaper-input']").element as HTMLInputElement
  if (file) {
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
  } else {
    Object.defineProperty(input, 'files', { value: null, configurable: true })
  }
  return w.find("[data-testid='wallpaper-input']").trigger('change')
}

describe('WallpaperCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileToDataUrl).mockResolvedValue(PNG_DATA_URL)
    uiMock.wallpaperUrl = null
    uiMock.wallpaperPresetId = null
    uiMock.widgetGlassAlpha = 0.8
    uiMock.setWallpaper.mockClear().mockResolvedValue(undefined)
    uiMock.setWallpaperPreset.mockClear().mockResolvedValue(undefined)
    uiMock.removeWallpaper.mockClear().mockResolvedValue(undefined)
    uiMock.setWidgetGlassAlpha.mockClear().mockResolvedValue(undefined)
  })

  it('muestra botón subir y no muestra quitar sin wallpaper', () => {
    const w = mount(WallpaperCard)
    expect(w.find("[data-testid='wallpaper-upload-btn']").exists()).toBe(true)
    expect(w.find("[data-testid='wallpaper-remove-btn']").exists()).toBe(false)
  })

  it('la vista previa siempre es visible, con o sin fondo', () => {
    expect(mount(WallpaperCard).find("[data-testid='wallpaper-preview']").exists()).toBe(true)
    uiMock.wallpaperUrl = PNG_DATA_URL
    expect(mount(WallpaperCard).find("[data-testid='wallpaper-preview']").exists()).toBe(true)
  })

  it('la vista previa incluye el mock de UI desenfocado', () => {
    const w = mount(WallpaperCard)
    expect(w.find("[data-testid='wallpaper-preview-mock']").exists()).toBe(true)
  })

  it('input file oculto acepta solo imágenes', () => {
    const w = mount(WallpaperCard)
    const input = w.find("[data-testid='wallpaper-input']")
    expect(input.attributes('type')).toBe('file')
    expect(input.attributes('accept')).toBe('image/*')
    expect(input.classes()).toContain('hidden')
  })

  it('subir un archivo válido llama setWallpaper con la data URL', async () => {
    const w = mount(WallpaperCard)
    await changeWith(w, pngFile())
    await w.vm.$nextTick()
    expect(uiMock.setWallpaper).toHaveBeenCalledWith(PNG_DATA_URL)
  })

  it('con wallpaper: muestra preview y botón quitar; quitar llama removeWallpaper', async () => {
    uiMock.wallpaperUrl = PNG_DATA_URL
    const w = mount(WallpaperCard)
    const preview = w.find("[data-testid='wallpaper-preview']")
    expect(preview.exists()).toBe(true)
    // el marco delimita la previa: borde visible + esquinas redondeadas
    expect(preview.classes()).toContain('border-hairline-strong')
    expect(preview.classes()).toContain('rounded-md')
    // la imagen de fondo lleva el blur en su propia capa, igual que WallpaperLayer;
    // el mock del esqueleto queda nítido por encima
    const image = w.find("[data-testid='wallpaper-preview-image']")
    expect(image.exists()).toBe(true)
    expect((image.element as HTMLElement).style.backgroundImage).toContain(PNG_DATA_URL)
    expect(image.classes()).toContain('wallpaper-image-blur')
    expect(preview.classes()).not.toContain('wallpaper-image-blur')
    expect(preview.find('.wallpaper-scrim').exists()).toBe(true)
    expect(w.find("[data-testid='wallpaper-remove-btn']").exists()).toBe(true)
    await w.find("[data-testid='wallpaper-remove-btn']").trigger('click')
    expect(uiMock.removeWallpaper).toHaveBeenCalled()
  })

  it('con preset: muestra quitar aunque no haya data URL custom', () => {
    uiMock.wallpaperUrl = '/preset/fondo-01.jpg'
    uiMock.wallpaperPresetId = 'fondo-01'
    const w = mount(WallpaperCard)
    expect(w.find("[data-testid='wallpaper-remove-btn']").exists()).toBe(true)
  })

  it('renderiza un círculo por cada preset con su imagen', () => {
    const w = mount(WallpaperCard)
    const group = w.find("[data-testid='wallpaper-preset-group']")
    expect(group.exists()).toBe(true)
    expect(group.attributes('role')).toBe('radiogroup')
    const options = w.findAll("[data-testid^='wallpaper-preset-']")
    const presets = options.filter((o) => o.attributes('data-testid') !== 'wallpaper-preset-group')
    expect(presets).toHaveLength(3)
    for (const option of presets) {
      expect(option.attributes('role')).toBe('radio')
      expect((option.element as HTMLElement).style.backgroundImage).toContain('/preset/')
    }
  })

  it('elegir un preset llama setWallpaperPreset con su id', async () => {
    const w = mount(WallpaperCard)
    await w.find("[data-testid='wallpaper-preset-fondo-02']").trigger('click')
    expect(uiMock.setWallpaperPreset).toHaveBeenCalledWith('fondo-02')
    expect(uiMock.setWallpaper).not.toHaveBeenCalled()
  })

  it('el preset seleccionado se marca como checked', () => {
    uiMock.wallpaperPresetId = 'fondo-02'
    uiMock.wallpaperUrl = '/preset/fondo-02.jpg'
    const w = mount(WallpaperCard)
    expect(w.find("[data-testid='wallpaper-preset-fondo-02']").attributes('aria-checked')).toBe(
      'true'
    )
    expect(w.find("[data-testid='wallpaper-preset-fondo-01']").attributes('aria-checked')).toBe(
      'false'
    )
  })

  it('fallo al guardar preset: feedback visible', async () => {
    uiMock.setWallpaperPreset.mockRejectedValueOnce(new Error('db down'))
    const w = mount(WallpaperCard)
    await w.find("[data-testid='wallpaper-preset-fondo-01']").trigger('click')
    await w.vm.$nextTick()
    expect(w.text()).toContain('guardar')
  })

  it('archivo no imagen: feedback visible y no persiste', async () => {
    const w = mount(WallpaperCard)
    await changeWith(w, new File([new Uint8Array(5)], 'cv.pdf', { type: 'application/pdf' }))
    await w.vm.$nextTick()
    expect(w.text()).toContain('imagen')
    expect(uiMock.setWallpaper).not.toHaveBeenCalled()
  })

  it('archivo demasiado grande: feedback visible y no persiste', async () => {
    const w = mount(WallpaperCard)
    await changeWith(w, pngFile(MAX_WALLPAPER_BYTES + 1))
    await w.vm.$nextTick()
    expect(w.text()).toContain('MB')
    expect(uiMock.setWallpaper).not.toHaveBeenCalled()
  })

  it('change sin archivo no hace nada', async () => {
    const w = mount(WallpaperCard)
    await changeWith(w, null)
    expect(uiMock.setWallpaper).not.toHaveBeenCalled()
  })

  it('fallo de persistencia: feedback de guardado, no de lectura', async () => {
    const w = mount(WallpaperCard)
    uiMock.setWallpaper.mockRejectedValueOnce(new Error('db down'))
    await changeWith(w, pngFile())
    await w.vm.$nextTick()
    expect(w.text()).toContain('guardar')
    expect(w.text()).not.toContain('leer')
  })

  it('muestra el slider de translucidez con el valor del store', () => {
    uiMock.widgetGlassAlpha = 0.7
    const w = mount(WallpaperCard)
    const slider = w.find("[data-testid='glass-alpha-slider']")
    expect(slider.exists()).toBe(true)
    expect((slider.element as HTMLInputElement).value).toBe('0.7')
    expect((slider.element as HTMLInputElement).min).toBe('0.5')
    expect((slider.element as HTMLInputElement).max).toBe('1')
    expect(w.text()).toContain('70')
  })

  it('mover el slider llama setWidgetGlassAlpha con el nuevo valor', async () => {
    const w = mount(WallpaperCard)
    const slider = w.find("[data-testid='glass-alpha-slider']")
    await slider.setValue('0.55')
    expect(uiMock.setWidgetGlassAlpha).toHaveBeenCalledWith(0.55)
  })

  it('el slider no aparece como input numérico sino de rango', () => {
    const w = mount(WallpaperCard)
    expect(w.find("[data-testid='glass-alpha-slider']").attributes('type')).toBe('range')
  })

  it('no usa colores de paleta crudos de Tailwind', () => {
    const w = mount(WallpaperCard)
    expect(hasRawPaletteColor(w.html())).toBe(false)
  })
})
