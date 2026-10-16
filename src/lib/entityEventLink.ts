import type { CalendarEvent } from '@/schemas/calendar'

// Resolución genérica del vínculo opcional entidad→evento, compartida por
// exámenes (#143) y tareas (#144). La identidad de un evento es el PAR
// (calendarId, id) y el vínculo sólo es válido si el evento cae el mismo día
// que la entidad (su fecha es la única fuente de verdad). Si el evento no
// existe o cambió de día, el vínculo degrada en silencio.

/** Par que identifica un evento: su id sólo es único por calendario. */
export interface EntityEventLink {
  calendarId: string
  eventId: string
}

/** Fuente mínima para resolver: la fecha de la entidad y su vínculo. */
export interface EventLinkedEntity {
  date: string
  event_link: EntityEventLink | null
}

/**
 * Elección de evento del formulario: cuatro opciones excluyentes.
 * `none` no crea ni vincula; `local` crea un evento local; `new` crea uno en
 * `calendarId`; `existing` vincula un evento del día ya existente.
 */
export type EventChoice =
  | { mode: 'none' }
  | { mode: 'local' }
  | { mode: 'new'; calendarId: string }
  | { mode: 'existing'; link: EntityEventLink }

/** Clave única de un evento: separa por NUL para no colisionar con los ids. */
export function eventKey(calendarId: string, eventId: string): string {
  return `${calendarId}\u0000${eventId}`
}

/** Evento resuelto del mismo día, o undefined si no existe / es de otro día. */
export function resolveEntityLink(
  entity: EventLinkedEntity,
  events: readonly CalendarEvent[]
): CalendarEvent | undefined {
  const link = entity.event_link
  if (!link) return undefined
  const found = events.find((e) => e.calendarId === link.calendarId && e.id === link.eventId)
  if (!found || found.date !== entity.date) return undefined
  return found
}

/** Claves de los vínculos que resuelven a un evento del mismo día. */
export function resolvedEntityLinkKeys(
  entities: readonly EventLinkedEntity[],
  events: readonly CalendarEvent[]
): Set<string> {
  const keys = new Set<string>()
  for (const entity of entities) {
    const found = resolveEntityLink(entity, events)
    if (found) keys.add(eventKey(found.calendarId, found.id))
  }
  return keys
}
