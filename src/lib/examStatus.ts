// =============================================================
// lib/examStatus.ts — Estado y nota de un Examen (lógica de dominio).
//
// Funciones puras (lógica en TypeScript, no en Rust): traducen el estado
// a su etiqueta legible, eligen la variante de insignia y deciden cuándo
// la nota debe mostrarse. La nota sólo aparece cuando el examen está
// rendido y hay una nota cargada (spec T4/T5).
// =============================================================

import type { ExamStatus } from '@/schemas/exams'

/** Etiqueta legible del estado, tal como se muestra en la tarjeta. */
export function examStatusLabel(status: ExamStatus): string {
  switch (status) {
    case 'pendiente':
      return 'Pendiente'
    case 'estudiando':
      return 'Estudiando'
    case 'rendido':
      return 'Rendido'
  }
}

/** Variante de la insignia (`Badge`) según el estado. */
export type ExamStatusVariant = 'default' | 'primary' | 'success'

export function examStatusVariant(status: ExamStatus): ExamStatusVariant {
  switch (status) {
    case 'pendiente':
      return 'default'
    case 'estudiando':
      return 'primary'
    case 'rendido':
      return 'success'
  }
}

/** La nota se muestra sólo si el examen está rendido y hay nota cargada. */
export function shouldShowGrade(status: ExamStatus, grade: number | null): boolean {
  return status === 'rendido' && grade !== null
}

/** Formatea la nota sin ceros de más: 8 → "8", 8.5 → "8.5", 10 → "10". */
export function formatGrade(grade: number): string {
  return String(grade)
}
