import type { EntityEventLink } from './entityEventLink'

/**
 * Una tarea entra en la agenda del día si sigue activa o ya está hecha (al
 * completarla el store la archiva). Una archivada sin completar fue descartada
 * por el usuario: no se muestra, y tampoco aporta su evento a la dedup.
 *
 * Tipo estructural mínimo: sólo miran `archived_at` y `status`.
 */
export function taskInAgenda(task: { archived_at?: string | null; status: string }): boolean {
  return task.archived_at === null || task.status === 'done'
}

/**
 * Evento vinculado a la tarea, buscado por el par (calendarId, id) sin mirar
 * el día: si el evento existe, su día manda sobre el vencimiento.
 */
export function taskEvent<E extends { calendarId: string; id: string }>(
  task: { event_link: EntityEventLink | null },
  events: readonly E[]
): E | undefined {
  const link = task.event_link
  if (!link) return undefined
  return events.find((e) => e.calendarId === link.calendarId && e.id === link.eventId)
}

/**
 * Día al que pertenece la tarea: el del evento si tiene vínculo resuelto; si
 * no, su vencimiento. Sin ninguno de los dos, no entra en ninguna agenda.
 */
export function taskDay(
  task: { event_link: EntityEventLink | null; due_date: string | null },
  events: readonly { calendarId: string; id: string; date: string }[]
): string | null {
  const event = taskEvent(task, events)
  return event ? event.date : task.due_date
}
