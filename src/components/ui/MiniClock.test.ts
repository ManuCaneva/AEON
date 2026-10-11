import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MiniClock from './MiniClock.vue'

describe('MiniClock', () => {
  it('renderiza esfera solo visual con transición smooth en agujas', () => {
    const wrapper = mount(MiniClock, { props: { hour: 6, minute: 0 } })
    const root = wrapper.find('[data-miniclock]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-hidden')).toBe('true')
    const hourHand = wrapper.find('[data-hour-hand]')
    const minHand = wrapper.find('[data-minute-hand]')
    expect(hourHand.classes().join(' ')).toMatch(/transition/)
    expect(minHand.classes().join(' ')).toMatch(/transition/)
    // 06:00 -> minutero arriba (0deg), horario a 180deg
    expect(minHand.attributes('style') ?? '').toContain('rotate(0deg)')
    expect(hourHand.attributes('style') ?? '').toContain('rotate(180deg)')
    wrapper.unmount()
  })

  it('12:25 posiciona agujas con fracción de hora', () => {
    const wrapper = mount(MiniClock, { props: { hour: 12, minute: 25 } })
    const minHand = wrapper.find('[data-minute-hand]')
    expect(minHand.attributes('style') ?? '').toContain('rotate(150deg)')
    wrapper.unmount()
  })
})
