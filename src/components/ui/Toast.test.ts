import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Toast from './Toast.vue'

let wrapper: VueWrapper | undefined

function factory(props: Record<string, unknown> = {}) {
  wrapper = mount(Toast, {
    props: { open: true, message: 'Cambios guardados', ...props },
    attachTo: document.body,
  })
  return wrapper
}

function toastEl() {
  return document.body.querySelector('[data-testid="toast"]')
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Toast', () => {
  it('no renderiza nada cuando está cerrado', () => {
    factory({ open: false })
    expect(toastEl()).toBeNull()
  })

  it('muestra el mensaje cuando está abierto', () => {
    factory()
    expect(toastEl()?.textContent).toContain('Cambios guardados')
  })

  it('se descarta solo al cumplirse la duración', async () => {
    vi.useFakeTimers()
    const mounted = factory({ duration: 1500 })

    vi.advanceTimersByTime(1499)
    expect(mounted.emitted('update:open')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(mounted.emitted('update:open')).toEqual([[false]])
  })

  it('no se descarta si se cierra antes de cumplir la duración', async () => {
    vi.useFakeTimers()
    const mounted = factory({ duration: 1500 })

    vi.advanceTimersByTime(1000)
    await mounted.setProps({ open: false })
    vi.advanceTimersByTime(1000)

    expect(mounted.emitted('update:open')).toBeUndefined()
  })

  it('reinicia el descarte al reabrir', async () => {
    vi.useFakeTimers()
    const mounted = factory({ duration: 1500 })

    vi.advanceTimersByTime(1000)
    await mounted.setProps({ open: false })
    await mounted.setProps({ open: true })

    vi.advanceTimersByTime(1499)
    expect(mounted.emitted('update:open')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(mounted.emitted('update:open')).toEqual([[false]])
  })
})
