import {
  resolveEntityLink,
  type EntityEventLink,
  type EventChoice,
  type EventLinkedEntity,
} from './entityEventLink'
import type { CalendarEvent } from '@/schemas/calendar'

// Ciclo de vida compartido del vínculo entidad→evento (ADR 0010), antes
// duplicado entre el store de exámenes y el de tareas. La entidad es la fuente
// de verdad de su título y su fecha: primero se persiste la entidad y recién
// después se crea o actualiza el evento. El módulo es genérico y no conoce ni a
// Examen ni a Tarea; cada store lo conecta con un adaptador (fecha, título,
// vínculo y operaciones de persistencia).

/** Evento de entidad: siempre de todo el día (ADR 0010). */
export interface EntityEventDraft {
  title: string
  allDay: true
  start: string
  end: ''
}

/** Ventana mínima al calendario que usa el ciclo de vida. */
export interface EntityEventCalendarPort {
  readonly events: readonly CalendarEvent[]
  createEvent(calendarId: string, data: EntityEventDraft): Promise<CalendarEvent>
  updateEvent(calendarId: string, eventId: string, data: EntityEventDraft): Promise<unknown>
  deleteEvent(calendarId: string, eventId: string): Promise<unknown>
}

/**
 * Conecta una entidad concreta (examen o tarea) con el ciclo de vida común.
 * `draftDate` existe porque el campo de fecha se llama distinto en cada dominio
 * (`date` en exámenes, `due_date` en tareas).
 */
export interface EntityEventAdapter<
  TEntity extends { id: string; title: string },
  TCreateDraft extends { event_link?: EntityEventLink | null },
  TUpdateDraft extends { event_link?: EntityEventLink | null; title?: string },
> {
  /** Store de calendario. Perezoso: sólo se toca al operar sobre un evento. */
  calendar(): EntityEventCalendarPort
  /** Fecha local de la entidad, o '' si todavía no tiene. */
  date(entity: TEntity): string
  /** Fecha que trae un patch de edición, o undefined si no la cambia. */
  draftDate(patch: TUpdateDraft): string | undefined
  /** Vínculo actual de la entidad, o null. */
  link(entity: TEntity): EntityEventLink | null
  /** Busca la entidad en memoria (estado previo a la edición). */
  find(id: string): TEntity | undefined
  /** Persiste la entidad nueva (el vínculo ya viaja dentro del draft). */
  persistCreate(draft: TCreateDraft): Promise<TEntity>
  /** Persiste un patch de la entidad. */
  persistUpdate(id: string, patch: TUpdateDraft): Promise<TEntity>
  /** Persiste sólo el vínculo; `null` lo limpia. */
  persistLink(id: string, link: EntityEventLink | null): Promise<TEntity>
  /** Persiste el borrado de la entidad. */
  persistDelete(id: string): Promise<void>
  /** Mensaje cuando se intenta crear un evento sin fecha. */
  missingDateMessage: string
}

