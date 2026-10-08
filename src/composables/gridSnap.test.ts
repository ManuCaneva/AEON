import { describe, it, expect } from 'vitest'
import { pxToCells } from './gridSnap'
import { COLS, ROWS } from '@/lib/grid'

describe('pxToCells', () => {
  const containerWidth = 1200
  const containerHeight = 600

  it('convierte píxeles a celdas enteras', () => {
    const result = pxToCells(200, 120, 300, 120, containerWidth, containerHeight)
    expect(result).toEqual({ x: 2, y: 2, w: 3, h: 2 })
  })

  it('redondea a la celda más cercana', () => {
    const result = pxToCells(250, 70, 249, 90, containerWidth, containerHeight)
    expect(result.x).toBe(3) // 250/100 = 2.5 → 3
    expect(result.y).toBe(1) // 70/60 = 1.17 → 1
    expect(result.w).toBe(2) // 4.99 - 3 = 1.99 → 2 (por pares de aristas)
    expect(result.h).toBe(2) // 2.67 - 1 = 1.67 → 2
  })

  it('clampea w/h a un mínimo de 1 celda', () => {
    const result = pxToCells(0, 0, 10, 10, containerWidth, containerHeight)
    expect(result.w).toBe(1)
    expect(result.h).toBe(1)
  })

  it('respeta minW/minH pasados', () => {
    const result = pxToCells(0, 0, 100, 100, containerWidth, containerHeight, {
      minW: 5,
      minH: 4,
    })
    expect(result.w).toBe(5)
    expect(result.h).toBe(4)
  })

  it('clampa para que x+w no exceda COLS', () => {
    const result = pxToCells(1100, 0, 400, 100, containerWidth, containerHeight)
    expect(result.x + result.w).toBeLessThanOrEqual(COLS)
    expect(result.x).toBe(COLS - 4)
  })

  it('clampa para que y+h no exceda ROWS', () => {
    const result = pxToCells(0, 550, 100, 400, containerWidth, containerHeight)
    expect(result.y + result.h).toBeLessThanOrEqual(ROWS)
    expect(result.y).toBe(ROWS - 7)
  })

  it('valores negativos se clampean a 0', () => {
    const result = pxToCells(-100, -100, 100, 80, containerWidth, containerHeight)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })
})

