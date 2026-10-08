import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from './DashboardView.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

vi.mock('@/composables/useDashDrag', () => ({
  useDashDrag: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  listHabits: vi.fn().mockResolvedValue([]),
  listLogsInRange: vi.fn().mockResolvedValue([]),
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/habits', () => ({
  useHabitsStore: () => ({
    activeHabits: [],
    logs: [],
    completedToday: new Map(),
    isCompletedToday: vi.fn(() => false),
    incrementCheckIn: vi.fn(),
    decrementCheckIn: vi.fn(),
    loadInitialData: vi.fn(),
  }),
}))

let editModeValue = false
const mockRemoveWidget = vi.fn()
const mockResizeTo = vi.fn()

let layoutValue: Array<{ i: string; x: number; y: number; w: number; h: number }> = [
  { i: 'habits', x: 0, y: 0, w: 6, h: 4 },
]

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    get editMode() {
      return editModeValue
    },
    openCreate: vi.fn(),
    menuOpenForHabitId: null,
    toggleMenu: vi.fn(),
  }),
}))

vi.mock('@/stores/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/dashboard')>()
  return {
    wouldCollide: actual.wouldCollide,
    useDashboardStore: () => ({
      get layout() {
        return layoutValue
      },
      moveTo: vi.fn(),
      resizeTo: mockResizeTo,
      removeWidget: mockRemoveWidget,
      saveEdit: vi.fn(),
      discardEdit: vi.fn(),
    }),
  }
})

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    editModeValue = false
    layoutValue = [{ i: 'habits', x: 0, y: 0, w: 6, h: 4 }]
    mockRemoveWidget.mockClear()
  })

  it('renderiza el contenedor del dashboard', () => {
    const wrapper = mount(DashboardView)
    expect(wrapper.find("[data-testid='dashboard-view']").exists()).toBe(true)
  })

  it('el contenedor de la grilla usa display: grid con 12 columnas y 10 filas sin mínimo implícito', () => {
    const wrapper = mount(DashboardView)
    const grid = wrapper.find('.dashboard-grid')
    const style = grid.attributes('style') ?? ''
    expect(style).toContain('display: grid')
    expect(style).toContain('grid-template-columns: repeat(12, minmax(0, 1fr))')
    expect(style).toContain('grid-template-rows: repeat(10, minmax(0, 1fr))')
    expect(style).toContain('gap: 4px')
  })

  it('renderiza GridItemVue para cada item del layout sin prop dims', () => {
    const wrapper = mount(DashboardView)
    const items = wrapper.findAllComponents({ name: 'GridItemVue' })
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0].props('dims')).toBeUndefined()
    expect(items[0].props('item')).toMatchObject({ x: 0, y: 0, w: 6, h: 4 })
  })

  it('root element has h-full and overflow-hidden', () => {
    const wrapper = mount(DashboardView)
    const root = wrapper.find("[data-testid='dashboard-view']")
    expect(root.classes()).toContain('h-full')
    expect(root.classes()).toContain('overflow-hidden')
  })

  it('en modo edición el root no recorta para que la cruz pueda sobresalir del borde de la vista', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const root = wrapper.find("[data-testid='dashboard-view']")
    expect(root.classes()).not.toContain('overflow-hidden')
  })

  it('no renderiza WidgetPicker si editMode es false', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    expect(wrapper.find("[data-testid='widget-picker']").exists()).toBe(false)
  })

  it('renderiza WidgetPicker si editMode es true', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    expect(wrapper.find("[data-testid='widget-picker']").exists()).toBe(true)
  })

  it('renderiza la barra de acciones de edición si editMode es true', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    expect(wrapper.find("[data-testid='edit-actions']").exists()).toBe(true)
  })

  it('no renderiza la barra de acciones de edición si editMode es false', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    expect(wrapper.find("[data-testid='edit-actions']").exists()).toBe(false)
  })

  it('en modo edición aísla los z-index de los items dentro de la grilla', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    expect(wrapper.find('.dashboard-grid').classes()).toContain('isolate')
  })

  it('en reposo la grilla no crea stacking context', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    expect(wrapper.find('.dashboard-grid').classes()).not.toContain('isolate')
  })

  it('renderiza WidgetRemoveButton en cada widget si editMode es true', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const removeButtons = wrapper.findAllComponents({ name: 'WidgetRemoveButton' })
    expect(removeButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('al entrar en modo edición los widgets conservan su tamaño (sin padding)', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const root = wrapper.find("[data-testid='dashboard-view']")
    expect(root.classes()).not.toContain('p-3')
  })

  it('en reposo la vista no agrega padding', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    const root = wrapper.find("[data-testid='dashboard-view']")
    expect(root.classes()).not.toContain('p-3')
  })

  it('no renderiza WidgetRemoveButton si editMode es false', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    const removeButtons = wrapper.findAllComponents({ name: 'WidgetRemoveButton' })
    expect(removeButtons.length).toBe(0)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('en modo edición dibuja las líneas de la grilla', () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    expect(wrapper.find('[data-testid="dashboard-grid-lines"]').exists()).toBe(true)
  })

  it('fuera del modo edición no queda rastro de las líneas de la grilla', () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    expect(wrapper.find('[data-testid="dashboard-grid-lines"]').exists()).toBe(false)
  })

  it('al remover un widget, llama removeWidget del store', async () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const removeBtn = wrapper.findComponent({ name: 'WidgetRemoveButton' })
    removeBtn.vm.$emit('remove', 'habits')
    await wrapper.vm.$nextTick()
    expect(mockRemoveWidget).toHaveBeenCalledWith('habits')
  })

  it('al redimensionar reenvía posición y tamaño al store', async () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('resized', 'habits', 1, 2, 5, 4)
    await wrapper.vm.$nextTick()
    expect(mockResizeTo).toHaveBeenCalledWith('habits', 5, 4, 1, 2)
  })

  it('en modo edición dibuja la zona de destino durante el gesto', async () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 1, 2, 3, 4)
    await wrapper.vm.$nextTick()
    const zone = wrapper.findComponent({ name: 'DropZonePreview' })
    expect(zone.exists()).toBe(true)
    expect(zone.props()).toMatchObject({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('la zona de destino vive dentro de la grilla del dashboard', async () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 1, 1, 2, 2)
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('.dashboard-grid').findComponent({ name: 'DropZonePreview' }).exists()
    ).toBe(true)
  })

  it('marca la zona de destino como libre si no colisiona (ignorándose a sí misma)', async () => {
    editModeValue = true
    layoutValue = [
      { i: 'habits', x: 0, y: 0, w: 2, h: 4 },
      { i: 'tasks', x: 2, y: 0, w: 4, h: 4 },
    ]
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 0, 6, 2, 4)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'DropZonePreview' }).props('occupied')).toBe(false)
  })

  it('marca la zona de destino como ocupada si colisiona con otro widget', async () => {
    editModeValue = true
    layoutValue = [
      { i: 'habits', x: 0, y: 0, w: 2, h: 4 },
      { i: 'tasks', x: 2, y: 0, w: 4, h: 4 },
    ]
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 2, 0, 2, 4)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'DropZonePreview' }).props('occupied')).toBe(true)
  })

  it('quita la zona de destino al terminar el gesto', async () => {
    editModeValue = true
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 1, 1, 2, 2)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'DropZonePreview' }).exists()).toBe(true)
    item.vm.$emit('preview-end')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'DropZonePreview' }).exists()).toBe(false)
  })

  it('no dibuja zona de destino fuera del modo edición', async () => {
    editModeValue = false
    const wrapper = mount(DashboardView)
    const item = wrapper.findComponent({ name: 'GridItemVue' })
    item.vm.$emit('preview', 'habits', 1, 1, 2, 2)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'DropZonePreview' }).exists()).toBe(false)
  })
})
