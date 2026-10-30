import { beforeEach, describe, expect, it, vi } from 'vitest'
import { focusWindow, windowExists } from './appWindows'

const { getByLabel } = vi.hoisted(() => ({ getByLabel: vi.fn() }))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getByLabel },
}))

describe('ventanas de la app', () => {
  beforeEach(() => {
    getByLabel.mockReset()
  })

  it('una ventana existe aunque esté minimizada u oculta', async () => {
    getByLabel.mockResolvedValue({ show: vi.fn(), setFocus: vi.fn() })

    await expect(windowExists('main')).resolves.toBe(true)
  })

  it('una ventana que no existe no está abierta', async () => {
    getByLabel.mockResolvedValue(null)

    await expect(windowExists('main')).resolves.toBe(false)
  })

  it('enfocar restaura la ventana antes de mostrarla y enfocarla', async () => {
    const unminimize = vi.fn().mockResolvedValue(undefined)
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabel.mockResolvedValue({ unminimize, show, setFocus })

    await expect(focusWindow('main')).resolves.toBe(true)
    expect(unminimize).toHaveBeenCalledOnce()
    expect(show).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
    expect(unminimize.mock.invocationCallOrder[0]).toBeLessThan(show.mock.invocationCallOrder[0])
    expect(show.mock.invocationCallOrder[0]).toBeLessThan(setFocus.mock.invocationCallOrder[0])
  })

  it('enfocar una ventana que no existe no hace nada y lo avisa', async () => {
    getByLabel.mockResolvedValue(null)

    await expect(focusWindow('main')).resolves.toBe(false)
    expect(getByLabel).toHaveBeenCalledWith('main')
  })
})
