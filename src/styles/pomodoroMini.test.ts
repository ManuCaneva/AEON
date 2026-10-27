import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Contrato del escalado de la ventana mini, que ahora se puede achicar hasta
 * 80 px de diámetro. Los container queries bajan el contador y compactan los
 * controles para que el disco respire en todo el rango 80–210 px, sin dejar de
 * respetar la escala de Configuración (`--text-scale`).
 */
describe('layout de la ventana mini (80–210 px)', () => {
  const css = readFileSync('src/styles/tailwind.css', 'utf-8')

  it('el contenedor de la mini dispara los tiers: el disco mide el área disponible', () => {
    expect(css).toMatch(/\.container-widget \.pomodoro-circle\s*\{[^}]*min\(100cqw,\s*100cqh\)/)
  })

  it('hasta 240 px el contador baja su piso y los controles se compactan', () => {
    const tier = css.match(/@container \(max-width: 240px\)\s*\{[\s\S]*?\n\}/)
    expect(tier).not.toBeNull()
    expect(tier![0]).toMatch(/\.pomodoro-countdown\s*\{[^}]*1rem \* var\(--text-scale\)/)
    expect(tier![0]).toMatch(/\.pomodoro-controls\s*\{[^}]*gap:/)
    expect(tier![0]).toMatch(/\.pomodoro-btn\s*\{[^}]*width:/)
  })

  it('hasta 170 px hay un tier más justo para el mínimo de 140 px', () => {
    const tier = css.match(/@container \(max-width: 170px\)\s*\{[\s\S]*?\n\}/)
    expect(tier).not.toBeNull()
    expect(tier![0]).toMatch(/\.pomodoro-countdown\s*\{[^}]*var\(--text-scale\)/)
    expect(tier![0]).toMatch(/\.pomodoro-btn\s*\{[^}]*width:/)
  })

  it('hasta 130 px el disco respira en el mínimo de 80 px', () => {
    const tier = css.match(/@container \(max-width: 130px\)\s*\{[\s\S]*?\n\}/)
    expect(tier).not.toBeNull()
    expect(tier![0]).toMatch(/\.pomodoro-countdown\s*\{[^}]*var\(--text-scale\)/)
    expect(tier![0]).toMatch(/\.pomodoro-btn\s*\{[^}]*width:/)
    expect(tier![0]).toMatch(/\.pomodoro-controls\s*\{[^}]*gap:/)
  })
})
