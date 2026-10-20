import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import Modal from './Modal.vue'

let wrapper: VueWrapper | undefined

function factory(props: Record<string, unknown> = {}) {
  wrapper = mount(Modal, {
    props: { open: true, ...props },
    slots: { default: '<p data-testid="modal-content">contenido</p>' },
    attachTo: document.body,
  })
  return wrapper
}

function dialogEl() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

function overlayEl() {
  return dialogEl()?.parentElement ?? null
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Modal', () => {
  it('cerrado: no renderiza nada', () => {
    factory({ open: false })
    expect(dialogEl()).toBeNull()
  })

  it('abierto: renderiza el diálogo con el slot', () => {
    factory()
    const dialog = dialogEl()
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.textContent).toContain('contenido')
  })

  it('Escape con el modal abierto emite close', async () => {
    const mounted = factory()
    pressEscape()
    await nextTick()
    expect(mounted.emitted('close')).toHaveLength(1)
  })

  it('Escape con el modal cerrado no emite close', async () => {
    const mounted = factory({ open: false })
    pressEscape()
    await nextTick()
    expect(mounted.emitted('close')).toBeUndefined()
  })

  it('click en el backdrop emite close', async () => {
    const mounted = factory()
    overlayEl()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(mounted.emitted('close')).toHaveLength(1)
  })

  it('click dentro del panel no emite close', async () => {
    const mounted = factory()
    dialogEl()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(mounted.emitted('close')).toBeUndefined()
  })

  it('los tres tamaños mapean al max-width del design system', () => {
    const cases: Array<[size: 'sm' | 'md' | 'lg', expected: string]> = [
      ['sm', 'max-w-sm'],
      ['md', 'max-w-md'],
      ['lg', 'max-w-2xl'],
    ]

    for (const [size, expected] of cases) {
      const mounted = factory({ size })
      expect(dialogEl()?.className).toContain(expected)
      mounted.unmount()
    }
  })

  it('cerrar es atómico: el overlay sale del DOM en el siguiente tick', async () => {
    // Regresión del parpadeo en WebKitGTK: el overlay no debe quedar
    // montado esperando una transición de salida (opacity → 0) porque el
    // compositor re-captura el backdrop-filter en cada frame intermedio.
    const mounted = factory()
    expect(overlayEl()).not.toBeNull()

    await mounted.setProps({ open: false })
    await nextTick()
    expect(overlayEl()).toBeNull()
  })

  it('el overlay se monta y desmonta sin <Transition>', () => {
    // happy-dom no reproduce el artefacto de GPU, así que la única forma de
    // fijar la regresión es estructural: animar la opacidad de un ancestro
    // de `backdrop-filter` obliga a WebKitGTK a re-componer la textura en
    // cada frame y mostrar un buffer desfasado. El montaje atómico sin
    // transición es el arreglo; este guard lo protege.
    const mounted = factory()
    expect(mounted.findComponent({ name: 'Transition' }).exists()).toBe(false)
  })

  it('el panel nunca excede el viewport: altura máxima con flex en columna', () => {
    factory()
    const panel = dialogEl()!
    expect(panel.className).toContain('flex-col')
    // max-h respecto al viewport menos el padding del backdrop: un popup más
    // alto que la pantalla queda prohibido acá, en el primitivo.
    expect(panel.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/)
  })

  describe('con header / cuerpo / footer', () => {
    function mountChrome() {
      const mounted = mount(Modal, {
        props: { open: true },
        slots: {
          header: '<h2 data-testid="m-header">Título</h2>',
          default: '<p data-testid="m-body">Contenido</p>',
          footer: '<button data-testid="m-footer">OK</button>',
        },
        attachTo: document.body,
      })
      const panel = document.body.querySelector('[role=dialog]') as HTMLElement
      return { mounted, panel }
    }

    it('header y footer quedan fijos (shrink-0) y el cuerpo es el que scrollea', () => {
      const { mounted, panel } = mountChrome()
      const header = panel.querySelector('[data-testid=m-header]')!.parentElement!
      const body = panel.querySelector('[data-testid=m-body]')!.parentElement!
      const footer = panel.querySelector('[data-testid=m-footer]')!.parentElement!

      expect(header.className).toContain('shrink-0')
      expect(footer.className).toContain('shrink-0')
      expect(body.className).toContain('overflow-y-auto')
      expect(body.className).toContain('flex-1')
      expect(body.className).toContain('min-h-0')
      mounted.unmount()
    })

    it('ordena header, cuerpo y footer', () => {
      const { mounted, panel } = mountChrome()
      const kids = Array.from(panel.children)
      const find = (tid: string) =>
        kids.findIndex((k) => k.querySelector(`[data-testid=${tid}]`) !== null)
      expect(find('m-header')).toBeLessThan(find('m-body'))
      expect(find('m-body')).toBeLessThan(find('m-footer'))
      mounted.unmount()
    })

    it('omite las secciones sin slot asignado', () => {
      const mounted = mount(Modal, {
        props: { open: true },
        slots: { default: '<p data-testid="m-body">Contenido</p>' },
        attachTo: document.body,
      })
      const panel = document.body.querySelector('[role=dialog]') as HTMLElement
      expect(panel.querySelectorAll('[data-testid=m-header]')).toHaveLength(0)
      expect(panel.querySelectorAll('[data-testid=m-footer]')).toHaveLength(0)
      expect(panel.querySelectorAll('[data-testid=m-body]')).toHaveLength(1)
      mounted.unmount()
    })
  })
})
