import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import WidgetPicker from './WidgetPicker.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const mockAddWidget = vi.fn()
const layoutRef = ref([{ i: 'habits', x: 0, y: 0, w: 6, h: 4 }])

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({
    get layout() {
      return layoutRef.value
    },
    addWidget: mockAddWidget,
  }),
}))

let editModeValue = true

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    get editMode() {
      return editModeValue
    },
  }),
}))

describe('WidgetPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAddWidget.mockClear()
    editModeValue = true
  })

  it('no renderiza nada si editMode es false', () => {
    editModeValue = false
    const wrapper = mount(WidgetPicker)
    expect(wrapper.find("[data-testid='widget-picker']").exists()).toBe(false)
  })

  it('renderiza el botón + si editMode es true', () => {
    const wrapper = mount(WidgetPicker)
    expect(wrapper.find("[data-testid='widget-picker']").exists()).toBe(true)
  })

  it('muestra solo widgets que no están en el layout', async () => {
    const wrapper = mount(WidgetPicker)
    await wrapper.find("[data-testid='widget-picker-toggle']").trigger('click')
    const items = wrapper.findAll("[data-testid='widget-picker-item']")
    const ids = items.map((el) => el.attributes('data-widget-id'))
    expect(ids).not.toContain('habits')
    expect(ids).toContain('tasks')
    expect(ids).toContain('goals')
    expect(ids).toContain('pomodoro')
  })

  it('al clickear un widget disponible, llama addWidget', async () => {
    const wrapper = mount(WidgetPicker)
    await wrapper.find("[data-testid='widget-picker-toggle']").trigger('click')
    const tasksItem = wrapper.find("[data-widget-id='tasks']")
    await tasksItem.trigger('click')
    expect(mockAddWidget).toHaveBeenCalledWith('tasks')
  })

  it('muestra la insignia «Nuevo!» en el widget de Exámenes', async () => {
    const wrapper = mount(WidgetPicker)
    await wrapper.find("[data-testid='widget-picker-toggle']").trigger('click')
    const examsItem = wrapper.find("[data-widget-id='exams']")
    expect(examsItem.exists()).toBe(true)
    expect(examsItem.text()).toContain('Nuevo!')
  })

  it('no usa colores de paleta cruda de Tailwind', async () => {
    const wrapper = mount(WidgetPicker)
    await wrapper.find("[data-testid='widget-picker-toggle']").trigger('click')
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