describe('pxToCells — achique por las cuatro aristas', () => {
  const W = 1200
  const H = 600
  // col = 100px, row = 60px (gap 0). Item en (2,2) de 4×3:
  // left=200 right=600 top=120 bottom=300.
  const leftPx = 200
  const topPx = 120
  const widthPx = 400
  const heightPx = 180

  it('achicar desde la derecha ancla la izquierda', () => {
    const result = pxToCells(leftPx, topPx, 200, heightPx, W, H)
    expect(result).toEqual({ x: 2, y: 2, w: 2, h: 3 })
  })

  it('achicar desde la izquierda ancla la derecha', () => {
    // El borde izquierdo avanza 200px; el derecho queda fijo en 600 (x=6).
    const result = pxToCells(400, topPx, 200, heightPx, W, H, { anchorX: 'end' })
    expect(result).toEqual({ x: 4, y: 2, w: 2, h: 3 })
    expect(result.x + result.w).toBe(6)
  })

  it('achicar desde abajo ancla arriba', () => {
    const result = pxToCells(leftPx, topPx, widthPx, 120, W, H)
    expect(result).toEqual({ x: 2, y: 2, w: 4, h: 2 })
  })

  it('achicar desde arriba ancla abajo', () => {
    // El borde superior baja a 180px; el inferior queda fijo en 300 (y=5).
    const result = pxToCells(leftPx, 180, widthPx, 120, W, H, { anchorY: 'end' })
    expect(result).toEqual({ x: 2, y: 3, w: 4, h: 2 })
    expect(result.y + result.h).toBe(5)
  })

  it('agrandar desde la izquierda no mueve el borde derecho', () => {
    const result = pxToCells(100, topPx, 500, heightPx, W, H, { anchorX: 'end' })
    expect(result).toEqual({ x: 1, y: 2, w: 5, h: 3 })
    expect(result.x + result.w).toBe(6)
  })

  it('agrandar desde arriba no mueve el borde inferior', () => {
    const result = pxToCells(leftPx, 60, widthPx, 240, W, H, { anchorY: 'end' })
    expect(result).toEqual({ x: 2, y: 1, w: 4, h: 4 })
    expect(result.y + result.h).toBe(5)
  })

  it('al achicar nunca agranda ni se desplaza fuera del footprint', () => {
    const original = { x: 2, y: 2, w: 4, h: 3 }
    const shrinks = [
      pxToCells(leftPx, topPx, 250, heightPx, W, H),
      pxToCells(350, topPx, 250, heightPx, W, H, { anchorX: 'end' }),
      pxToCells(leftPx, topPx, widthPx, 150, W, H),
      pxToCells(leftPx, 150, widthPx, 150, W, H, { anchorY: 'end' }),
    ]
    for (const r of shrinks) {
      expect(r.x).toBeGreaterThanOrEqual(original.x)
      expect(r.y).toBeGreaterThanOrEqual(original.y)
      expect(r.x + r.w).toBeLessThanOrEqual(original.x + original.w)
      expect(r.y + r.h).toBeLessThanOrEqual(original.y + original.h)
    }
  })

  it('resuelve el empate de media celda sin saltar de más y con la arista opuesta fija', () => {
    // El borde izquierdo cae justo en media celda (2.5); el derecho queda en 6.
    const half = pxToCells(250, topPx, 350, heightPx, W, H, { anchorX: 'end' })
    expect(half).toEqual({ x: 3, y: 2, w: 3, h: 3 })
    expect(half.x + half.w).toBe(6)

    // Justo por debajo del empate sigue en 2 (no hubo salto de columna entera).
    const below = pxToCells(249, topPx, 351, heightPx, W, H, { anchorX: 'end' })
    expect(below.x).toBe(2)
    expect(below.x + below.w).toBe(6)
  })

  it('respeta el piso minW/minH anclando la arista opuesta', () => {
    const result = pxToCells(900, topPx, -300, heightPx, W, H, { minW: 2, anchorX: 'end' })
    expect(result).toEqual({ x: 4, y: 2, w: 2, h: 3 })
    expect(result.x + result.w).toBe(6)
  })

  it('respeta los límites de la grilla', () => {
    const result = pxToCells(1100, 550, 400, 400, W, H)
    expect(result.x + result.w).toBeLessThanOrEqual(COLS)
    expect(result.y + result.h).toBeLessThanOrEqual(ROWS)
    expect(result.w).toBeGreaterThanOrEqual(1)
    expect(result.h).toBeGreaterThanOrEqual(1)
  })
})

describe('pxToCells — pomodoro 2×3 (mínimo) desde izquierda/arriba', () => {
  const W = 1200
  const H = 600
  // Pomodoro en (6,3), 2×3, minW=2 minH=3: left=600 right=800 top=180 bottom=360.
  const opts = { minW: 2, minH: 3 }

  it.each([50, 100, 300])('achicar %ipx desde la izquierda no lo desliza', (drag) => {
    const result = pxToCells(600 + drag, 180, 200 - drag, 180, W, H, {
      ...opts,
      anchorX: 'end',
    })
    expect(result).toEqual({ x: 6, y: 3, w: 2, h: 3 })
  })

  it.each([30, 60, 180])('achicar %ipx desde arriba no lo desliza', (drag) => {
    const result = pxToCells(600, 180 + drag, 200, 180 - drag, W, H, {
      ...opts,
      anchorY: 'end',
    })
    expect(result).toEqual({ x: 6, y: 3, w: 2, h: 3 })
  })
})

describe('pxToCells — gap entre celdas', () => {
  const W = 1200
  const H = 600

  it('descuenta el gap al mapear px→borde de celda', () => {
    // Sin gap, 50px es media celda de 100px → redondea a 1.
    expect(pxToCells(50, 0, 100, 60, W, H).x).toBe(1)
    // Con gap 4 el paso es ~100.33px, así que 50px queda por debajo de la mitad.
    expect(pxToCells(50, 0, 100, 60, W, H, { gap: 4 }).x).toBe(0)
    // Un paso completo (~100.33px) sí cruza a la columna siguiente.
    expect(pxToCells(101, 0, 100, 60, W, H, { gap: 4 }).x).toBe(1)
  })
})
