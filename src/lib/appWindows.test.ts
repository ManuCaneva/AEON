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

  it('enfocar la trae al frente y la enfoca', async () => {
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabel.mockResolvedValue({ show, setFocus })

    await expect(focusWindow('main')).resolves.toBe(true)
    expect(show).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
  })

  it('enfocar una ventana que no existe no hace nada y lo avisa', async () => {
    getByLabel.mockResolvedValue(null)

    await expect(focusWindow('main')).resolves.toBe(false)
    expect(getByLabel).toHaveBeenCalledWith('main')
  })
})
