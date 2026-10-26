import { describe, it, expect } from 'vitest'
import { findFreePlacement } from './schedulePlacement'

/** Minutos desde la medianoche de una hora del día. */
function at(hour: number, minute = 0): number {
  return hour * 60 + minute
}

function occupied(start: number, end: number) {
  return { start_minutes: start, end_minutes: end }
}

function placementText(minutes: number | null): string | null {
  if (minutes === null) return null
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

describe('findFreePlacement', () => {
  it('con el día vacío devuelve el inicio preferido', () => {
    expect(findFreePlacement(at(9), 30, [])).toBe(at(9))
  })

  it('recorta el preferido al rango del día', () => {
    expect(findFreePlacement(at(23, 50), 30, [])).toBe(at(23, 30))
    expect(findFreePlacement(-10, 30, [])).toBe(0)
  })

  it('con el preferido ocupado devuelve el borde del hueco más cercano', () => {
    // Ocupado 10:00–11:00; el hueco de las 11:00 está más cerca del 10:30.
    expect(placementText(findFreePlacement(at(10, 30), 30, [occupied(at(10), at(11))]))).toBe(
      '11:00'
    )
  })

  it('elige el hueco de arriba cuando es el más cercano', () => {
    // Ocupado 10:00–11:00: a las 09:20 la unidad entra justo antes.
    const slots = [occupied(at(10), at(11))]
    expect(placementText(findFreePlacement(at(9, 20), 30, slots))).toBe('09:20')
    // A las 09:40 solo entra hasta las 09:30 antes de las 10:00.
    expect(placementText(findFreePlacement(at(9, 40), 30, slots))).toBe('09:30')
  })

  it('entra en un hueco que no empieza en una fila de la grilla', () => {
    // Libre 10:15–10:45: una unidad de 30' entra exactamente ahí.
    const slots = [occupied(at(9), at(10, 15)), occupied(at(10, 45), at(11))]
    expect(placementText(findFreePlacement(at(10, 30), 30, slots))).toBe('10:15')
  })

  it('devuelve null cuando el día está completamente ocupado', () => {
    expect(findFreePlacement(at(12), 30, [occupied(0, 1440)])).toBeNull()
  })

  it('devuelve null cuando la unidad no entra en ningún hueco', () => {
    const slots = [occupied(at(8), at(9)), occupied(at(9, 15), at(10, 30))]
    const bounds = { start_minutes: at(8), end_minutes: at(10, 30) }
    expect(findFreePlacement(at(9), 90, slots, bounds)).toBeNull()
  })

  it('respeta los límites de la ventana visible', () => {
    const bounds = { start_minutes: at(8), end_minutes: at(18) }
    expect(findFreePlacement(0, 30, [], bounds)).toBe(at(8))
    expect(findFreePlacement(at(23), 30, [], bounds)).toBe(at(17, 30))
    // Fuera de la ventana hay hueco, pero no se ofrece.
    const slots = [occupied(at(8), at(18))]
    expect(findFreePlacement(at(8), 30, slots, bounds)).toBeNull()
  })

  it('ignora rangos inválidos y fusiona solapados', () => {
    const slots = [
      occupied(at(10), at(10)),
      occupied(at(11, 40), at(11, 20)),
      occupied(at(13, 20), at(14, 50)),
      occupied(at(14), at(15, 50)),
    ]
    // Lo ocupado real es 13:20–15:50: el hueco más cercano al 14:30 es 15:50.
    expect(placementText(findFreePlacement(at(14, 30), 30, slots))).toBe('15:50')
  })

  it('en un empate prefiere el hueco de arriba', () => {
    // Ocupado 10:00–11:00 y preferido 10:15: empate entre 09:30 y 11:00.
    expect(findFreePlacement(at(10, 15), 30, [occupied(at(10), at(11))])).toBe(at(9, 30))
  })

  it('con una unidad de una fila entra aunque el hueco sea justo', () => {
    const slots = [occupied(at(9), at(10)), occupied(at(10), at(11))]
    expect(placementText(findFreePlacement(at(10), 30, slots))).toBe('11:00')
  })
})
