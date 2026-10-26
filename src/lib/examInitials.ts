// =============================================================
// lib/examInitials.ts — Iniciales de la materia (Bloque) de un Examen.
//
// Función pura de dominio (lógica en TypeScript, no en Rust): resume el
// nombre de un Bloque a un puñado de iniciales para la etiqueta de la
// tarjeta. Toma las palabras significativas (ignora conectores), normaliza
// acentos y la eñe, cuenta números y numerales romanos como palabra y
// recorta a un máximo para que nunca desborde la tarjeta.
// =============================================================

/** Largo máximo de la etiqueta de iniciales (spec T6). */
export const MAX_EXAM_INITIALS = 7

// Conectores que no aportan a las iniciales ("de", "la", "y", ...).
const CONNECTORS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'e',
  'o',
  'u',
  'a',
  'en',
  'con',
  'para',
  'por',
])

/** Quita los diacríticos (Á→A, É→E, Ñ→N, ...) descomponiendo y filtrando. */
function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Iniciales de un nombre de Bloque: la mayúscula inicial de cada palabra
 * significativa, sin conectores, normalizada y recortada a 7 caracteres.
 * Si el nombre es sólo conectores, usa la primera palabra para no quedar
 * vacío (un Bloque siempre tiene título); si el nombre está vacío, devuelve
 * cadena vacía.
 */
export function examInitials(name: string): string {
  const words = stripAccents(name.trim()).split(/\s+/).filter(Boolean)

  if (words.length === 0) return ''

  const significant = words.filter((word) => !CONNECTORS.has(word.toLowerCase()))
  const source = significant.length > 0 ? significant : [words[0]]

  return source
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, MAX_EXAM_INITIALS)
}