export interface EntityEventLifecycle<TEntity, TCreateDraft, TUpdateDraft> {
  /** Crea la entidad y, según la elección, su evento. */
  createWithEvent(
    draft: TCreateDraft,
    choice: EventChoice
  ): Promise<{ entity: TEntity; eventError: string | null }>
  /** Edita la entidad y sincroniza su evento. */
  updateWithEvent(
    id: string,
    patch: TUpdateDraft,
    choice: EventChoice
  ): Promise<{ entity: TEntity; eventError: string | null }>
  /** Borra la entidad y, si se pide, el evento de su vínculo vigente. */
  deleteWithEvent(id: string, deleteEvent: boolean): Promise<void>
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function createEntityEventLifecycle<
  TEntity extends { id: string; title: string },
  TCreateDraft extends { event_link?: EntityEventLink | null },
  TUpdateDraft extends { event_link?: EntityEventLink | null; title?: string },
>(
  adapter: EntityEventAdapter<TEntity, TCreateDraft, TUpdateDraft>
): EntityEventLifecycle<TEntity, TCreateDraft, TUpdateDraft> {
  /** Adapta la entidad a la forma mínima del resolutor de vínculos. */
  function linkedEntity(entity: TEntity): EventLinkedEntity {
    return { date: adapter.date(entity), event_link: adapter.link(entity) }
  }

  /** Crea el evento de la entidad (siempre de todo el día) y devuelve su vínculo. */
  async function createEventFor(entity: TEntity, choice: EventChoice): Promise<EntityEventLink> {
    const date = adapter.date(entity)
    if (!date) throw new Error(adapter.missingDateMessage)
    const calendarId = choice.mode === 'new' ? choice.calendarId : 'local'
    const created = await adapter.calendar().createEvent(calendarId, {
      title: entity.title,
      allDay: true,
      start: date,
      end: '',
    })
    return { calendarId: created.calendarId, eventId: created.id }
  }

  async function createWithEvent(
    draft: TCreateDraft,
    choice: EventChoice
  ): Promise<{ entity: TEntity; eventError: string | null }> {
    const link = choice.mode === 'existing' ? choice.link : null
    const entity = await adapter.persistCreate({ ...draft, event_link: link })
    if (choice.mode !== 'local' && choice.mode !== 'new') {
      return { entity, eventError: null }
    }
    try {
      const createdLink = await createEventFor(entity, choice)
      const linked = await adapter.persistLink(entity.id, createdLink)
      return { entity: linked, eventError: null }
    } catch (e) {
      return { entity, eventError: errorMessage(e) }
    }
  }

  async function updateWithEvent(
    id: string,
    patch: TUpdateDraft,
    choice: EventChoice
  ): Promise<{ entity: TEntity; eventError: string | null }> {
    const calendar = adapter.calendar()
    const previous = adapter.find(id)

    if (choice.mode === 'none') {
      const entity = await adapter.persistUpdate(id, { ...patch, event_link: null })
      return { entity, eventError: null }
    }

    if (choice.mode === 'existing') {
      const entity = await adapter.persistUpdate(id, { ...patch, event_link: choice.link })
      const previousLink = previous ? adapter.link(previous) : null
      const sameEvent =
        previousLink !== null &&
        previousLink.calendarId === choice.link.calendarId &&
        previousLink.eventId === choice.link.eventId
      const wasVigente =
        previous !== undefined &&
        previousLink !== null &&
        resolveEntityLink(linkedEntity(previous), calendar.events) !== undefined
      const titleChanged =
        previous !== undefined && patch.title !== undefined && patch.title !== previous.title
      const patchDate = adapter.draftDate(patch)
      const dateChanged =
        previous !== undefined && patchDate !== undefined && patchDate !== adapter.date(previous)
      if (wasVigente && sameEvent && (titleChanged || dateChanged)) {
        try {
          await calendar.updateEvent(choice.link.calendarId, choice.link.eventId, {
            title: entity.title,
            allDay: true,
            start: adapter.date(entity),
            end: '',
          })
        } catch (e) {
          return { entity, eventError: errorMessage(e) }
        }
      }
      return { entity, eventError: null }
    }

    // local | new: primero la entidad, después el evento.
    const entity = await adapter.persistUpdate(id, patch)
    try {
      const createdLink = await createEventFor(entity, choice)
      const linked = await adapter.persistLink(id, createdLink)
      return { entity: linked, eventError: null }
    } catch (e) {
      return { entity, eventError: errorMessage(e) }
    }
  }

  async function deleteWithEvent(id: string, deleteEvent: boolean): Promise<void> {
    if (deleteEvent) {
      const entity = adapter.find(id)
      if (entity && adapter.link(entity)) {
        const calendar = adapter.calendar()
        const resolved = resolveEntityLink(linkedEntity(entity), calendar.events)
        if (resolved) {
          await calendar.deleteEvent(resolved.calendarId, resolved.id)
        }
      }
    }
    await adapter.persistDelete(id)
  }

  return { createWithEvent, updateWithEvent, deleteWithEvent }
}
