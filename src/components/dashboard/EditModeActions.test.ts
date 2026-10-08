import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EditModeActions from './EditModeActions.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const mockSaveEdit = vi.fn()
const mockDiscardEdit = vi.fn()
const mockExitEditMode = vi.fn()

let hasUnsavedChangesValue = true

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({
    saveEdit: mockSaveEdit,
    discardEdit: mockDiscardEdit,
    get hasUnsavedChanges() {
      return hasUnsavedChangesValue
    },
  }),
}))

let editModeValue = true

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    get editMode() {
      return editModeValue
    },
    exitEditMode: mockExitEditMode,
  }),
}))

let wrapper: VueWrapper | undefined

function factory() {
  wrapper = mount(EditModeActions)
  return wrapper
}

function toastEl() {
  return document.body.querySelector('[data-testid="toast"]')
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('EditModeActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSaveEdit.mockClear()
    mockDiscardEdit.mockClear()
    mockExitEditMode.mockClear()
    editModeValue = true
    hasUnsavedChangesValue = true
  })

  it('no renderiza la barra fuera del modo edición', () => {
    editModeValue = false
    const w = factory()
    expect(w.find("[data-testid='edit-actions']").exists()).toBe(false)
  })

  it('renderiza los botones Guardar y Descartar cambios en modo edición', () => {
    const w = factory()
    const bar = w.find("[data-testid='edit-actions']")
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('Guardar')
    expect(bar.text()).toContain('Descartar cambios')
  })

  it('al clickear Descartar cambios restaura y cierra el modo edición, mostrando el aviso', async () => {
    const w = factory()
    await w.find("[data-testid='edit-discard']").trigger('click')
    expect(mockDiscardEdit).toHaveBeenCalledOnce()
    expect(mockExitEditMode).toHaveBeenCalledOnce()
    expect(mockDiscardEdit.mock.invocationCallOrder[0]).toBeLessThan(
      mockExitEditMode.mock.invocationCallOrder[0]
    )
    expect(toastEl()?.textContent).toContain('Cambios descartados')
  })

  it('al clickear Guardar persiste, cierra el modo edición y muestra el aviso', async () => {
    const w = factory()
    await w.find("[data-testid='edit-save']").trigger('click')
    expect(mockSaveEdit).toHaveBeenCalledOnce()
    expect(mockExitEditMode).toHaveBeenCalledOnce()
    expect(mockSaveEdit.mock.invocationCallOrder[0]).toBeLessThan(
      mockExitEditMode.mock.invocationCallOrder[0]
    )
    expect(toastEl()?.textContent).toContain('Cambios guardados')
  })

  it('deshabilita ambos botones cuando no hay cambios pendientes', () => {
    hasUnsavedChangesValue = false
    const w = factory()
    expect(w.find("[data-testid='edit-save']").attributes('disabled')).toBeDefined()
    expect(w.find("[data-testid='edit-discard']").attributes('disabled')).toBeDefined()
  })

  it('habilita ambos botones cuando hay cambios pendientes', () => {
    hasUnsavedChangesValue = true
    const w = factory()
    expect(w.find("[data-testid='edit-save']").attributes('disabled')).toBeUndefined()
    expect(w.find("[data-testid='edit-discard']").attributes('disabled')).toBeUndefined()
  })

  it('no muestra el aviso antes de guardar', () => {
    factory()
    expect(toastEl()).toBeNull()
  })

  it('el aviso se descarta solo tras ~1.5s', async () => {
    vi.useFakeTimers()
    const w = factory()
    await w.find("[data-testid='edit-save']").trigger('click')
    expect(toastEl()).not.toBeNull()

    vi.advanceTimersByTime(1500)
    await w.vm.$nextTick()
    expect(toastEl()).toBeNull()
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const w = factory()
    expect(hasRawPaletteColor(w.html())).toBe(false)
  })
})
