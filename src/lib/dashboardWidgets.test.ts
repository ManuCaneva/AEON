import { describe, it, expect } from 'vitest'
import { widgets, getWidgetById } from './dashboardWidgets'
import { COLS, ROWS } from './grid'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('dashboardWidgets', () => {
  it('expone el widget de hábitos', () => {
    const widget = getWidgetById('habits')
    expect(widget).toBeDefined()
    expect(widget?.id).toBe('habits')
    expect(widget?.title).toBe('Hábitos')
  })

  it('expone el widget de cronograma semanal', () => {
    const widget = getWidgetById('weekly-schedule')
    expect(widget).toBeDefined()
    expect(widget?.title).toBe('Cronograma Semanal')
  })

  it('expone el widget de Pomodoro habilitado por defecto con dimensiones compactas', () => {
    const widget = getWidgetById('pomodoro')
    expect(widget).toBeDefined()
    expect(widget?.title).toBe('Pomodoro')
    expect(widget?.defaultX).toBe(0)
    expect(widget?.defaultY).toBe(7)
    expect(widget?.defaultW).toBe(2)
    expect(widget?.defaultH).toBe(3)
    expect(widget?.defaultEnabled).toBe(true)
  })

  it('expone el widget de Notas habilitado por defecto', () => {
    const widget = getWidgetById('notes')
    expect(widget).toBeDefined()
    expect(widget?.title).toBe('Notas')
    expect(widget?.defaultEnabled).not.toBe(false)
  })

  it('cada widget tiene dimensiones por defecto válidas (celdas enteras)', () => {
    widgets.forEach((w) => {
      expect(w.minW).toBeGreaterThan(0)
      expect(w.minH).toBeGreaterThan(0)
      expect(w.defaultW).toBeGreaterThan(0)
      expect(w.defaultH).toBeGreaterThan(0)
      expect(w.defaultW).toBeLessThanOrEqual(COLS)
      expect(w.defaultH).toBeLessThanOrEqual(ROWS)
      expect(w.defaultW).toBeGreaterThanOrEqual(w.minW)
      expect(w.defaultH).toBeGreaterThanOrEqual(w.minH)
    })
  })

  it('widget de hábitos tiene default 2 celdas de ancho × 7 de alto en la esquina', () => {
    const widget = getWidgetById('habits')!
    expect(widget.defaultX).toBe(0)
    expect(widget.defaultY).toBe(0)
    expect(widget.defaultW).toBe(2)
    expect(widget.defaultH).toBe(7)
  })

  it('widget de hábitos permite resize pequeño (mínimo 1 celda de ancho y alto)', () => {
    const widget = getWidgetById('habits')!
    expect(widget.minW).toBe(1)
    expect(widget.minH).toBe(1)
  })

  it('devuelve undefined para un id desconocido', () => {
    expect(getWidgetById('unknown')).toBeUndefined()
  })

  it('los widgets habilitados por defecto no se superponen entre sí', () => {
    const enabled = widgets
      .filter((w) => w.defaultEnabled !== false)
      .map((w) => ({ x: w.defaultX, y: w.defaultY, w: w.defaultW, h: w.defaultH }))
    for (let i = 0; i < enabled.length; i++) {
      for (let j = i + 1; j < enabled.length; j++) {
        expect(overlaps(enabled[i], enabled[j])).toBe(false)
      }
    }
  })

  it('la distribución por defecto coloca los siete widgets en la geometría esperada', () => {
    const expected: Record<string, Rect> = {
      habits: { x: 0, y: 0, w: 2, h: 7 },
      pomodoro: { x: 0, y: 7, w: 2, h: 3 },
      'weekly-schedule': { x: 2, y: 0, w: 6, h: 5 },
      notes: { x: 2, y: 5, w: 6, h: 5 },
      goals: { x: 8, y: 0, w: 3, h: 5 },
      tasks: { x: 8, y: 5, w: 3, h: 5 },
      'year-calendar': { x: 11, y: 0, w: 1, h: 10 },
    }
    const enabled = widgets.filter((w) => w.defaultEnabled !== false)
    expect(enabled).toHaveLength(7)
    for (const [id, rect] of Object.entries(expected)) {
      const widget = enabled.find((w) => w.id === id)
      expect(widget, `widget "${id}" habilitado por defecto`).toBeDefined()
      expect(
        { x: widget!.defaultX, y: widget!.defaultY, w: widget!.defaultW, h: widget!.defaultH },
        `geometría de "${id}"`
      ).toEqual(rect)
    }
  })

  it('los tamaños mínimos de cada widget no cambiaron', () => {
    const expectedMin: Record<string, { minW: number; minH: number }> = {
      habits: { minW: 1, minH: 1 },
      tasks: { minW: 1, minH: 1 },
      goals: { minW: 1, minH: 1 },
      pomodoro: { minW: 2, minH: 3 },
      'year-calendar': { minW: 1, minH: 3 },
      'weekly-schedule': { minW: 5, minH: 4 },
      notes: { minW: 1, minH: 2 },
    }
    for (const [id, min] of Object.entries(expectedMin)) {
      const widget = getWidgetById(id)!
      expect(widget.minW, `minW de "${id}"`).toBe(min.minW)
      expect(widget.minH, `minH de "${id}"`).toBe(min.minH)
    }
  })

  it('la distribución por defecto tesela la grilla 12×10 sin huecos', () => {
    const enabled = widgets.filter((w) => w.defaultEnabled !== false)
    const area = enabled.reduce((acc, w) => acc + w.defaultW * w.defaultH, 0)
    expect(area).toBe(COLS * ROWS)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const covering = enabled.filter(
          (w) =>
            w.defaultX <= col &&
            col < w.defaultX + w.defaultW &&
            w.defaultY <= row &&
            row < w.defaultY + w.defaultH
        )
        expect(covering, `celda (${col}, ${row}) debe tener exactamente un widget`).toHaveLength(1)
      }
    }
  })

  it('todos los widgets por defecto entran en la grilla 12×10', () => {
    widgets.forEach((w) => {
      expect(w.defaultX).toBeGreaterThanOrEqual(0)
      expect(w.defaultY).toBeGreaterThanOrEqual(0)
      expect(w.defaultX + w.defaultW).toBeLessThanOrEqual(COLS)
      expect(w.defaultY + w.defaultH).toBeLessThanOrEqual(ROWS)
    })
  })
})
