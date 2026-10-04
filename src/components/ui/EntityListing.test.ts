import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import EntityListing from './EntityListing.vue'
import NewEntityCard from './NewEntityCard.vue'

function mountListing(props: Record<string, unknown> = {}) {
  return mount(EntityListing, {
    props: { title: 'Tareas', eyebrow: 'Pendientes', ...props },
    slots: { default: '<div>contenido</div>' },
  })
}

describe('EntityListing', () => {
  it('muestra el eyebrow por default', () => {
    const wrapper = mountListing()
    expect(wrapper.find('.text-eyebrow').text()).toBe('Pendientes')
  })

  it('muestra el eyebrow con showEyebrow explícito en true', () => {
    const wrapper = mountListing({ showEyebrow: true })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(true)
  })

  it('oculta el eyebrow con showEyebrow=false', () => {
    const wrapper = mountListing({ showEyebrow: false })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
  })

  it('mantiene el título visible cuando el eyebrow está oculto', () => {
    const wrapper = mountListing({ showEyebrow: false })
    expect(wrapper.find('.text-card-title').text()).toBe('Tareas')
  })

  it('no renderiza eyebrow si no se pasa, aunque showEyebrow sea true', () => {
    const wrapper = mount(EntityListing, {
      props: { title: 'Tareas' },
      slots: { default: 'contenido' },
    })
    expect(wrapper.find('.text-eyebrow').exists()).toBe(false)
  })

  it('dibuja una sola línea separadora (footer sólida) sobre la zona de creación', () => {
    const wrapper = mount(EntityListing, {
      props: { title: 'Tareas' },
      slots: {
        default: '<div>contenido</div>',
        footer: () => h(NewEntityCard, { label: 'Nueva tarea' }),
      },
    })
    expect(wrapper.findAll('.border-dashed')).toHaveLength(0)
    expect(wrapper.findAll('.border-t')).toHaveLength(1)
    expect(wrapper.find('.border-t').classes()).toContain('border-hairline')
  })
})
