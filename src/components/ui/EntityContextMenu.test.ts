import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EntityContextMenu from './EntityContextMenu.vue'

describe('EntityContextMenu', () => {
  const triggerAttr = 'data-entity-menu-trigger'
  const entityId = 'entity-1'

  function createTrigger() {
    const trigger = document.createElement('div')
    trigger.setAttribute(triggerAttr, entityId)
    document.body.appendChild(trigger)
    return trigger
  }

  function mountMenu(props: Record<string, any> = {}) {
    return mount(EntityContextMenu, {
      props: {
        entityId,
        triggerDataAttr: triggerAttr,
        confirmTitle: '¿Eliminar elemento?',
        ...props,
      },
      attachTo: document.body,
    })
  }

  function q(testid: string): HTMLElement | null {
    return document.body.querySelector(`[data-testid="${testid}"]`)
  }

  let wrapper: any
  let trigger: HTMLElement

  beforeEach(() => {
    setActivePinia(createPinia())
    trigger = createTrigger()
  })

  afterEach(() => {
    wrapper?.unmount()
    trigger?.remove()
  })

  it("renders menu with role='menu'", () => {
    wrapper = mountMenu()
    const menu = document.body.querySelector("[role='menu']")
    expect(menu).not.toBeNull()
  })

  it('has Editar option', () => {
    wrapper = mountMenu()
    const menu = document.body.querySelector("[role='menu']")
    expect(menu?.textContent).toContain('Editar')
  })

  it('ofrece Eliminar y ya no ofrece Archivar ni Restaurar', () => {
    wrapper = mountMenu()
    const menu = document.body.querySelector("[role='menu']")
    expect(menu?.textContent).toContain('Eliminar')
    expect(menu?.textContent).not.toContain('Archivar')
    expect(menu?.textContent).not.toContain('Restaurar')
  })

  it("emits 'edit' when Editar clicked", async () => {
    wrapper = mountMenu()
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const editBtn = buttons.find((btn) => btn.textContent?.includes('Editar'))
    editBtn?.click()
    await flushPromises()
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })

  it('Eliminar pide confirmación antes de borrar', async () => {
    wrapper = mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()

    expect(q('entity-delete-confirm')).not.toBeNull()
    expect(q('entity-delete-confirm')?.textContent).toContain('¿Eliminar elemento?')
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('confirmar emite delete', async () => {
    wrapper = mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    q('entity-delete-confirm-yes')!.click()
    await flushPromises()

    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('cancelar vuelve al menú sin borrar', async () => {
    wrapper = mountMenu()
    q('entity-delete-button')!.click()
    await flushPromises()
    q('entity-delete-confirm-no')!.click()
    await flushPromises()

    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(q('entity-delete-confirm')).toBeNull()
    expect(q('entity-delete-button')).not.toBeNull()
  })

  it("emits 'close' on click outside", async () => {
    wrapper = mountMenu()
    await document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
