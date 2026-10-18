import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Modal from './Modal.vue'

describe('Modal', () => {
  it('no renderiza nada cuando está cerrado', () => {
    mount(Modal, {
      props: { open: false },
      slots: { default: '<p>contenido</p>' },
      attachTo: document.body,
    })
    expect(document.body.querySelector('[role=dialog]')).toBeNull()
  })

  it('el panel nunca excede el viewport: altura máxima con flex en columna', () => {
    const wrapper = mount(Modal, {
      props: { open: true },
      slots: { default: '<p>contenido</p>' },
      attachTo: document.body,
    })
    const panel = document.body.querySelector('[role=dialog]') as HTMLElement
    expect(panel.className).toContain('flex-col')
    // max-h respecto al viewport menos el padding del backdrop: un popup más
    // alto que la pantalla queda prohibido acá, en el primitivo.
    expect(panel.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/)
    wrapper.unmount()
  })

  describe('con header / cuerpo / footer', () => {
    function mountChrome() {
      const wrapper = mount(Modal, {
        props: { open: true },
        slots: {
          header: '<h2 data-testid="m-header">Título</h2>',
          default: '<p data-testid="m-body">Contenido</p>',
          footer: '<button data-testid="m-footer">OK</button>',
        },
        attachTo: document.body,
      })
      const panel = document.body.querySelector('[role=dialog]') as HTMLElement
      return { wrapper, panel }
    }

    it('header y footer quedan fijos (shrink-0) y el cuerpo es el que scrollea', () => {
      const { wrapper, panel } = mountChrome()
      const header = panel.querySelector('[data-testid=m-header]')!.parentElement!
      const body = panel.querySelector('[data-testid=m-body]')!.parentElement!
      const footer = panel.querySelector('[data-testid=m-footer]')!.parentElement!

      expect(header.className).toContain('shrink-0')
      expect(footer.className).toContain('shrink-0')
      expect(body.className).toContain('overflow-y-auto')
      expect(body.className).toContain('flex-1')
      expect(body.className).toContain('min-h-0')
      wrapper.unmount()
    })

    it('ordena header, cuerpo y footer', () => {
      const { wrapper, panel } = mountChrome()
      const kids = Array.from(panel.children)
      const find = (tid: string) =>
        kids.findIndex((k) => k.querySelector(`[data-testid=${tid}]`) !== null)
      expect(find('m-header')).toBeLessThan(find('m-body'))
      expect(find('m-body')).toBeLessThan(find('m-footer'))
      wrapper.unmount()
    })

    it('omite las secciones sin slot asignado', () => {
      const wrapper = mount(Modal, {
        props: { open: true },
        slots: { default: '<p data-testid="m-body">Contenido</p>' },
        attachTo: document.body,
      })
      const panel = document.body.querySelector('[role=dialog]') as HTMLElement
      expect(panel.querySelectorAll('[data-testid=m-header]')).toHaveLength(0)
      expect(panel.querySelectorAll('[data-testid=m-footer]')).toHaveLength(0)
      expect(panel.querySelectorAll('[data-testid=m-body]')).toHaveLength(1)
      wrapper.unmount()
    })
  })
})
