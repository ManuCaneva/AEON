import { z } from 'zod'

// Vínculo opcional de una entidad (examen o tarea) a un evento del calendario.
// La identidad de un evento es el PAR (calendarId, eventId): los ids de Google
// sólo son únicos por calendario. Se comparte entre exámenes y tareas (#144);
// cada dominio conserva además su propio schema equivalente.
export const EntityEventLinkSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
})
export type EntityEventLink = z.infer<typeof EntityEventLinkSchema>
