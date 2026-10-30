import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroPill from './PomodoroPill.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { POMODORO_PILL_HEIGHT } from '@/lib/pomodoroMiniLayout'

describe('PomodoroPill', () => {
  it('muestra solo los dos controles de ventana: ir a Pomodoro y cerrar', () => {
    const wrapper = mount(PomodoroPill)

    const go = wrapper.get('[data-testid="pomodoro-pill-go"]')
    const close = wrapper.get('[data-testid="pomodoro-pill-close"]')

    expect(go.attributes('aria-label')).toBe('Ir a la página Pomodoro')
    expect(close.attributes('aria-label')).toBe('Cerrar Pomodoro')
    expect(wrapper.find('[data-testid="pomodoro-pill-resize"]').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  it('los botones emiten su acción y no emiten eventos de resize', async () => {
    const wrapper = mount(PomodoroPill)

    await wrapper.get('[data-testid="pomodoro-pill-go"]').trigger('click')
    expect(wrapper.emitted('go')).toHaveLength(1)

    await wrapper.get('[data-testid="pomodoro-pill-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    expect(wrapper.emitted('resize-start')).toBeUndefined()
    expect(wrapper.emitted('resize')).toBeUndefined()
    expect(wrapper.emitted('resize-end')).toBeUndefined()
  })

  it('los botones son de tipo button para no enviar formularios', () => {
    const wrapper = mount(PomodoroPill)

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('type')).toBe('button')
    }
  })

  it('tiene alto fijo de la geometría compartida y forma de píldora', () => {
    const wrapper = mount(PomodoroPill)
    const pill = wrapper.get('[data-testid="pomodoro-pill"]')

    expect(pill.attributes('style')).toContain(`height: ${POMODORO_PILL_HEIGHT}px`)
    expect(pill.classes()).toContain('rounded-full')
    expect(pill.classes()).toContain('justify-center')
    expect(pill.classes()).not.toContain('w-full')
    expect(pill.text()).not.toContain('Pomodoro')
  })

  it('tiene fondo sólido, borde y sombra para despegarse del escritorio', () => {
    const wrapper = mount(PomodoroPill)
    const pill = wrapper.get('[data-testid="pomodoro-pill"]')

    expect(pill.classes()).toEqual(
      expect.arrayContaining([
        'bg-surface-2',
        'border',
        'border-hairline-strong',
        'shadow-md',
        'shadow-overlay/50',
        'ring-1',
        'ring-inset',
      ])
    )
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroPill)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
