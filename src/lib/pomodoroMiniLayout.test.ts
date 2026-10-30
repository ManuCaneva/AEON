import { describe, expect, it } from 'vitest'
import {
  POMODORO_MINI_WINDOW_MARGIN,
  POMODORO_ORB_DEFAULT_DIAMETER,
  POMODORO_ORB_MAX_DIAMETER,
  POMODORO_ORB_MIN_DIAMETER,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
  POMODORO_PILL_SHADOW_ROOM,
  POMODORO_PILL_WIDTH,
  clampOrbDiameter,
  containOrbInMonitor,
  defaultOrbRect,
  mascotShapeRects,
  mascotWindowSize,
  orbIntersectsMonitor,
  orbWindowRect,
  type MonitorRect,
  type OrbRect,
} from './pomodoroMiniLayout'

const monitor: MonitorRect = { x: 0, y: 0, width: 1360, height: 768 }

describe('clampOrbDiameter', () => {
  it('respeta el mínimo y el máximo', () => {
    expect(clampOrbDiameter(20)).toBe(POMODORO_ORB_MIN_DIAMETER)
    expect(clampOrbDiameter(5000)).toBe(POMODORO_ORB_MAX_DIAMETER)
  })

  it('redondea a píxeles enteros', () => {
    expect(clampOrbDiameter(99.6)).toBe(100)
  })
})

describe('mascotWindowSize', () => {
  it('devuelve una superficie cuadrada con el disco y la franja de la pastilla', () => {
    const lado =
      POMODORO_ORB_DEFAULT_DIAMETER +
      POMODORO_PILL_GAP +
      POMODORO_PILL_HEIGHT +
      POMODORO_PILL_SHADOW_ROOM

    expect(mascotWindowSize(POMODORO_ORB_DEFAULT_DIAMETER)).toEqual({
      width: lado,
      height: lado,
    })
  })

  it('clampea el diámetro del disco', () => {
    expect(mascotWindowSize(20).width).toBe(
      POMODORO_ORB_MIN_DIAMETER +
        POMODORO_PILL_GAP +
        POMODORO_PILL_HEIGHT +
        POMODORO_PILL_SHADOW_ROOM
    )
  })
})

describe('orbWindowRect', () => {
  it('es la ventana completa: disco arriba y franja de pastilla abajo', () => {
    const orb: OrbRect = { x: 100, y: 200, diameter: 160 }
    const size = mascotWindowSize(160)

    expect(orbWindowRect(orb)).toEqual({ x: 77, y: 200, ...size })
  })

  it('clampea el diámetro de la ventana', () => {
    const lado =
      POMODORO_ORB_MIN_DIAMETER +
      POMODORO_PILL_GAP +
      POMODORO_PILL_HEIGHT +
      POMODORO_PILL_SHADOW_ROOM
    const rect = orbWindowRect({ x: 0, y: 0, diameter: 20 })

    expect(rect).toMatchObject({ width: lado, height: lado })
  })
})

describe('defaultOrbRect', () => {
  it('ubica la ventana completa contra la esquina inferior derecha', () => {
    const lado =
      POMODORO_ORB_DEFAULT_DIAMETER +
      POMODORO_PILL_GAP +
      POMODORO_PILL_HEIGHT +
      POMODORO_PILL_SHADOW_ROOM

    expect(defaultOrbRect(monitor, POMODORO_ORB_DEFAULT_DIAMETER)).toEqual({
      x: monitor.width - lado - POMODORO_MINI_WINDOW_MARGIN + 23,
      y: monitor.height - lado - POMODORO_MINI_WINDOW_MARGIN,
      diameter: POMODORO_ORB_DEFAULT_DIAMETER,
    })
  })

  it('no deja la ventana fuera del monitor', () => {
    const chico: MonitorRect = { x: 0, y: 0, width: 80, height: 80 }

    expect(defaultOrbRect(chico, POMODORO_ORB_DEFAULT_DIAMETER)).toMatchObject({ x: 23, y: 0 })
  })
})

