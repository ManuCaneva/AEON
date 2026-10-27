import { describe, expect, it } from 'vitest'
import {
  POMODORO_ORB_DEFAULT_DIAMETER,
  POMODORO_ORB_MAX_DIAMETER,
  POMODORO_ORB_MIN_DIAMETER,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
  choosePillPlacement,
  clampOrbDiameter,
  orbFromWindowRect,
  orbWindowRect,
  resizedDiameter,
  resizedOrbAroundCenter,
  resolveOrbDiameter,
} from './pomodoroMiniLayout'

const monitor = { x: 0, y: 0, width: 1920, height: 1080 }

describe('constantes de la mascota', () => {
  it('el rango de diámetro tiene default dentro de los límites', () => {
    expect(POMODORO_ORB_MIN_DIAMETER).toBeLessThan(POMODORO_ORB_DEFAULT_DIAMETER)
    expect(POMODORO_ORB_DEFAULT_DIAMETER).toBeLessThan(POMODORO_ORB_MAX_DIAMETER)
    expect(POMODORO_ORB_MIN_DIAMETER).toBe(80)
    expect(POMODORO_ORB_DEFAULT_DIAMETER).toBe(200)
    expect(POMODORO_ORB_MAX_DIAMETER).toBe(480)
  })

  it('la pastilla tiene alto y separación positivos', () => {
    expect(POMODORO_PILL_HEIGHT).toBeGreaterThan(0)
    expect(POMODORO_PILL_GAP).toBeGreaterThan(0)
  })
})

describe('clampOrbDiameter', () => {
  it('recorta al mínimo y al máximo', () => {
    expect(clampOrbDiameter(20)).toBe(POMODORO_ORB_MIN_DIAMETER)
    expect(clampOrbDiameter(5000)).toBe(POMODORO_ORB_MAX_DIAMETER)
  })

  it('un diámetro en rango pasa entero, sin fracciones', () => {
    expect(clampOrbDiameter(200)).toBe(200)
    expect(clampOrbDiameter(200.6)).toBe(201)
    expect(clampOrbDiameter(140.4)).toBe(140)
  })
})

describe('resolveOrbDiameter', () => {
  it('sin tamaño guardado usa el default', () => {
    expect(resolveOrbDiameter({ width: null, height: null })).toBe(POMODORO_ORB_DEFAULT_DIAMETER)
  })

  it('el ancho guardado es el diámetro', () => {
    expect(resolveOrbDiameter({ width: 160, height: null })).toBe(160)
  })

  it('los estados de la mini rectangular (ancho y alto distintos) usan el ancho', () => {
    expect(resolveOrbDiameter({ width: 160, height: 180 })).toBe(160)
  })

  it('un solo valor guardado alcanza, venga en width o en height', () => {
    expect(resolveOrbDiameter({ width: null, height: 175 })).toBe(175)
  })

  it('un tamaño guardado imposible se recorta al rango válido', () => {
    expect(resolveOrbDiameter({ width: 40, height: 20 })).toBe(POMODORO_ORB_MIN_DIAMETER)
    expect(resolveOrbDiameter({ width: 5000, height: 5000 })).toBe(POMODORO_ORB_MAX_DIAMETER)
  })
})

describe('resizedDiameter', () => {
  it('mover el mouse a la derecha agranda', () => {
    expect(resizedDiameter(200, 30, 0)).toBe(230)
  })

  it('mover el mouse hacia arriba agranda', () => {
    expect(resizedDiameter(200, 0, -30)).toBe(230)
  })

  it('mover el mouse a la izquierda o hacia abajo achica', () => {
    expect(resizedDiameter(200, -30, 0)).toBe(170)
    expect(resizedDiameter(200, 0, 30)).toBe(170)
  })

  it('el delta diagonal combina ambos ejes', () => {
    expect(resizedDiameter(200, 25, -25)).toBe(250)
    expect(resizedDiameter(200, -25, 25)).toBe(150)
  })

  it('el resultado nunca se sale del rango válido', () => {
    expect(resizedDiameter(150, -500, 500)).toBe(POMODORO_ORB_MIN_DIAMETER)
    expect(resizedDiameter(400, 500, -500)).toBe(POMODORO_ORB_MAX_DIAMETER)
  })

  it('el delta es acumulado desde el inicio del gesto: el mismo delta da siempre el mismo tamaño', () => {
    expect(resizedDiameter(200, 40, -10)).toBe(resizedDiameter(200, 40, -10))
    expect(resizedDiameter(200, 40, -10)).toBe(250)
  })
})

