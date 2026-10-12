import type { CalendarEvent } from '@/schemas/calendar'
import type { ExamEventLink } from '@/schemas/exams'

// Resolución del vínculo opcional examen→evento. La identidad de un evento es
// el PAR (calendarId, id) y el vínculo sólo es válido si el evento cae el
// mismo día que el examen (la fecha del examen es la única fuente de verdad).
// Si el evento no existe o cambió de día, el vínculo degrada en silencio.

/** Fuente mínima para resolver: la fecha del examen y su vínculo. */
export interface LinkedExam {
  date: string
  event_link: ExamEventLink | null
}

/** Clave única de un evento: separa por NUL para no colisionar con los ids. */
export function eventKey(calendarId: string, eventId: string): string {
  return `${calendarId}\u0000${eventId}`
}

/** Evento resuelto del mismo día, o undefined si no existe / es de otro día. */
export function resolveExamLink(
  exam: LinkedExam,
  events: readonly CalendarEvent[]
): CalendarEvent | undefined {
  const link = exam.event_link
  if (!link) return undefined
  const found = events.find((e) => e.calendarId === link.calendarId && e.id === link.eventId)
  if (!found || found.date !== exam.date) return undefined
  return found
}

/** Claves de los vínculos que resuelven a un evento del mismo día. */
export function resolvedLinkKeys(
  exams: readonly LinkedExam[],
  events: readonly CalendarEvent[]
): Set<string> {
  const keys = new Set<string>()
  for (const exam of exams) {
    const found = resolveExamLink(exam, events)
    if (found) keys.add(eventKey(found.calendarId, found.id))
  }
  return keys
}

/**
 * Dedupe: quita de `eventsByDate` los eventos vinculados a un examen, para que
 * ese día pinte un único punto (el del examen). Sin claves devuelve el mismo
 * mapa para no recalcular de más.
 */
export function omitLinkedEvents(
  eventsByDate: Map<string, CalendarEvent[]>,
  linkedKeys: ReadonlySet<string>
): Map<string, CalendarEvent[]> {
  if (linkedKeys.size === 0) return eventsByDate
  const out = new Map<string, CalendarEvent[]>()
  for (const [date, list] of eventsByDate) {
    const kept = list.filter((e) => !linkedKeys.has(eventKey(e.calendarId, e.id)))
    if (kept.length > 0) out.set(date, kept)
  }
  return out
}
