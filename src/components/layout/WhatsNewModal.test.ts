import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import WhatsNewModal from './WhatsNewModal.vue'

describe('WhatsNewModal', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    document.body.innerHTML = ''
    wrapper = undefined
  })

  const factory = (props: Record<string, unknown> = {}) => {
    wrapper = mount(WhatsNewModal, {
      props: {
        open: true,
        version: '0.5.0',
        notes: {
          summary: 'Esta versión trae novedades de calendario.',
          items: [
            { category: 'nuevo', text: 'Cronograma semanal' },
            { category: 'arreglado', text: 'Se arregló el arranque en Wayland' },
          ],
        },
        ...props,
      },
      attachTo: document.body,
    })
    return wrapper
  }

  const dialogText = () => document.body.querySelector("[role='dialog']")?.textContent ?? ''

  it('anuncia la versión instalada con sus novedades', () => {
    factory()

    expect(dialogText()).toContain('Novedades de la versión 0.5.0')
    expect(dialogText()).toContain('Cronograma semanal')
    expect(document.body.querySelector('[data-note-group="nuevo"]')).not.toBeNull()
  })

  it('emite close al confirmar', async () => {
    const mounted = factory()

    const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Listo')
    )
    await button?.click()

    expect(mounted.emitted('close')).toHaveLength(1)
  })

  it('no renderiza nada cuando está cerrado', () => {
    factory({ open: false })

    expect(dialogText()).toBe('')
  })
})
