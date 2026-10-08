import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ExitEditDialog from './ExitEditDialog.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const ui = vi.hoisted(() => ({
  exitDialogOpen: true,
  resolveExitDialog: vi.fn(),
  cancelExitDialog: vi.fn(),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ui,
}))

let wrapper: VueWrapper | undefined

function factory() {
  wrapper = mount(ExitEditDialog, { attachTo: document.body })
  return wrapper
}

function dialogText(): string {
  return document.body.querySelector("[role='dialog']")?.textContent ?? ''
}

function findButton(label: string): HTMLElement {
  const found = Array.from(document.body.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label)
  )
  if (!found) throw new Error(`No se encontró el botón "${label}"`)
  return found
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('ExitEditDialog', () => {
  beforeEach(() => {
    ui.exitDialogOpen = true
  })

  it('no renderiza nada cuando está cerrado', () => {
    ui.exitDialogOpen = false
    factory()
    expect(document.body.querySelector("[role='dialog']")).toBeNull()
  })

  it('ofrece las tres resoluciones sin guardar nada por sí solo', () => {
    factory()
    expect(dialogText()).toContain('Cambios sin guardar')
    expect(findButton('Guardar y salir')).not.toBeNull()
    expect(findButton('Descartar cambios')).not.toBeNull()
    expect(findButton('Seguir editando')).not.toBeNull()
    expect(ui.resolveExitDialog).not.toHaveBeenCalled()
  })

  it('«Guardar y salir» resuelve con save', async () => {
    factory()
    await findButton('Guardar y salir').click()
    expect(ui.resolveExitDialog).toHaveBeenCalledWith('save')
  })

  it('«Descartar cambios» resuelve con discard', async () => {
    factory()
    await findButton('Descartar cambios').click()
    expect(ui.resolveExitDialog).toHaveBeenCalledWith('discard')
  })

  it('«Seguir editando» resuelve con cancel', async () => {
    factory()
    await findButton('Seguir editando').click()
    expect(ui.resolveExitDialog).toHaveBeenCalledWith('cancel')
  })

  it('Escape cierra el diálogo sin resolverlo', async () => {
    factory()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper!.vm.$nextTick()
    expect(ui.cancelExitDialog).toHaveBeenCalledTimes(1)
    expect(ui.resolveExitDialog).not.toHaveBeenCalled()
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const mounted = factory()
    expect(hasRawPaletteColor(mounted.html())).toBe(false)
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })
})
