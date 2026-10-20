import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExamsWidget from './ExamsWidget.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

describe('ExamsWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("renderiza con data-testid='exams-widget'", () => {
    const wrapper = mount(ExamsWidget)
    expect(wrapper.find("[data-testid='exams-widget']").exists()).toBe(true)
  })

  it('usa Container glass con container-type inline-size', () => {
    const wrapper = mount(ExamsWidget)
    const widget = wrapper.find("[data-testid='exams-widget']")
    expect(widget.classes()).toContain('glass-soft')
    expect(widget.attributes('style')).toContain('container-type: inline-size')
  })

  it('renderiza ExamsListView sin eyebrow', () => {
    const wrapper = mount(ExamsWidget)
    expect(wrapper.findComponent({ name: 'ExamsListView' }).exists()).toBe(true)
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.text-card-title').text()).toBe('Exámenes')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(ExamsWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
