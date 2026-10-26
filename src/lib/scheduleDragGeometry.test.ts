import { describe, it, expect } from 'vitest'
import {
  growWindowAtEdge,
  growthEdgeAt,
  pointerToScheduleMinutes,
  pointerToSchedulePosition,
} from './scheduleDragGeometry'
import { MINUTES_PER_DAY } from './scheduleTime'

describe('pointerToSchedulePosition', () => {
  const rect = { left: 0, top: 0, width: 700, height: 600 }
  const geometry = {
    enabledDays: [0, 1, 2, 3, 4, 5, 6],
    windowStart: 480,
    minuteHeightPx: 1,
  }

  it('mapea el puntero al minuto exacto sin cuantizar a la granularidad', () => {
    const point = pointerToSchedulePosition(350, 515, rect, geometry)

    expect(point.day).toBe(3) // cuarta columna → jueves
    expect(point.minutes).toBe(995) // 480 + 515 → 16:35
  })

  it('solo redondea al minuto, no a la granularidad', () => {
    expect(pointerToSchedulePosition(0, 515.4, rect, geometry).minutes).toBe(995)
    expect(pointerToSchedulePosition(0, 515.6, rect, geometry).minutes).toBe(996)
  })

  it('limita la columna a los días habilitados', () => {
    const weekdays = { ...geometry, enabledDays: [0, 1, 2, 3, 4] }

    expect(pointerToSchedulePosition(699, 0, rect, weekdays).day).toBe(4)
    expect(pointerToSchedulePosition(-20, 0, rect, weekdays).day).toBe(0)
  })

  it('traduce la columna al día real cuando hay días deshabilitados', () => {
    const monWedFri = { ...geometry, enabledDays: [0, 2, 4] }

    expect(pointerToSchedulePosition(350, 0, rect, monWedFri).day).toBe(2)
  })
})

describe('pointerToScheduleMinutes', () => {
  const rect = { top: 20 }
  const geometry = { windowStart: 960, minuteHeightPx: 5 }

  it('traduce la altura del puntero al minuto del día', () => {
    expect(pointerToScheduleMinutes(195, rect, geometry)).toBe(995) // 16:35
  })

  it('redondea al minuto', () => {
    expect(pointerToScheduleMinutes(42.4, rect, geometry)).toBe(964)
    expect(pointerToScheduleMinutes(43.6, rect, geometry)).toBe(965)
  })

  it('sin píxeles por minuto se queda en el borde superior de la ventana', () => {
    expect(pointerToScheduleMinutes(300, rect, { windowStart: 960, minuteHeightPx: 0 })).toBe(960)
  })
})

describe('growthEdgeAt', () => {
  const rect = { top: 0, bottom: 600 }

  it('detecta la banda del borde superior', () => {
    expect(growthEdgeAt(10, rect)).toBe('top')
    expect(growthEdgeAt(0, rect)).toBe('top')
  })

  it('detecta la banda del borde inferior', () => {
    expect(growthEdgeAt(590, rect)).toBe('bottom')
    expect(growthEdgeAt(600, rect)).toBe('bottom')
  })

  it('lejos de los bordes no hay banda', () => {
    expect(growthEdgeAt(300, rect)).toBeNull()
    expect(growthEdgeAt(100, rect)).toBeNull()
  })
})

describe('growWindowAtEdge', () => {
  const window = { start_minutes: 960, end_minutes: 1080 }

  it('crece una hora hacia arriba cuando la banda es la superior', () => {
    expect(growWindowAtEdge(window, 'top')).toEqual({
      start_minutes: 900,
      end_minutes: 1080,
    })
  })

  it('crece una hora hacia abajo cuando la banda es la inferior', () => {
    expect(growWindowAtEdge(window, 'bottom')).toEqual({
      start_minutes: 960,
      end_minutes: 1140,
    })
  })

  it('sin banda no toca la ventana', () => {
    expect(growWindowAtEdge(window, null)).toEqual(window)
  })

  it('no se pasa del inicio ni del fin del día', () => {
    expect(growWindowAtEdge({ start_minutes: 0, end_minutes: 60 }, 'top')).toEqual({
      start_minutes: 0,
      end_minutes: 60,
    })
    expect(
      growWindowAtEdge({ start_minutes: 1380, end_minutes: MINUTES_PER_DAY }, 'bottom')
    ).toEqual({
      start_minutes: 1380,
      end_minutes: MINUTES_PER_DAY,
    })
  })
})
