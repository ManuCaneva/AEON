import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroPill from './PomodoroPill.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { POMODORO_PILL_HEIGHT } from '@/lib/pomodoroMiniLayout'

describe('PomodoroPill', () => {
  it('muestra los tres controles: resize, ir a Pomodoro y cerrar', () => {
    const wrapper = mount(PomodoroPill)

    const resize = wrapper.get('[data-testid="pomodoro-pill-resize"]')
    const go = wrapper.get('[data-testid="pomodoro-pill-go"]')
    const close = wrapper.get('[data-testid="pomodoro-pill-close"]')

    expect(resize.attributes('aria-label')).toBe('Redimensionar Pomodoro')
    expect(go.attributes('aria-label')).toBe('Ir a la página Pomodoro')
    expect(close.attributes('aria-label')).toBe('Cerrar Pomodoro')
  })

  it('los botones de ir y cerrar emiten su acción', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-go"]').trigger('click')
    expect(wrapper.emitted('go')).toHaveLength(1)

    await wrapper.get('[data-testid="pomodoro-pill-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    expect(wrapper.emitted('resize-start')).toBeUndefined()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('mantener apretado el handle y mover el mouse emite deltas acumulados desde el inicio', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 50,
    })
    expect(wrapper.emitted('resize-start')).toHaveLength(1)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 40, buttons: 1 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 145, clientY: 25, buttons: 1 }))

    expect(wrapper.emitted('resize')).toEqual([[{ x: 30, y: -10 }], [{ x: 45, y: -25 }]])

    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 145, clientY: 25 }))
    expect(wrapper.emitted('resize-end')).toHaveLength(1)

    // Suelto el botón: el mouse deja de mover el tamaño.
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 0 }))
    expect(wrapper.emitted('resize')).toHaveLength(2)
  })

  it('sin el botón apretado, mover el mouse no emite nada', () => {
    const wrapper = mount(PomodoroPill)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))

    expect(wrapper.emitted('resize')).toBeUndefined()
    expect(wrapper.emitted('resize-start')).toBeUndefined()
  })

  it('solo el botón izquierdo inicia el gesto de resize', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 2,
      clientX: 100,
      clientY: 50,
    })

    expect(wrapper.emitted('resize-start')).toBeUndefined()
  })

  it('los botones de acción no inician el resize ni el handle emite acciones', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-go"]').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 50,
    })
    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('click')

    expect(wrapper.emitted('resize-start')).toBeUndefined()
    expect(wrapper.emitted('go')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('si el mouseup se pierde, el mouse vuelve sin botón y el gesto se cierra solo', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 50,
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 40, buttons: 1 }))
    expect(wrapper.emitted('resize')).toHaveLength(1)

    // El puntero salió de la ventana con el botón apretado y el mouseup nunca
    // llegó: el siguiente move sin botón cierra el gesto en vez de estirarlo.
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30 }))
    expect(wrapper.emitted('resize-end')).toHaveLength(1)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 170, clientY: 20, buttons: 1 }))
    expect(wrapper.emitted('resize')).toHaveLength(1)
  })

  it('si la ventana pierde el foco en pleno gesto, el gesto termina', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 50,
    })
    window.dispatchEvent(new Event('blur'))

    expect(wrapper.emitted('resize-end')).toHaveLength(1)
  })

  it('al desmontar en pleno gesto, el documento deja de mover el tamaño', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-resize"]').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 50,
    })
    wrapper.unmount()

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 40 }))
    document.dispatchEvent(new MouseEvent('mouseup', {}))

    expect(wrapper.emitted('resize')).toBeUndefined()
  })

  it('la pastilla tiene alto fijo de la geometría compartida y forma de píldora', () => {
    const wrapper = mount(PomodoroPill)
    const pill = wrapper.get('[data-testid="pomodoro-pill"]')

    expect(pill.attributes('style')).toContain(`height: ${POMODORO_PILL_HEIGHT}px`)
    expect(pill.classes()).toContain('rounded-full')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroPill)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
