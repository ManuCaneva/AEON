import type { ExamEventLink } from '@/schemas/exams'

// Compatibilidad: el vínculo examen→evento usa el helper genérico
// `entityEventLink` (compartido con las tareas, #144). Este módulo conserva
// los nombres previos para no romper a los consumidores ya mergeados.

export {
  eventKey,
  resolveEntityLink as resolveExamLink,
  resolvedEntityLinkKeys as resolvedLinkKeys,
} from './entityEventLink'
export type { EntityEventLink } from './entityEventLink'

/** Fuente mínima para resolver el vínculo de un examen. */
export interface LinkedExam {
  date: string
  event_link: ExamEventLink | null
}
