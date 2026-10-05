import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Checkbox from '@/components/ui/Checkbox.vue'
import UpdateModal from './UpdateModal.vue'

let wrapper: VueWrapper | undefined

function dialogText(): string {
  return document.body.querySelector("[role='dialog']")?.textContent ?? ''
}

function findButton(label: string): HTMLElement {
  const found = Array.from(document.body.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label)
  )
  if (!found) throw new Error(`No se encontró el botón "${label}"`)
  return found
}

describe('UpdateModal', () => {
  afterEach(() => {
    if (wrapper) wrapper.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  const factory = (props: Record<string, unknown> = {}) => {
    wrapper = mount(UpdateModal, {
      props: { open: true, status: 'available', progress: null, ...props },
      attachTo: document.body,
    })
    return wrapper
  }

  it('no renderiza nada cuando está cerrado', () => {
    factory({ open: false })
    expect(document.body.querySelector("[role='dialog']")).toBeNull()
  })

  it('avisa que hay una versión nueva con las dos acciones', () => {
    factory()
    expect(dialogText()).toContain('Nueva versión disponible')
    expect(findButton('Actualizar')).not.toBeNull()
    expect(findButton('Después')).not.toBeNull()
    expect(dialogText()).toContain('No volver a avisar de esta versión')
  })

  it('emite update al confirmar', async () => {
    const mounted = factory()
    await findButton('Actualizar').click()
    expect(mounted.emitted('update')).toHaveLength(1)
  })

  it('emite dismiss al elegir después', async () => {
    const mounted = factory()
    await findButton('Después').click()
    expect(mounted.emitted('dismiss')).toHaveLength(1)
    expect(mounted.emitted('dismiss-forever')).toBeUndefined()
  })

  it('emite dismiss-forever cuando el usuario marcó no volver a avisar', async () => {
    const mounted = factory()
    mounted.findComponent(Checkbox).vm.$emit('update:modelValue', true)
    await mounted.vm.$nextTick()
    await findButton('Después').click()
    expect(mounted.emitted('dismiss-forever')).toHaveLength(1)
    expect(mounted.emitted('dismiss')).toBeUndefined()
  })

  it('muestra el progreso mientras descarga', () => {
    factory({ status: 'downloading', progress: 0.42 })
    expect(dialogText()).toContain('42')
    expect(document.body.querySelector("[data-testid='update-confirm']")).toBeNull()
  })

  it('avisa y deja cerrar cuando la actualización falla', async () => {
    const mounted = factory({ status: 'error' })
    expect(dialogText()).toContain('No se pudo actualizar')
    await findButton('Cerrar').click()
    expect(mounted.emitted('dismiss')).toHaveLength(1)
  })
})
