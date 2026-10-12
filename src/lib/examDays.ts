// =============================================================
// lib/examDays.ts — Etiqueta de días de un Examen.
//
// Función pura de dominio (lógica en TypeScript, no en Rust): traduce
// la distancia entre la fecha del examen (día local, YYYY-MM-DD) y hoy
// al vocabulario de la tarjeta: "hoy", "mañana", "faltan N días",
// "hace N días". Se calcula con fechas locales, sin corrimiento UTC.
// =============================================================

/** Días enteros entre hoy (día local) y `date` (YYYY-MM-DD, día local). */
export function daysUntil(date: string, today: Date = new Date()): number {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - base.getTime()) / 86_400_000)
}

/** Etiqueta de días de un examen relativa a `today` (por defecto, hoy). */
export function daysLabel(date: string, today: Date = new Date()): string {
  const days = daysUntil(date, today)
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days > 1) return `faltan ${days} días`
  const abs = Math.abs(days)
  return abs === 1 ? 'hace 1 día' : `hace ${abs} días`
}
