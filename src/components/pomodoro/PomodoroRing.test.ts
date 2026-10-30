import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroRing from './PomodoroRing.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

function mountRing(
  props: {
    phase?: 'focus' | 'shortBreak' | 'longBreak'
    progress?: number
    ringWidth?: number
  } = {}
) {
  return mount(PomodoroRing, {
    props: { phase: 'focus', progress: 0, ...props },
    slots: { default: '<span class="centro">25:00</span>' },
  })
}

describe('PomodoroRing', () => {
  it('es progressbar con el avance de la fase redondeado en aria-valuenow', () => {
    const wrapper = mountRing({ progress: 0.5 })
    const ring = wrapper.get('.pomodoro-ring-root')

    expect(ring.attributes('role')).toBe('progressbar')
    expect(ring.attributes('aria-valuemin')).toBe('0')
    expect(ring.attributes('aria-valuemax')).toBe('100')
    expect(ring.attributes('aria-valuenow')).toBe('50')
  })

  it('el avance es stroke-dashoffset continuo sobre un anillo de pathLength 100', async () => {
    const wrapper = mountRing({ progress: 0 })
    const progreso = wrapper.get('.pomodoro-ring-progress')
    const track = wrapper.get('.pomodoro-ring-track')

    expect(progreso.element.getAttribute('pathLength')).toBe('100')
    expect(track.element.getAttribute('pathLength')).toBe('100')
    expect(progreso.attributes('style')).toContain('stroke-dashoffset: 100')

    // Un paso minúsculo de tiempo ya mueve el anillo: no hay pasos de 1%.
    await wrapper.setProps({ progress: 0.001 })
    expect(progreso.attributes('style')).toContain('stroke-dashoffset: 99.9')

    await wrapper.setProps({ progress: 1 })
    expect(progreso.attributes('style')).toContain('stroke-dashoffset: 0')
  })

  it('el track va en surface-3 y el progreso toma el token de la fase', () => {
    const enfoque = mountRing({ phase: 'focus', progress: 0.25 })
    expect(enfoque.get('.pomodoro-ring-track').attributes('style') ?? '').toContain(
      'rgb(var(--color-surface-3)'
    )
    expect(enfoque.get('.pomodoro-ring-root').attributes('style') ?? '').toContain(
      'rgb(var(--color-primary)'
    )

    const descanso = mountRing({ phase: 'shortBreak', progress: 0.25 })
    expect(descanso.get('.pomodoro-ring-root').attributes('style') ?? '').toContain(
      'rgb(var(--color-success)'
    )

    const descansoLargo = mountRing({ phase: 'longBreak', progress: 0.25 })
    expect(descansoLargo.get('.pomodoro-ring-root').attributes('style') ?? '').toContain(
      'rgb(var(--color-success)'
    )
  })

  it('el grosor del anillo se adapta al radio para no recortarse en el viewBox', () => {
    const fino = mountRing()
    expect(fino.get('.pomodoro-ring-track').attributes('r')).toBe('48.75')
    expect(fino.get('.pomodoro-ring-root').attributes('style')).toContain(
      '--pomodoro-ring-width: 2.5'
    )

    const grueso = mountRing({ ringWidth: 4 })
    expect(grueso.get('.pomodoro-ring-track').attributes('r')).toBe('48')
    expect(grueso.get('.pomodoro-ring-progress').attributes('r')).toBe('48')
    expect(grueso.get('.pomodoro-ring-root').attributes('style')).toContain(
      '--pomodoro-ring-width: 4'
    )
  })

  it('recibe el centro por slot y no usa colores de paleta crudos', () => {
    const wrapper = mountRing()
    expect(wrapper.get('.centro').text()).toBe('25:00')
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
