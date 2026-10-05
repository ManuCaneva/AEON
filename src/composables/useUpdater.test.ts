import { beforeEach, describe, expect, it, vi } from 'vitest'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useUpdater } from './useUpdater'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))

const DISMISSED_KEY = 'aeon.updater.dismissed'
const RELEASES_URL = 'https://github.com/ManuCaneva/AEON/releases/latest'

type DownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }

/** Construye un `Update` falso con la forma mínima que usa el composable. */
function fakeUpdate(overrides: Record<string, unknown> = {}): Update {
  return {
    version: '0.2.0',
    currentVersion: '0.1.0',
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Update
}

describe('useUpdater', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
  })

  it('no chequea nada en modo desarrollo', async () => {
    const updater = useUpdater(false)
    await updater.checkForUpdate()
    expect(check).not.toHaveBeenCalled()
  })

  it('queda en reposo si no hay actualización', async () => {
    vi.mocked(check).mockResolvedValue(null)
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    expect(updater.status.value).toBe('idle')
  })

  it('expone la versión nueva cuando hay actualización', async () => {
    vi.mocked(check).mockResolvedValue(fakeUpdate({ version: '0.2.0' }))
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    expect(updater.status.value).toBe('available')
    expect(updater.version.value).toBe('0.2.0')
  })

  it('no rompe ni avisa cuando el chequeo falla', async () => {
    vi.mocked(check).mockRejectedValue(new Error('sin red'))
    const updater = useUpdater(true)
    await expect(updater.checkForUpdate()).resolves.toBeUndefined()
    expect(updater.status.value).toBe('idle')
  })

  it('no vuelve a ofrecer una versión que el usuario silenció', async () => {
    localStorage.setItem(DISMISSED_KEY, '0.2.0')
    const update = fakeUpdate({ version: '0.2.0' })
    vi.mocked(check).mockResolvedValue(update)
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    expect(updater.status.value).toBe('idle')
    expect(update.close).toHaveBeenCalledOnce()
  })

  it('sí ofrece una versión más nueva que la silenciada', async () => {
    localStorage.setItem(DISMISSED_KEY, '0.2.0')
    vi.mocked(check).mockResolvedValue(fakeUpdate({ version: '0.3.0' }))
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    expect(updater.status.value).toBe('available')
  })

  it('dismissForever guarda la versión silenciada', async () => {
    vi.mocked(check).mockResolvedValue(fakeUpdate({ version: '0.2.0' }))
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    updater.dismissForever()
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('0.2.0')
    expect(updater.status.value).toBe('idle')
  })

  it('dismiss cierra sin silenciar la versión', async () => {
    vi.mocked(check).mockResolvedValue(fakeUpdate({ version: '0.2.0' }))
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    updater.dismiss()
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull()
    expect(updater.status.value).toBe('idle')
  })

  it('descarga, instala y reinicia la app', async () => {
    const update = fakeUpdate()
    vi.mocked(check).mockResolvedValue(update)
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    await updater.update()
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(relaunch).toHaveBeenCalledOnce()
    expect(openUrl).not.toHaveBeenCalled()
  })

  it('reporta el progreso de la descarga', async () => {
    const update = fakeUpdate({
      downloadAndInstall: vi.fn(async (onEvent: (event: DownloadEvent) => void) => {
        onEvent({ event: 'Started', data: { contentLength: 100 } })
        onEvent({ event: 'Progress', data: { chunkLength: 40 } })
        onEvent({ event: 'Finished' })
      }),
    })
    vi.mocked(check).mockResolvedValue(update)
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    await updater.update()
    expect(updater.progress.value).toBe(1)
  })

  it('si la descarga falla abre la página de descargas', async () => {
    const update = fakeUpdate({
      downloadAndInstall: vi.fn().mockRejectedValue(new Error('ruta de solo lectura')),
    })
    vi.mocked(check).mockResolvedValue(update)
    const updater = useUpdater(true)
    await updater.checkForUpdate()
    await updater.update()
    expect(updater.status.value).toBe('error')
    expect(openUrl).toHaveBeenCalledWith(RELEASES_URL)
    expect(relaunch).not.toHaveBeenCalled()
  })
})
