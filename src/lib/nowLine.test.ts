import { describe, it, expect } from 'vitest'
import { minutesSinceMidnight, nowLineTopPx } from './nowLine'

describe('minutesSinceMidnight', () => {
  it('devuelve los minutos transcurridos desde medianoche en hora local', () => {
    expect(minutesSinceMidnight(new Date(2026, 0, 5, 9, 30))).toBe(570)
    expect(minutesSinceMidnight(new Date(2026, 0, 5, 23, 59))).toBe(1439)
  })

  it('devuelve 0 exactamente a medianoche', () => {
    expect(minutesSinceMidnight(new Date(2026, 0, 5, 0, 0))).toBe(0)
  })
})

describe('nowLineTopPx', () => {
  const VENTANA = { start_minutes: 480, end_minutes: 720 } // 08:00–12:00
  const MINUTE_HEIGHT_PX = 2.5

  it('mapea la hora actual dentro de la Ventana visible a su posición en px', () => {
    // 09:00 → 60 min desde el inicio × 2.5 px por minuto
    expect(nowLineTopPx(540, VENTANA, MINUTE_HEIGHT_PX)).toBe(150)
  })

  it('borde de inicio: el primer minuto de la ventana queda en el borde superior', () => {
    expect(nowLineTopPx(480, VENTANA, MINUTE_HEIGHT_PX)).toBe(0)
  })

  it('borde de fin: el último minuto visible queda pegado al borde inferior', () => {
    expect(nowLineTopPx(719, VENTANA, MINUTE_HEIGHT_PX)).toBe(597.5)
  })

  it('devuelve null cuando la hora queda fuera de la Ventana visible', () => {
    expect(nowLineTopPx(479, VENTANA, MINUTE_HEIGHT_PX)).toBeNull() // 07:59
    expect(nowLineTopPx(720, VENTANA, MINUTE_HEIGHT_PX)).toBeNull() // fin exclusivo
    expect(nowLineTopPx(1439, VENTANA, MINUTE_HEIGHT_PX)).toBeNull() // 23:59
  })

  it('recalcula cuando cambia la Ventana visible', () => {
    const otraVentana = { start_minutes: 600, end_minutes: 720 } // 10:00–12:00
    expect(nowLineTopPx(660, VENTANA, MINUTE_HEIGHT_PX)).toBe(450) // 11:00 en 08:00–12:00
    expect(nowLineTopPx(660, otraVentana, MINUTE_HEIGHT_PX)).toBe(150) // 11:00 en 10:00–12:00
  })
})
