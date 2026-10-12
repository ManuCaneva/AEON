import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import YearCalendarSettingsModal from './YearCalendarSettingsModal.vue'

describe('YearCalendarSettingsModal', () => {
  let wrapper: VueWrapper<unknown> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  function openModal(value: 'auto' | 'meses' | 'tira' = 'auto') {
    wrapper = mount(YearCalendarSettingsModal, {
      props: { open: true, value },
      attachTo: document.body,
    })
    return wrapper
  }

  function options() {
    return Array.from(document.body.querySelectorAll("[data-testid='strip-mode-option']"))
  }

  it('muestra las tres opciones con sus descripciones', () => {
    openModal('auto')
    expect(options()).toHaveLength(3)
    expect(document.body.textContent).toContain('Vista del calendario anual')
    expect(document.body.textContent).toContain('Automática')
    expect(document.body.textContent).not.toContain('(recomendada)')
    expect(document.body.textContent).toContain('Por meses')
    expect(document.body.textContent).toContain('Año continuo')
    expect(document.body.textContent).toContain('Elige la mejor vista según el tamaño del panel')
    expect(document.body.textContent).toContain('12 meses separados')
    expect(document.body.textContent).toContain('Todo el año en una sola vista')
  })

  it('marca la opción actual como seleccionada', () => {
    openModal('tira')
    const selected = document.body.querySelector(
      "[data-testid='strip-mode-option'][data-value='tira']"
    )!
    expect(selected.getAttribute('aria-checked')).toBe('true')
  })

  it('emite save con el modo elegido al guardar', async () => {
    const w = openModal('auto')
    const meses = document.body.querySelector(
      "[data-testid='strip-mode-option'][data-value='meses']"
    ) as HTMLElement
    meses.click()
    await w.vm.$nextTick()
    const save = document.body.querySelector("[data-testid='strip-mode-save']") as HTMLElement
    save.click()
    expect(w.emitted('save')).toBeTruthy()
    expect(w.emitted('save')![0]).toEqual(['meses'])
  })

  it('emite close al cancelar', async () => {
    const w = openModal('auto')
    const cancel = document.body.querySelector("[data-testid='strip-mode-cancel']") as HTMLElement
    cancel.click()
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
  })
})
