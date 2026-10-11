import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renderiza slot y emite click', async () => {
    const wrapper = mount(Button, { slots: { default: 'Agregar' } })
    expect(wrapper.text()).toContain('Agregar')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    wrapper.unmount()
  })

  it('variante primary usa fondo sólido', () => {
    const wrapper = mount(Button, { slots: { default: 'Guardar' } })
    expect(wrapper.classes().join(' ')).toMatch(/bg-primary/)
    wrapper.unmount()
  })

  it('variante outline: borde y texto primary sobre fondo transparente', () => {
    const wrapper = mount(Button, { props: { variant: 'outline' }, slots: { default: 'Agregar' } })
    const cls = wrapper.classes().join(' ')
    expect(cls).toMatch(/border-primary/)
    expect(cls).toMatch(/text-primary/)
    expect(cls).toMatch(/bg-transparent/)
    expect(cls).not.toMatch(/bg-primary\s/)
    wrapper.unmount()
  })
})
