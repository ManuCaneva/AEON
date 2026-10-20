import { describe, it, expect } from 'vitest'
import { pointerToSchedulePosition } from './scheduleDragGeometry'

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
