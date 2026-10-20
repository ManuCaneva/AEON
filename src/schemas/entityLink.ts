import { z } from 'zod'

// Vínculo opcional de una entidad (examen o tarea) a un evento del calendario.
// La identidad de un evento es el PAR (calendarId, eventId): los ids de Google
// sólo son únicos por calendario. Se comparte entre exámenes y tareas, junto
// con el mapper de columnas (ver ADR 0010).
export const EntityEventLinkSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
})
export type EntityEventLink = z.infer<typeof EntityEventLinkSchema>

/** Reconstruye el par (calendarId, eventId) sólo si ambas columnas existen. */
export function linkFromColumns(
  calendarId: string | null,
  eventId: string | null
): EntityEventLink | null {
  if (!calendarId || !eventId) return null
  return { calendarId, eventId }
}
