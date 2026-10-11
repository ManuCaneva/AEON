import { describe, it, expect } from 'vitest'
import { useDayTooltip, positionForRect, MAX_TOOLTIP_EVENTS } from './useDayTooltip'
import type { CalendarEvent } from '@/schemas/calendar'

function evt(id: string): CalendarEvent {
  return {
    id,
    date: '2026-06-04',
    title: `Evento ${id}`,
    color: '#ff0000',
    calendarId: 'primary',
    start: '2026-06-04T10:00:00Z',
    end: '2026-06-04T11:00:00Z',
  }
}

describe('useDayTooltip', () => {
  it('expone el límite de 5 eventos en el tooltip', () => {
    expect(MAX_TOOLTIP_EVENTS).toBe(5)
  })

  it('showTooltip arma label largo, eventos y posición bajo la celda', () => {
    const { hovered, showTooltip } = useDayTooltip(() => [evt('a'), evt('b')])
    const rect = {
      top: 300,
      bottom: 310,
      left: 500,
      right: 510,
      width: 10,
      height: 10,
    } as DOMRect
    showTooltip('2026-06-04', { getBoundingClientRect: () => rect } as HTMLElement)
    expect(hovered.value).not.toBeNull()
    expect(hovered.value!.label).toBe('Jueves, 4 de junio de 2026')
    expect(hovered.value!.events).toHaveLength(2)
    expect(hovered.value!.overflow).toBe(0)
    expect(hovered.value!.position.top).toBe(318)
  })

  it('corta en 5 eventos e informa el overflow', () => {
    const { hovered, showTooltip } = useDayTooltip(() =>
      Array.from({ length: 7 }, (_, i) => evt(`t${i}`))
    )
    showTooltip('2026-06-04', null)
    expect(hovered.value!.events).toHaveLength(5)
    expect(hovered.value!.overflow).toBe(2)
    expect(hovered.value!.position).toEqual({ top: 0, left: 0 })
  })

  it('hideTooltip limpia el estado', () => {
    const { hovered, showTooltip, hideTooltip } = useDayTooltip(() => [evt('a')])
    showTooltip('2026-06-04', null)
    expect(hovered.value).not.toBeNull()
    hideTooltip()
    expect(hovered.value).toBeNull()
  })

  it('positionForRect centra bajo la celda y clampa a los bordes', () => {
    const rect = {
      top: 300,
      bottom: 310,
      left: 100,
      right: 110,
      width: 10,
      height: 10,
    } as DOMRect
    // 100+5-110 = -5 -> clampa al margen 8
    expect(positionForRect(rect)).toEqual({ top: 318, left: 8 })
  })
})
