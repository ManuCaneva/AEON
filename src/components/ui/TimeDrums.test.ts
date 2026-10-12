import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import TimeDrums from './TimeDrums.vue'

function mountDrums(hour = 6, minute = 0) {
  return mount(TimeDrums, {
    props: { hour, minute },
    attachTo: document.body,
  })
}

// happy-dom no tiene layout: simulamos métricas para ejercitar la lógica de scroll.
function mockMetrics(el: HTMLElement, scrollHeight: number, clientHeight = 160) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
}

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('TimeDrums', () => {
  it('renderiza columna de horas 00-23 y de minutos 00-59', () => {
    const wrapper = mountDrums(6, 0)
    const hours = wrapper.findAll('[data-hour]')
    const minutes = wrapper.findAll('[data-minute]')
    const hourTexts = new Set(hours.map((n) => n.text()))
    const minuteTexts = new Set(minutes.map((n) => n.text()))
    for (let h = 0; h < 24; h++) {
      expect(hourTexts.has(String(h).padStart(2, '0'))).toBe(true)
    }
    for (let m = 0; m < 60; m++) {
      expect(minuteTexts.has(String(m).padStart(2, '0'))).toBe(true)
    }
    wrapper.unmount()
  })

  it('marca el seleccionado en cada columna', () => {
    const wrapper = mountDrums(6, 25)
    expect(wrapper.find('[data-hour="06"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-minute="25"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('click en hora/minuto emite el valor', async () => {
    const wrapper = mountDrums(6, 0)
    await wrapper.find('[data-hour="15"]').trigger('click')
    expect(wrapper.emitted('select-hour')).toEqual([[15]])
    await wrapper.find('[data-minute="45"]').trigger('click')
    expect(wrapper.emitted('select-minute')).toEqual([[45]])
    wrapper.unmount()
  })

  it('usa scroll suave con snap para transición obligatoriamente smooth', () => {
    const wrapper = mountDrums(6, 0)
    const hourCol = wrapper.find('[data-hour-column]')
    const minCol = wrapper.find('[data-minute-column]')
    expect(hourCol.classes().join(' ')).toMatch(/scroll-smooth/)
    expect(minCol.classes().join(' ')).toMatch(/scroll-smooth/)
    // snap en items
    expect(wrapper.find('[data-hour="00"]').classes().join(' ')).toMatch(/snap/)
    // highlight con transición
    const cls = wrapper.find('[data-hour="06"]').classes().join(' ')
    expect(cls).toMatch(/transition/)
    wrapper.unmount()
  })

  it('al montar queda fijo en el horario sin animar; al mover sí anima suave', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollTo')
    const wrapper = mountDrums(15, 45)
    await nextTick()
    await nextTick()
    // Sin animación inicial: ningún scroll programado al montar...
    expect(spy).not.toHaveBeenCalled()
    // ...pero posicionado instantáneo en el valor (copia media + centrado)
    expect((wrapper.find('[data-hour-column]').element as HTMLElement).scrollTop).toBe(
      (24 + 15) * 32 - 80 + 16
    )
    expect((wrapper.find('[data-minute-column]').element as HTMLElement).scrollTop).toBe(
      (60 + 45) * 32 - 80 + 16
    )
    // Al mover (click) sí anima suave
    await wrapper.find('[data-hour="10"]').trigger('click')
    await nextTick()
    expect(spy).toHaveBeenCalled()
    const last = spy.mock.calls[spy.mock.calls.length - 1][0] as ScrollToOptions
    expect(last.behavior).toBe('smooth')
    spy.mockRestore()
    wrapper.unmount()
  })

  it('durante un vuelo programado ignora posiciones intermedias', async () => {
    const wrapper = mountDrums(6, 0)
    const hourCol = wrapper.find('[data-hour-column]').element as HTMLElement
    mockMetrics(hourCol, 24 * 32 * 3)
    await flush() // deja asentar el montaje
    await wrapper.setProps({ hour: 10 }) // vuelo programado 6 -> 10
    // La columna a mitad de camino (como a mitad de una animación smooth)
    hourCol.scrollTop = (24 + 8) * 32 - 64
    hourCol.dispatchEvent(new Event('scroll'))
    await flush()
    // No debe emitir la hora de paso: el destino ya está decidido
    expect(wrapper.emitted('select-hour')).toBeUndefined()
    // Fin del vuelo ya en destino: tampoco emite de más
    hourCol.scrollTop = (24 + 10) * 32 - 64
    hourCol.dispatchEvent(new Event('scrollend'))
    await flush()
    expect(wrapper.emitted('select-hour')).toBeUndefined()
    wrapper.unmount()
  })

  it('el scroll manual del usuario sigue emitiendo en vivo', async () => {
    const wrapper = mountDrums(6, 0)
    const hourCol = wrapper.find('[data-hour-column]').element as HTMLElement
    mockMetrics(hourCol, 24 * 32 * 3)
    await flush()
    hourCol.scrollTop = (24 + 8) * 32 - 64
    hourCol.dispatchEvent(new Event('scroll'))
    await flush()
    expect(wrapper.emitted('select-hour')).toEqual([[8]])
    wrapper.unmount()
  })

  it('helpers de wrap circulan sin límite: 23->0 y 59->0', async () => {
    const wrapper = mountDrums(23, 59)
    await wrapper.find('[data-hour-column]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('select-hour')).toEqual([[0]])
    await wrapper.find('[data-minute-column]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('select-minute')).toEqual([[0]])
    wrapper.unmount()
  })
})
