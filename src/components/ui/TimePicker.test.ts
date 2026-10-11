import { describe, it, expect, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import TimePicker from './TimePicker.vue'

const mounted: ReturnType<typeof mount>[] = []

function mountPicker(value = '06:00') {
  const wrapper = mount(TimePicker, {
    props: { modelValue: value, label: 'Inicio' },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

function bodyFind(selector: string): DOMWrapper<Element> {
  const el = document.body.querySelector(selector)
  if (!el) throw new Error(`No se encontró "${selector}" en body`)
  return new DOMWrapper(el)
}

const hourOf = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.find('[data-hour-input]').element as HTMLInputElement
const minuteOf = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.find('[data-minute-input]').element as HTMLInputElement

describe('TimePicker', () => {
  it('renderiza dos segmentos HH MM y botón de reloj con tab hora->minuto->botón', () => {
    const wrapper = mountPicker('06:05')
    expect(hourOf(wrapper).value).toBe('06')
    expect(minuteOf(wrapper).value).toBe('05')
    const btn = wrapper.find('[data-clock-button]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toContain('inicio')
    const tabbables = wrapper
      .findAll('input,button')
      .filter((w) => (w.element as HTMLElement).tabIndex >= 0)
    expect(tabbables).toHaveLength(3)
    expect(tabbables[0].element).toBe(hourOf(wrapper))
    expect(tabbables[1].element).toBe(minuteOf(wrapper))
  })

  it('tipeo filtra letras y blur normaliza con clamp 23:59', async () => {
    const wrapper = mountPicker('06:00')
    const hour = wrapper.find('[data-hour-input]')
    const minute = wrapper.find('[data-minute-input]')
    await hour.setValue('2a5')
    await minute.setValue('9b9')
    await minute.trigger('blur')
    expect(hourOf(wrapper).value).toBe('23')
    expect(minuteOf(wrapper).value).toBe('59')
    const emitted = wrapper.emitted('update:modelValue') as string[][]
    expect(emitted[emitted.length - 1]).toEqual(['23:59'])
  })

  it('completar 2 dígitos en hora auto-avanza a minuto', async () => {
    const wrapper = mountPicker('06:00')
    const hour = wrapper.find('[data-hour-input]')
    await hour.setValue('07')
    expect(document.activeElement).toBe(minuteOf(wrapper))
  })

  it('Backspace en minuto vacío vuelve a hora', async () => {
    const wrapper = mountPicker('06:00')
    const minute = wrapper.find('[data-minute-input]')
    await minute.setValue('')
    await minute.trigger('keydown', { key: 'Backspace' })
    expect(document.activeElement).toBe(hourOf(wrapper))
  })

  it('Enter confirma lo tipeado', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-hour-input]').setValue('09')
    await wrapper.find('[data-minute-input]').setValue('30')
    await wrapper.find('[data-minute-input]').trigger('keydown', { key: 'Enter' })
    const emitted = wrapper.emitted('update:modelValue') as string[][]
    expect(emitted[emitted.length - 1]).toEqual(['09:30'])
  })

  it('flechas Up/Down ajustan con wrap circular', async () => {
    const wrapper = mountPicker('23:59')
    await wrapper.find('[data-minute-input]').trigger('keydown', { key: 'ArrowUp' })
    let emitted = wrapper.emitted('update:modelValue') as string[][]
    expect(emitted[emitted.length - 1]).toEqual(['23:00'])

    await wrapper.setProps({ modelValue: '10:30' })
    await wrapper.find('[data-hour-input]').trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    emitted = wrapper.emitted('update:modelValue') as string[][]
    expect(emitted[emitted.length - 1]).toEqual(['11:30'])
  })

  it('botón de reloj abre popup chico con drums y mini reloj, sin esfera', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    const popup = document.body.querySelector('[data-clock-popup]')
    expect(popup).not.toBeNull()
    expect(document.body.querySelector('[data-drums]')).not.toBeNull()
    expect(document.body.querySelector('[data-miniclock]')).not.toBeNull()
    expect(document.body.querySelector('[data-dial]')).toBeNull()
  })

  it('elegir en drums y Aceptar emite y cierra', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    await bodyFind('[data-hour="15"]').trigger('click')
    await bodyFind('[data-minute="45"]').trigger('click')
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const ok = buttons.find((b) => b.textContent?.trim() === 'Aceptar')
    expect(ok).toBeDefined()
    ok!.click()
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('update:modelValue') as string[][]
    expect(emitted[emitted.length - 1]).toEqual(['15:45'])
    expect(document.body.querySelector('[data-clock-popup]')).toBeNull()
  })

  it('Cancelar cierra sin emitir', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    await bodyFind('[data-hour="15"]').trigger('click')
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const cancel = buttons.find((b) => b.textContent?.trim() === 'Cancelar')
    cancel!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.body.querySelector('[data-clock-popup]')).toBeNull()
  })

  it('Escape cierra sin emitir', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    await bodyFind('[data-clock-popup]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.body.querySelector('[data-clock-popup]')).toBeNull()
  })

  it('click fuera del popup lo cierra sin emitir', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    expect(document.body.querySelector('[data-clock-popup]')).not.toBeNull()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.body.querySelector('[data-clock-popup]')).toBeNull()
  })

  it('scroll dentro de los drums no cierra el popup, scroll fuera sí', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.find('[data-clock-button]').trigger('click')
    expect(document.body.querySelector('[data-clock-popup]')).not.toBeNull()
    const hourCol = document.body.querySelector('[data-hour-column]')
    expect(hourCol).not.toBeNull()
    hourCol!.dispatchEvent(new Event('scroll', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[data-clock-popup]')).not.toBeNull()
    document.body.dispatchEvent(new Event('scroll', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[data-clock-popup]')).toBeNull()
  })

  it('refleja cambios externos de modelValue', async () => {
    const wrapper = mountPicker('06:00')
    await wrapper.setProps({ modelValue: '15:30' })
    expect(hourOf(wrapper).value).toBe('15')
    expect(minuteOf(wrapper).value).toBe('30')
  })
})
