import { nextTick, ref } from 'vue'
import { formatLongDateEs } from '@/lib/calendarDates'

export const MAX_TOOLTIP_EVENTS = 5
export const TOOLTIP_WIDTH = 220

export interface DayTooltipItem {
  id: string
  title: string
  color: string
}

export interface HoveredDay {
  date: string
  label: string
  events: DayTooltipItem[]
  overflow: number
  position: { top: number; left: number }
} /**
 * Posición fija del tooltip: siempre debajo de la celda, pegado al día.
 * Solo se corre hacia arriba lo justo si el contenido medido desbordaría el
 * viewport (celdas del fondo como diciembre), sin voltearse nunca arriba.
 * El `left` va centrado a la celda y clampeado para no cortarse en los bordes.
 */
export function positionForRect(rect: DOMRect): { top: number; left: number } {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, width - TOOLTIP_WIDTH - 8)
  )
  return { top: rect.bottom + 8, left }
}

/**
 * Tooltip rico de día compartido entre los modos meses y tira:
 * mismo contenido (fecha larga + hasta 5 eventos + overflow) y
 * misma posición. El render lo hace `DayTooltip.vue`.
 */
export function useDayTooltip(getEvents: (date: string | null) => DayTooltipItem[]) {
  const hovered = ref<HoveredDay | null>(null)

  /**
   * Tras montar el tooltip mide su alto real y lo sube lo justo para que no se
   * corte abajo del viewport. Sin medición (tests) o sin desborde no toca nada.
   */
  function fitMeasuredTooltip() {
    if (!hovered.value || typeof window === 'undefined') return
    const el = document.body.querySelector("[data-testid='day-tooltip']")
    if (!(el instanceof HTMLElement)) return
    const rendered = el.getBoundingClientRect()
    if (rendered.height === 0) return
    const overflow = rendered.bottom - (window.innerHeight - 8)
    if (overflow > 0) {
      hovered.value.position.top = Math.max(8, hovered.value.position.top - overflow)
    }
  }

  function showTooltip(date: string, target: HTMLElement | null) {
    const events = getEvents(date)
    hovered.value = {
      date,
      label: formatLongDateEs(date),
      events: events.slice(0, MAX_TOOLTIP_EVENTS),
      overflow: Math.max(0, events.length - MAX_TOOLTIP_EVENTS),
      position: target ? positionForRect(target.getBoundingClientRect()) : { top: 0, left: 0 },
    }
    void nextTick(fitMeasuredTooltip)
  }

  function hideTooltip() {
    hovered.value = null
  }

  function onDayEnter(date: string | null, event: Event) {
    if (!date) return
    showTooltip(date, event.currentTarget as HTMLElement | null)
  }

  return { hovered, showTooltip, hideTooltip, onDayEnter }
}
