import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Contrato de la animación del anillo del pomodoro. El movimiento suave vive
 * en CSS (sin rAF, ADR 0006/0007): el `stroke-dashoffset` cambia una vez por
 * segundo y la transición lo interpola durante ese segundo, así el anillo
 * avanza continuo y se congela de golpe al pausar.
 */
describe('pomodoro ring (anillo SVG)', () => {
  const css = readFileSync('src/styles/tailwind.css', 'utf-8')

  function rule(selector: string): string {
    const match = css.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`))
    expect(match, `falta la regla ${selector} en tailwind.css`).not.toBeNull()
    return match![0]
  }

  it('el progreso transiciona stroke-dashoffset y stroke, y el track no pinta relleno', () => {
    const progreso = rule('.pomodoro-ring-progress')
    expect(progreso).toMatch(/transition:[^;]*stroke-dashoffset/)
    expect(progreso).toMatch(/transition:[^;]*stroke[^-]/)
    expect(progreso).toMatch(/stroke-dasharray:\s*100/)

    const track = rule('.pomodoro-ring-track')
    expect(track).toMatch(/fill:\s*none/)
  })

  it('el anillo es decorativo y no intercepta los clicks de los controles del disco', () => {
    // El SVG cubre todo el círculo y el disco con los botones va dentro de su
    // slot: sin pointer-events: none el overlay posicionado se traga los clicks
    // de reset/toggle/skip (jsdom no hace hit-testing, por eso se fija en CSS).
    const anillo = rule('.pomodoro-ring')
    expect(anillo).toMatch(/pointer-events:\s*none/)
  })

  it('el countdown funde su entrada con una animación corta', () => {
    expect(css).toMatch(/\.pomodoro-fade-in\s*\{[^}]*animation:[^;]*pomodoro-fade/)
    expect(css).toMatch(/@keyframes pomodoro-fade[^{]*\{[^}]*opacity:\s*0/)
  })
})
