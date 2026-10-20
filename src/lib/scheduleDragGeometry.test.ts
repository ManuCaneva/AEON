import { describe, it, expect } from 'vitest'
import { growWindowAtEdge, pointerToSchedulePosition } from './scheduleDragGeometry'

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

describe('growWindowAtEdge', () => {
  const rect = { top: 0, bottom: 600 }
  const window = { start_minutes: 960, end_minutes: 1080 }

  it('crece una hora hacia arriba cuando el puntero está cerca del borde superior', () => {
    expect(growWindowAtEdge(window, 10, rect)).toEqual({
      start_minutes: 900,
      end_minutes: 1080,
    })
  })

  it('crece una hora hacia abajo cuando el puntero está cerca del borde inferior', () => {
    expect(growWindowAtEdge(window, 590, rect)).toEqual({
      start_minutes: 960,
      end_minutes: 1140,
    })
  })

  it('no crece lejos de los bordes', () => {
    expect(growWindowAtEdge(window, 300, rect)).toEqual(window)
  })

  it('crece de a una hora por vez: cada acercamiento suma sesenta minutos', () => {
    const once = growWindowAtEdge(window, 0, rect)

    expect(growWindowAtEdge(once, 0, rect)).toEqual({
      start_minutes: 840,
      end_minutes: 1080,
    })
  })

  it('no se pasa del inicio ni del fin del día', () => {
    expect(growWindowAtEdge({ start_minutes: 0, end_minutes: 60 }, 0, rect)).toEqual({
      start_minutes: 0,
      end_minutes: 60,
    })
    expect(growWindowAtEdge({ start_minutes: 1380, end_minutes: 1440 }, 600, rect)).toEqual({
      start_minutes: 1380,
      end_minutes: 1440,
    })
  })
})
