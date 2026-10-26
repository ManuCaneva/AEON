// =============================================================
// lib/examOrder.ts — Orden de la lista de Exámenes.
//
// Función pura de dominio (lógica en TypeScript, no en Rust): decide en qué
// orden se listan los exámenes. Los que ya pasaron se hunden: primero los
// próximos (el más cercano al día de hoy, arriba) y después los ya rendidos
// (el más reciente primero, pegado a los próximos). "Pasado" es una cuestión
// de fecha, no de estado: un examen con fecha anterior a hoy ya pasó, aunque
// su estado siga siendo "pendiente". El examen de hoy cuenta como próximo.
// =============================================================

import { daysUntil } from './examDays'
import type { Exam } from '@/schemas/exams'

/** ¿El examen ya pasó? Su fecha es anterior a la de hoy. */
export function isPastExam(date: string, today: Date = new Date()): boolean {
  return daysUntil(date, today) < 0
}

/**
 * Compara dos exámenes para el listado: los próximos van primero (fecha
 * ascendente) y los ya pasados al final (fecha descendente: el más reciente
 * primero). A igual fecha desempata por antigüedad de creación.
 */
export function compareExamsForList(a: Exam, b: Exam, today: Date = new Date()): number {
  const aPast = isPastExam(a.date, today)
  const bPast = isPastExam(b.date, today)
  if (aPast !== bPast) return aPast ? 1 : -1
  if (a.date !== b.date) {
    // En los próximos manda la fecha más cercana; en los pasados, la más reciente.
    if (aPast) return a.date < b.date ? 1 : -1
    return a.date < b.date ? -1 : 1
  }
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return 0
}

/** Lista de exámenes ordenada para mostrar: próximos arriba, ya pasados abajo. */
export function sortExamsForList(exams: readonly Exam[], today: Date = new Date()): Exam[] {
  return [...exams].sort((a, b) => compareExamsForList(a, b, today))
}
