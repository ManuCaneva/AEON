import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * La tipografía dentro de los widgets queda fija según Configuración
 * (`--text-scale`) y no escala con el tamaño del widget: ninguna
 * declaración `font-size` bajo `.container-widget` puede usar
 * unidades de container query (`cqw`, `cqh`, `cqmin`, `cqmax`).
 *
 * Excepción: `.pomodoro-countdown` sí escala con el widget (con piso
 * según `--text-scale`) para que el círculo del Pomodoro crezca
 * proporcionalmente al agrandar el widget.
 */
describe('widget typography (tamaño fijo)', () => {
  it('ningún font-size de .container-widget usa unidades de container', () => {
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    const widgetBlocks = css.match(/\.container-widget[^{]*\{[^}]*\}/g) ?? []
    const fontSizeLines: string[] = []
    for (const block of widgetBlocks) {
      if (block.includes('.pomodoro-countdown')) continue
      const lines = block.match(/font-size:[^;]+;/g) ?? []
      fontSizeLines.push(...lines)
    }
    expect(fontSizeLines.length).toBeGreaterThan(0)
    for (const line of fontSizeLines) {
      expect(line).not.toMatch(/cqw|cqh|cqmin|cqmax/)
    }
  })

  it('los tamaños base respetan la escala de Configuración (títulos -20%)', () => {
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    for (const rule of [
      /\.container-widget \.text-card-title\s*\{[^}]*calc\(1rem \* var\(--text-scale\)\)/,
      /\.container-widget \.schedule-widget-header \.text-card-title\s*\{[^}]*calc\(1rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-subhead\s*\{[^}]*calc\(1\.125rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-body-lg\s*\{[^}]*calc\(1rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-body\s*\{[^}]*calc\(0\.9rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-body-sm\s*\{[^}]*calc\(0\.8rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-caption\s*\{[^}]*calc\(0\.675rem \* var\(--text-scale\)\)/,
    ]) {
      expect(css).toMatch(rule)
    }
  })

  it('el título fijo de widget no desborda en widgets chicos (ellipsis)', () => {
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    const match = css.match(/\.container-widget \.text-card-title\s*\{[^}]*\}/)
    expect(match).not.toBeNull()
    const rule = match![0]
    expect(rule).toMatch(/overflow:\s*hidden/)
    expect(rule).toMatch(/text-overflow:\s*ellipsis/)
    expect(rule).toMatch(/white-space:\s*nowrap/)
  })
})
