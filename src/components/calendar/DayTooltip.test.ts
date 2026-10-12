import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import DayTooltip from './DayTooltip.vue'

const demoEvents = [
  { id: 'e1', title: 'Standup', color: '#7986cb' },
  { id: 'e2', title: 'Review', color: '#33b679' },
]

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

function mountTooltip(props: Record<string, unknown>): HTMLElement {
  wrapper = mount(DayTooltip, {
    attachTo: document.body,
    props: {
      dateLabel: 'Jueves, 15 de enero de 2026',
      events: demoEvents,
      overflowCount: 0,
      position: { top: 100, left: 200 },
      ...props,
    },
  })
  const tooltip = document.body.querySelector("[data-testid='day-tooltip']") as HTMLElement
  expect(tooltip).not.toBeNull()
  return tooltip
}

describe('DayTooltip', () => {
  it('muestra la fecha exacta y la lista de títulos con su dot de color', () => {
    const tooltip = mountTooltip({})
    expect(tooltip.textContent).toContain('Jueves, 15 de enero de 2026')
    expect(tooltip.textContent).toContain('Standup')
    expect(tooltip.textContent).toContain('Review')
    const dots = tooltip.querySelectorAll("[data-testid='day-tooltip-dot']")
    expect(dots).toHaveLength(2)
    expect(dots[0].getAttribute('style')).toContain('#7986cb')
    expect(dots[1].getAttribute('style')).toContain('#33b679')
  })

  it('muestra estado vacío sin dots cuando no hay eventos', () => {
    const tooltip = mountTooltip({ events: [] })
    expect(tooltip.textContent).toContain('Sin eventos')
    expect(tooltip.querySelectorAll("[data-testid='day-tooltip-dot']")).toHaveLength(0)
  })

  it('muestra +N más cuando hay overflow', () => {
    const tooltip = mountTooltip({ overflowCount: 3 })
    expect(tooltip.textContent).toContain('+3 más')
  })

  it('expone role tooltip para accesibilidad', () => {
    const tooltip = mountTooltip({})
    expect(tooltip.getAttribute('role')).toBe('tooltip')
  })
})
