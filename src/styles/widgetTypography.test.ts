import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * La tipografía dentro de los widgets queda fija según Configuración
 * (`--text-scale`) y no escala con el tamaño del widget: ninguna
 * declaración `font-size` bajo `.container-widget` puede usar
 * unidades de container query (`cqw`, `cqh`, `cqmin`, `cqmax`).
 */
describe('widget typography (tamaño fijo)', () => {
  it('ningún font-size de .container-widget usa unidades de container', () => {
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    const widgetBlocks = css.match(/\.container-widget[^{]*\{[^}]*\}/g) ?? []
    const fontSizeLines: string[] = []
    for (const block of widgetBlocks) {
      const lines = block.match(/font-size:[^;]+;/g) ?? []
      fontSizeLines.push(...lines)
    }
    expect(fontSizeLines.length).toBeGreaterThan(0)
    for (const line of fontSizeLines) {
      expect(line).not.toMatch(/cqw|cqh|cqmin|cqmax/)
    }
  })

  it('los tamaños base respetan la escala de Configuración', () => {
    const css = readFileSync('src/styles/tailwind.css', 'utf-8')
    for (const rule of [
      /\.container-widget \.text-card-title\s*\{[^}]*calc\(1\.375rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-body\s*\{[^}]*calc\(1rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-body-sm\s*\{[^}]*calc\(0\.875rem \* var\(--text-scale\)\)/,
      /\.container-widget \.text-caption\s*\{[^}]*calc\(0\.75rem \* var\(--text-scale\)\)/,
    ]) {
      expect(css).toMatch(rule)
    }
  })
})
