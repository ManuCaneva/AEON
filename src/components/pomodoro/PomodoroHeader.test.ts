import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroHeader from './PomodoroHeader.vue'

/** Monta el header con un botón de acción, como lo usa el widget. */
function mountHeader() {
  return mount(PomodoroHeader, {
    props: { testIdPrefix: 'pomodoro-test' },
    slots: { actions: '<button data-testid="acciones" type="button">pop-out</button>' },
  })
}

describe('PomodoroHeader', () => {
  it('un click en cualquier punto de la fila activa el header', async () => {
    const wrapper = mountHeader()

    await wrapper.get('[data-testid="pomodoro-test-header"]').trigger('click')
    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('el click en el título activa una sola vez, sin doble activación por bubbling', async () => {
    const wrapper = mountHeader()

    await wrapper.get('[data-testid="pomodoro-test-header-title"]').trigger('click')
    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('el título es el control accesible: botón nativo con la aria de destino', () => {
    const wrapper = mountHeader()
    const title = wrapper.get('[data-testid="pomodoro-test-header-title"]')

    expect(title.element.tagName.toLowerCase()).toBe('button')
    expect(title.attributes('type')).toBe('button')
    expect(title.attributes('aria-label')).toBe('Ir a la página Pomodoro')
  })

  it('la fila no es un control: nada de role ni tabindex que aniden interactivos', () => {
    const wrapper = mountHeader()
    const header = wrapper.get('[data-testid="pomodoro-test-header"]')
    const title = wrapper.get('[data-testid="pomodoro-test-header-title"]')

    expect(header.attributes('role')).toBeUndefined()
    expect(header.attributes('tabindex')).toBeUndefined()
    // El título no cuelga de otro control: sus botones hermanos quedan expuestos.
    expect(title.element.closest('button, [role="button"]')).toBe(title.element)
  })

  it('Enter y Espacio activan el título; el resto de las teclas no', async () => {
    const wrapper = mountHeader()
    const title = wrapper.get('[data-testid="pomodoro-test-header-title"]')

    await title.trigger('keydown', { key: 'Enter' })
    await title.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('activate')).toHaveLength(2)

    await title.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('activate')).toHaveLength(2)
  })

  it('el header y su título responden con cursor pointer', () => {
    const wrapper = mountHeader()
    const header = wrapper.get('[data-testid="pomodoro-test-header"]')
    const title = wrapper.get('[data-testid="pomodoro-test-header-title"]')

    expect(header.classes()).toContain('cursor-pointer')
    expect(header.classes()).toContain('group')
    expect(title.classes()).toContain('cursor-pointer')
    expect(title.classes()).toContain('text-left')
    expect(title.classes()).toContain('transition-colors')
  })
})