describe('containOrbInMonitor', () => {
  it('deja la ventana completa adentro cuando se pasa por abajo a la derecha', () => {
    const orb: OrbRect = { x: monitor.width - 40, y: monitor.height - 20, diameter: 100 }
    const rect = orbWindowRect(orb)

    expect(containOrbInMonitor(orb, monitor)).toEqual({
      x: monitor.width - rect.width + 23,
      y: monitor.height - rect.height,
      diameter: 100,
    })
  })

  it('no mueve una ventana que ya entra', () => {
    const orb: OrbRect = { x: 100, y: 200, diameter: 100 }

    expect(containOrbInMonitor(orb, monitor)).toEqual(orb)
  })

  it('si el monitor es más chico que la ventana, la pega a su origen', () => {
    const chico: MonitorRect = { x: 10, y: 20, width: 40, height: 40 }

    expect(containOrbInMonitor({ x: 100, y: 100, diameter: 100 }, chico)).toEqual({
      x: 33,
      y: 20,
      diameter: 100,
    })
  })
})

describe('orbIntersectsMonitor', () => {
  it('detecta si la ventana guardada pertenece al monitor actual', () => {
    expect(orbIntersectsMonitor({ x: 100, y: 200, diameter: 100 }, monitor)).toBe(true)
    expect(orbIntersectsMonitor({ x: 5000, y: 200, diameter: 100 }, monitor)).toBe(false)
  })
})

describe('mascotShapeRects', () => {
  const side = mascotWindowSize(POMODORO_ORB_DEFAULT_DIAMETER).width
  const rects = mascotShapeRects(POMODORO_ORB_DEFAULT_DIAMETER, 1)

  function covers(x: number, y: number): boolean {
    return rects.some(
      (rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
    )
  }

  it('cubre el centro y el borde izquierdo del disco', () => {
    expect(covers(side / 2, POMODORO_ORB_DEFAULT_DIAMETER / 2)).toBe(true)
    expect(
      covers(side / 2 - POMODORO_ORB_DEFAULT_DIAMETER / 2, POMODORO_ORB_DEFAULT_DIAMETER / 2)
    ).toBe(true)
  })

  it('deja afuera las esquinas de la ventana', () => {
    expect(covers(0, 0)).toBe(false)
    expect(covers(side - 1, 0)).toBe(false)
    expect(covers(0, side - 1)).toBe(false)
  })

  it('cubre la pastilla, siempre debajo del disco', () => {
    const pillCenterY = POMODORO_ORB_DEFAULT_DIAMETER + POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT / 2
    const pillCenterX = side / 2

    expect(covers(pillCenterX, pillCenterY)).toBe(true)
    expect(covers(pillCenterX - POMODORO_PILL_WIDTH / 2 + 1, pillCenterY)).toBe(true)
    expect(covers(pillCenterX, POMODORO_ORB_DEFAULT_DIAMETER + 1)).toBe(false)
  })

  it('no genera rectángulos fuera de la ventana', () => {
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(side)
      expect(rect.y + rect.height).toBeLessThanOrEqual(side)
    }
  })

  it('en reposo no dibuja ni intercepta clicks debajo del disco', () => {
    expect(mascotShapeRects(100).every((rect) => rect.y < 100)).toBe(true)
  })

  it('revela la pastilla desde el centro sin cambiar el disco', () => {
    const hidden = mascotShapeRects(100, 0)
    const partial = mascotShapeRects(100, 0.5)
    expect(partial.filter((rect) => rect.y < 100)).toEqual(hidden)
    const pill = partial.filter((rect) => rect.y >= 100)
    expect(pill).toHaveLength(15)
    expect(pill[0].y).toBe(116)
    expect(pill[pill.length - 1]?.y).toBe(130)
  })

  it('no agrega una franja exterior al redondear la silueta del disco', () => {
    // A y=0.5, el círculo de radio 50 cubre centros de píxel x=66.5..79.5.
    expect(mascotShapeRects(100, 0)[0]).toEqual({ x: 66, y: 0, width: 14, height: 1 })
  })
})
