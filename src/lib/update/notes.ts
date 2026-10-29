// =============================================================
// src/lib/update/notes.ts — Notas de release: formato estructurado
//
// El resumen de novedades vive como markdown etiquetado:
//
//   Resumen opcional de la versión.
//
//   - **Nuevo** — Texto para quien usa AEON
//   - **Arreglado** — Texto para quien usa AEON
//
// La categoría es dato, no estilo: cada consumidor (app, landing,
// GitHub) la renderiza como quiere. La gramática es compartida por
// el script de CI (scripts/release-notes.mjs) y la app.
// =============================================================

/** Categorías válidas, en el orden en que se muestran. */
export const NOTE_CATEGORIES = ['nuevo', 'arreglado', 'mejorado'] as const

export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

export interface NoteItem {
  category: NoteCategory
  text: string
}

export interface ReleaseNotes {
  summary: string | null
  items: NoteItem[]
}

export type ValidationResult = { ok: true; notes: ReleaseNotes } | { ok: false; errors: string[] }

/** Límite de caracteres por bullet: una línea, ni más. */
const MAX_ITEM_LENGTH = 120

/** Límite del resumen: una sola frase. */
const MAX_SUMMARY_LENGTH = 200

/**
 * Vocabulario interno prohibido. Al usuario no le importa cómo se
 * implementó: le importa qué cambió para él. Se matchea por palabra
 * completa, sin distinguir mayúsculas.
 */
const FORBIDDEN_WORDS = [
  'refactor',
  'store',
  'tests?',
  'm[oó]dulo',
  'pipeline',
  'commits?',
  'ci',
  'pull request',
  'typescript',
  'rust',
  'vue',
  'pinia',
  'sqlite',
]

const FORBIDDEN_RE = new RegExp(`\\b(?:${FORBIDDEN_WORDS.join('|')})\\b`, 'i')

/** Viñeta etiquetada: `- **Nuevo** — texto` (con las variantes toleradas). */
const BULLET_RE = /^\s*[-*]\s+\*\*\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s*\*\*\s*(?:[—–-]+|:)\s*(.+?)\s*$/

/** Separador horizontal: todo lo que viene después es ruido (aviso estático). */
const SEPARATOR_RE = /^\s*---\s*$/

/** Heading markdown: no es ni resumen ni bullet. */
const HEADING_RE = /^\s*#{1,6}\s/

function isCategory(value: string): value is NoteCategory {
  return (NOTE_CATEGORIES as readonly string[]).includes(value.toLowerCase())
}

function normalizeCategory(value: string): NoteCategory {
  return value.toLowerCase() as NoteCategory
}

/**
 * Parsea el body de release (markdown etiquetado) a estructura.
 * Devuelve null si no hay ningún bullet etiquetado: sin novedades
 * legibles no hay nada que mostrar.
 */
export function parseNotes(body: string | null | undefined): ReleaseNotes | null {
  if (body == null) return null

  const lines = body.split(/\r?\n/)

  const end = lines.findIndex((line) => SEPARATOR_RE.test(line))
  const visible = end === -1 ? lines : lines.slice(0, end)

  const items: NoteItem[] = []
  let firstBullet = -1

  for (const [index, line] of visible.entries()) {
    const match = BULLET_RE.exec(line)
    if (!match) continue

    const [, rawCategory, text] = match
    if (!isCategory(rawCategory)) continue
    if (text.length === 0) continue

    if (firstBullet === -1) firstBullet = index
    items.push({ category: normalizeCategory(rawCategory), text })
  }

  if (items.length === 0) return null

  const summaryLines = visible
    .slice(0, firstBullet)
    .filter((line) => line.trim().length > 0 && !HEADING_RE.test(line))
    .map((line) => line.trim())

  return {
    summary: summaryLines.length > 0 ? summaryLines.join(' ') : null,
    items,
  }
}

/**
 * Renderiza las notas al markdown etiquetado. Los bullets salen en el
 * orden canónico (nuevo → arreglado → mejorado) y se mantiene el orden
 * original dentro de cada categoría.
 */
export function renderNotes(notes: ReleaseNotes): string {
  const bullets = NOTE_CATEGORIES.flatMap((category) =>
    notes.items
      .filter((item) => item.category === category)
      .map((item) => `- **${labelFor(category)}** — ${item.text}`)
  )

  if (notes.summary == null) return bullets.join('\n')
  return `${notes.summary}\n\n${bullets.join('\n')}`
}

function labelFor(category: NoteCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Valida las notas estructuradas que devuelve la IA (o cualquier
 * fuente externa) antes de escribirlas al CHANGELOG. Acepta claves de
 * categoría en cualquier mayúscula y devuelve la forma normalizada.
 */
export function validateNotes(input: unknown): ValidationResult {
  const errors: string[] = []

  if (typeof input !== 'object' || input == null || Array.isArray(input)) {
    return { ok: false, errors: ['Las notas deben ser un objeto con summary y items.'] }
  }

  const record = input as Record<string, unknown>
  const rawSummary = record.summary
  let summary: string | null = null

  if (rawSummary != null) {
    if (typeof rawSummary !== 'string') {
      errors.push('El resumen debe ser texto.')
    } else if (rawSummary.includes('\n')) {
      errors.push('El resumen debe ser una sola línea.')
    } else if (rawSummary.length > MAX_SUMMARY_LENGTH) {
      errors.push(`El resumen no puede superar ${MAX_SUMMARY_LENGTH} caracteres.`)
    } else {
      summary = rawSummary.trim() === '' ? null : rawSummary.trim()
    }
  }

  const rawItems = record.items
  const items: NoteItem[] = []

  if (!Array.isArray(rawItems)) {
    errors.push('Los items deben ser una lista.')
  } else if (rawItems.length === 0) {
    errors.push('Debe haber al menos un item.')
  } else if (rawItems.length > 5) {
    errors.push('No puede haber más de 5 items.')
  } else {
    for (const [index, raw] of rawItems.entries()) {
      const where = `Item ${index + 1}`

      if (typeof raw !== 'object' || raw == null) {
        errors.push(`${where}: debe ser un objeto.`)
        continue
      }

      const item = raw as Record<string, unknown>

      if (typeof item.category !== 'string' || !isCategory(item.category)) {
        errors.push(`${where}: la categoría debe ser una de ${NOTE_CATEGORIES.join(', ')}.`)
      }

      if (typeof item.text !== 'string' || item.text.trim() === '') {
        errors.push(`${where}: el texto no puede estar vacío.`)
      } else if (item.text.includes('\n')) {
        errors.push(`${where}: el texto debe ser una sola línea.`)
      } else if (item.text.length > MAX_ITEM_LENGTH) {
        errors.push(`${where}: el texto no puede superar ${MAX_ITEM_LENGTH} caracteres.`)
      }

      if (errors.length > 0 && errors.some((e) => e.startsWith(where))) continue

      items.push({
        category: normalizeCategory(item.category as string),
        text: (item.text as string).trim(),
      })
    }
  }

  const allText = [summary ?? '', ...items.map((item) => item.text)].join(' ')
  if (FORBIDDEN_RE.test(allText)) {
    errors.push(
      'Hay vocabulario interno prohibido (refactor, test, store, módulo, CI…). Escribí el resultado para quien usa AEON.'
    )
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, notes: { summary, items } }
}
