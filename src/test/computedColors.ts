import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../tailwind.config'
import { applyTheme, DEFAULT_THEME, type ThemeDefinition } from '@/lib/themes'

const STYLE_ATTR = 'data-test-style'

/** Clase con la que se fuerza el estado hover en lugar de `:hover`. */
const FORCED_HOVER = 'force-hover'

/**
 * Compila con Tailwind solo las clases de un elemento: el CSS real de esas
 * clases, sin esperar al build completo de la app.
 */
async function utilitiesCss(classNames: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: classNames, extension: 'html' }] }),
  ]).process('@tailwind utilities;', { from: undefined })
  return result.css
}

/** Invierte el orden de emisión de las reglas: nada puede depender de ese orden. */
function reversedRules(css: string): string {
  const root = postcss.parse(css)
  root.nodes?.reverse()
  return root.toString()
}

/** `:hover` no se puede forzar en happy-dom: se reescribe a una clase. */
function forceHover(css: string): string {
  return css.replace(/:hover\b/g, `.${FORCED_HOVER}`)
}

function paint(css: string): void {
  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTR, '')
  style.textContent = css
  document.head.appendChild(style)
}

function clearPaint(): void {
  document.head.querySelectorAll(`[${STYLE_ATTR}]`).forEach((node) => node.remove())
}

/**
 * Color computado de un texto en reposo y en hover, con la paleta del tema
 * activo. El hover se fuerza sobre el ancestro `group` del elemento, como lo
 * activa el puntero en la app.
 */
export async function computedTextColors(
  title: Element,
  options: { theme?: ThemeDefinition; reversed?: boolean } = {}
): Promise<{ rest: string; hover: string }> {
  const theme = options.theme ?? DEFAULT_THEME
  applyTheme(theme)
  const group = title.closest('.group')
  if (!group) throw new Error('el texto no vive dentro de un grupo con hover')

  const css = await utilitiesCss(title.className)
  const sheet = options.reversed ? reversedRules(css) : css

  clearPaint()
  paint(sheet)
  const rest = getComputedStyle(title).color

  paint(forceHover(sheet))
  group.classList.add(FORCED_HOVER)
  const hover = getComputedStyle(title).color
  group.classList.remove(FORCED_HOVER)
  clearPaint()

  return { rest, hover }
}

/** Token de color como lo resuelve el CSS: `rgb(244 241 236 / 1)`. */
export function themeRgb(theme: ThemeDefinition, token: keyof ThemeDefinition['colors']): string {
  return `rgb(${theme.colors[token]} / 1)`
}
