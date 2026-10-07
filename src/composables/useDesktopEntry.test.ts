import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { mkdir, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useDesktopEntry } from './useDesktopEntry'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}))

const HOME = '/home/ana'
const STABLE = '/home/ana/Applications/aeon.AppImage'
const DESKTOP_FILE = '/home/ana/.local/share/applications/aeon.desktop'
const ICON_FILE = '/home/ana/.local/share/icons/hicolor/256x256/apps/aeon.png'
const ICON_CACHE_FILE = '/home/ana/.local/share/icons/hicolor/icon-theme.cache'

describe('useDesktopEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(homeDir).mockResolvedValue(HOME)
    vi.mocked(invoke).mockResolvedValue(STABLE)
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(remove).mockResolvedValue(undefined)
    vi.mocked(rename).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(writeTextFile).mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no hace nada en modo desarrollo', async () => {
    const { ensureDesktopEntry } = useDesktopEntry(false)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('se saltea si no corre como AppImage', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(writeTextFile).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('renombra el AppImage y escribe el .desktop y el icono', async () => {
    vi.mocked(invoke).mockResolvedValue('/home/ana/Downloads/AEON_0.1.1_amd64.appimage')
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(true)
    expect(rename).toHaveBeenCalledWith('/home/ana/Downloads/AEON_0.1.1_amd64.appimage', STABLE)
    expect(writeTextFile).toHaveBeenCalledWith(
      DESKTOP_FILE,
      expect.stringContaining(`Exec=${STABLE}`)
    )
    expect(writeFile).toHaveBeenCalledWith(ICON_FILE, expect.any(Uint8Array))
  })

  it('no renombra si ya está en la ruta estable', async () => {
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(rename).not.toHaveBeenCalled()
    expect(writeTextFile).toHaveBeenCalledWith(
      DESKTOP_FILE,
      expect.stringContaining(`Exec=${STABLE}`)
    )
  })

  it('crea las carpetas destino antes de escribir', async () => {
    vi.mocked(invoke).mockResolvedValue('/home/ana/Downloads/AEON_0.1.1_amd64.appimage')
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await ensureDesktopEntry()
    expect(mkdir).toHaveBeenCalledWith('/home/ana/Applications', { recursive: true })
    expect(mkdir).toHaveBeenCalledWith('/home/ana/.local/share/applications', { recursive: true })
    expect(mkdir).toHaveBeenCalledWith('/home/ana/.local/share/icons/hicolor/256x256/apps', {
      recursive: true,
    })
  })

  it('es idempotente: re-escribe en cada arranque', async () => {
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await ensureDesktopEntry()
    await ensureDesktopEntry()
    expect(writeTextFile).toHaveBeenCalledTimes(2)
    expect(writeFile).toHaveBeenCalledTimes(2)
  })

  it('nunca rompe el arranque si falla la escritura', async () => {
    vi.mocked(writeTextFile).mockRejectedValue(new Error('permiso denegado'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('apunta al path original si no puede renombrar', async () => {
    vi.mocked(invoke).mockResolvedValue('/home/ana/Downloads/AEON_0.1.1_amd64.appimage')
    vi.mocked(rename).mockRejectedValue(new Error('cross-device'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(writeTextFile).toHaveBeenCalledWith(
      DESKTOP_FILE,
      expect.stringContaining('Exec=/home/ana/Downloads/AEON_0.1.1_amd64.appimage')
    )
    consoleError.mockRestore()
  })

  it('escribe el icono antes que la entrada del menú', async () => {
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await ensureDesktopEntry()
    const iconOrder = vi.mocked(writeFile).mock.invocationCallOrder.slice(-1)[0]
    const entryOrder = vi.mocked(writeTextFile).mock.invocationCallOrder.slice(-1)[0]
    expect(iconOrder).toBeLessThan(entryOrder)
  })

  it('invalida la caché del tema de iconos después de escribir el icono', async () => {
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await ensureDesktopEntry()
    expect(remove).toHaveBeenCalledWith(ICON_CACHE_FILE)
    const iconOrder = vi.mocked(writeFile).mock.invocationCallOrder.slice(-1)[0]
    const removeOrder = vi.mocked(remove).mock.invocationCallOrder.slice(-1)[0]
    expect(removeOrder).toBeGreaterThan(iconOrder)
  })

  it('sigue registrando aunque no exista la caché de iconos', async () => {
    vi.mocked(remove).mockRejectedValue(new Error('no existe'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(writeTextFile).toHaveBeenCalledWith(
      DESKTOP_FILE,
      expect.stringContaining(`Exec=${STABLE}`)
    )
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('igual escribe la entrada si falla el icono', async () => {
    vi.mocked(writeFile).mockRejectedValue(new Error('permiso denegado'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureDesktopEntry } = useDesktopEntry(true)
    await expect(ensureDesktopEntry()).resolves.toBe(false)
    expect(writeTextFile).toHaveBeenCalledWith(
      DESKTOP_FILE,
      expect.stringContaining(`Exec=${STABLE}`)
    )
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
