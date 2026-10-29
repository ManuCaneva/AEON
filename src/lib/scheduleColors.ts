import { type BlockColorToken } from '@/schemas/weeklySchedule'

export function blockColorVar(c: BlockColorToken): string {
  return `--color-block-${c}`
}

export function blockColorRgb(c: BlockColorToken): string {
  return `rgb(var(--color-block-${c}))`
}

export function blockColorTint(c: BlockColorToken, alpha: number): string {
  return `rgb(var(--color-block-${c}) / ${alpha})`
}

/**
 * El mismo color con otra opacidad, sea cual sea su formato de origen:
 * `rgb(var(--color-block-x))` (paleta de bloques: exámenes y tareas con bloque)
 * o hex (colores de la API de Calendar, y tareas sin bloque). Si el formato no
 * se reconoce, devuelve el color tal cual.
 */
export function colorWithAlpha(css: string, alpha: number): string {
  const trimmed = css.trim()
  const varMatch = /^rgb\(var\((--[\w-]+)\)\)$/.exec(trimmed)
  if (varMatch) return `rgb(var(${varMatch[1]}) / ${alpha})`
  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c)
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return css
}