describe('orbWindowRect', () => {
  const orb = { x: 100, y: 200, diameter: 160 }
  const pillSpace = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT

  it('sin pastilla la ventana es el cuadrado del disco', () => {
    expect(orbWindowRect(orb, 'none')).toEqual({ x: 100, y: 200, width: 160, height: 160 })
  })

  it('con la pastilla abajo crece hacia abajo y el disco queda fijo', () => {
    expect(orbWindowRect(orb, 'below')).toEqual({
      x: 100,
      y: 200,
      width: 160,
      height: 160 + pillSpace,
    })
  })

  it('con la pastilla arriba crece hacia arriba y el disco queda fijo', () => {
    expect(orbWindowRect(orb, 'above')).toEqual({
      x: 100,
      y: 200 - pillSpace,
      width: 160,
      height: 160 + pillSpace,
    })
  })
})

describe('orbFromWindowRect', () => {
  const orb = { x: 100, y: 200, diameter: 160 }

  it.each(['none', 'below', 'above'] as const)(
    'el disco se recupera sin error desde su ventana (%s)',
    (placement) => {
      const rect = orbWindowRect(orb, placement)
      expect(orbFromWindowRect(rect, placement)).toEqual(orb)
    }
  )
})

describe('resizedOrbAroundCenter', () => {
  const orb = { x: 100, y: 200, diameter: 160 }

  it('el centro del disco queda fijo al cambiar el tamaño', () => {
    const next = resizedOrbAroundCenter(orb, 200)
    expect(next.x + next.diameter / 2).toBe(180)
    expect(next.y + next.diameter / 2).toBe(280)
    expect(next.diameter).toBe(200)
  })

  it('achicar también conserva el centro', () => {
    const next = resizedOrbAroundCenter(orb, 10)
    expect(next.x + next.diameter / 2).toBe(180)
    expect(next.y + next.diameter / 2).toBe(280)
    expect(next.diameter).toBe(POMODORO_ORB_MIN_DIAMETER)
  })

  it('el diámetro pedido se recorta al rango válido', () => {
    expect(resizedOrbAroundCenter(orb, 5000).diameter).toBe(POMODORO_ORB_MAX_DIAMETER)
  })
})

describe('choosePillPlacement', () => {
  it('si entra abajo del disco, la pastilla va abajo', () => {
    expect(choosePillPlacement({ x: 0, y: 0, diameter: 200 }, monitor)).toBe('below')
    expect(choosePillPlacement({ x: 0, y: 700, diameter: 200 }, monitor)).toBe('below')
  })

  it('cerca del borde inferior del monitor flipa arriba', () => {
    expect(choosePillPlacement({ x: 0, y: 900, diameter: 200 }, monitor)).toBe('above')
    expect(choosePillPlacement({ x: 0, y: 1000, diameter: 200 }, monitor)).toBe('above')
  })

  it('sin monitor disponible asume abajo', () => {
    expect(choosePillPlacement({ x: 0, y: 5000, diameter: 200 }, null)).toBe('below')
  })

  it('el borde exacto donde todavía entra cuenta como abajo', () => {
    const pillSpace = POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT
    const diameter = 200
    const y = monitor.height - diameter - pillSpace
    expect(choosePillPlacement({ x: 0, y, diameter }, monitor)).toBe('below')
    expect(choosePillPlacement({ x: 0, y: y + 1, diameter }, monitor)).toBe('above')
  })
})
