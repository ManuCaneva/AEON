import { describe, it, expect, vi } from 'vitest'
import {
  createEntityEventLifecycle,
  type EntityEventAdapter,
  type EntityEventCalendarPort,
} from './entityEventLifecycle'
import type { CalendarEvent } from '@/schemas/calendar'
import type { EntityEventLink } from './entityEventLink'

// Entidad y drafts mínimos: el ciclo de vida es genérico y no conoce ni a
// Examen ni a Tarea, así que probarlo con una entidad falsa ejercita la
// interfaz pública sin acoplarse a un dominio.
interface FakeEntity {
  id: string
  title: string
  date: string
  event_link: EntityEventLink | null
}
interface FakeCreateDraft {
  title: string
  date: string
  event_link?: EntityEventLink | null
}
type FakeUpdateDraft = Partial<FakeCreateDraft>

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    date: '2026-07-01',
    title: 'Consulta',
    color: '#6e56cf',
    calendarId: 'local',
    start: '2026-07-01',
    end: '2026-07-02',
    ...overrides,
  }
}

function build() {
  const state = { events: [] as CalendarEvent[] }
  const createEvent = vi.fn(
    async (calendarId: string, data: { title: string; start: string }): Promise<CalendarEvent> => {
      const created = makeEvent({
        id: calendarId === 'local' ? 'local_1' : 'google_1',
        calendarId,
        date: data.start,
        title: data.title,
        start: data.start,
        end: data.start,
      })
      state.events = [...state.events, created]
      return created
    }
  )
  const updateEvent = vi.fn(async (): Promise<void> => {})
  const deleteEvent = vi.fn(async (): Promise<void> => {})
  const calendar: EntityEventCalendarPort = {
    get events() {
      return state.events
    },
    createEvent,
    updateEvent,
    deleteEvent,
  }

  const entities: FakeEntity[] = []
  const adapter: EntityEventAdapter<FakeEntity, FakeCreateDraft, FakeUpdateDraft> = {
    calendar: () => calendar,
    date: (entity) => entity.date,
    draftDate: (patch) => patch.date,
    link: (entity) => entity.event_link,
    find: (id) => entities.find((e) => e.id === id),
    persistCreate: vi.fn(async (draft: FakeCreateDraft) => {
      const entity: FakeEntity = {
        id: 'entity-1',
        title: draft.title,
        date: draft.date,
        event_link: draft.event_link ?? null,
      }
      entities.push(entity)
      return entity
    }),
    // Igual que los stores reales: reemplazan la fila por un objeto nuevo, así
    // el estado previo capturado antes de persistir no se muta.
    persistUpdate: vi.fn(async (id: string, patch: FakeUpdateDraft) => {
      const index = entities.findIndex((e) => e.id === id)
      const current = entities[index]
      const next: FakeEntity = {
        ...current,
        ...patch,
        event_link: 'event_link' in patch ? (patch.event_link ?? null) : current.event_link,
      }
      entities[index] = next
      return next
    }),
    persistLink: vi.fn(async (id: string, link: EntityEventLink | null) => {
      const index = entities.findIndex((e) => e.id === id)
      const next: FakeEntity = { ...entities[index], event_link: link }
      entities[index] = next
      return next
    }),
    persistDelete: vi.fn(async (id: string) => {
      const index = entities.findIndex((e) => e.id === id)
      if (index >= 0) entities.splice(index, 1)
    }),
    missingDateMessage: 'La entidad necesita una fecha para crear su evento.',
  }

  const lifecycle = createEntityEventLifecycle(adapter)
  return { lifecycle, adapter, calendar, state, entities, createEvent, updateEvent, deleteEvent }
}

function seed(entities: FakeEntity[], overrides: Partial<FakeEntity> = {}): FakeEntity {
  const entity: FakeEntity = {
    id: 'entity-1',
    title: 'Parcial',
    date: '2026-07-01',
    event_link: null,
    ...overrides,
  }
  entities.push(entity)
  return entity
}

describe('createWithEvent', () => {
  it('mode none persiste la entidad sin vínculo y no toca el calendario', async () => {
    const { lifecycle, createEvent } = build()

    const { entity, eventError } = await lifecycle.createWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'none' }
    )

    expect(createEvent).not.toHaveBeenCalled()
    expect(entity.event_link).toBeNull()
    expect(eventError).toBeNull()
  })

  it('mode existing persiste el vínculo sin crear ni actualizar el evento', async () => {
    const { lifecycle, createEvent, updateEvent } = build()

    const { entity } = await lifecycle.createWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(createEvent).not.toHaveBeenCalled()
    expect(updateEvent).not.toHaveBeenCalled()
    expect(entity.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })

  it('mode local crea el evento de todo el día y lo vincula', async () => {
    const { lifecycle, createEvent, adapter } = build()

    const { entity, eventError } = await lifecycle.createWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ title: 'Parcial', allDay: true, start: '2026-07-01' })
    )
    expect(vi.mocked(adapter.persistLink)).toHaveBeenCalledWith('entity-1', {
      calendarId: 'local',
      eventId: 'local_1',
    })
    expect(entity.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('mode new crea el evento en el calendario elegido', async () => {
    const { lifecycle, createEvent } = build()

    const { entity } = await lifecycle.createWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'new', calendarId: 'primary' }
    )

    expect(createEvent).toHaveBeenCalledWith(
      'primary',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(entity.event_link).toEqual({ calendarId: 'primary', eventId: 'google_1' })
  })

  it('si crear el evento falla, la entidad queda sin vínculo y devuelve el error', async () => {
    const { lifecycle, adapter, createEvent } = build()
    createEvent.mockRejectedValueOnce(new Error('boom'))

    const { entity, eventError } = await lifecycle.createWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
    expect(entity.event_link).toBeNull()
    expect(adapter.persistLink).not.toHaveBeenCalled()
  })
})

describe('updateWithEvent', () => {
  it('mode none limpia el vínculo y deja el evento intacto', async () => {
    const { lifecycle, entities, updateEvent, deleteEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-1' } })

    const { entity } = await lifecycle.updateWithEvent(
      'entity-1',
      { title: 'Nuevo' },
      { mode: 'none' }
    )

    expect(entity.event_link).toBeNull()
    expect(updateEvent).not.toHaveBeenCalled()
    expect(deleteEvent).not.toHaveBeenCalled()
  })

  it('con vínculo vigente y existing, un cambio de título actualiza el evento', async () => {
    const { lifecycle, entities, state, updateEvent } = build()
    seed(entities, { title: 'Viejo', event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await lifecycle.updateWithEvent(
      'entity-1',
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(updateEvent).toHaveBeenCalledWith(
      'local',
      'evt-1',
      expect.objectContaining({ title: 'Nuevo', allDay: true, start: '2026-07-01' })
    )
  })

  it('con vínculo vigente y existing, un cambio de fecha mueve el evento', async () => {
    const { lifecycle, entities, state, updateEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await lifecycle.updateWithEvent(
      'entity-1',
      { date: '2026-07-10' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(updateEvent).toHaveBeenCalledWith(
      'local',
      'evt-1',
      expect.objectContaining({ start: '2026-07-10' })
    )
  })

  it('sin cambio de título ni fecha no actualiza el evento', async () => {
    const { lifecycle, entities, state, updateEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await lifecycle.updateWithEvent(
      'entity-1',
      {},
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('un vínculo de otro día degrada en silencio', async () => {
    const { lifecycle, entities, state, updateEvent } = build()
    seed(entities, { title: 'Viejo', event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-05' })]

    await lifecycle.updateWithEvent(
      'entity-1',
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('mode local crea el evento después de persistir la entidad y lo vincula', async () => {
    const { lifecycle, entities, createEvent } = build()
    seed(entities)

    const { entity, eventError } = await lifecycle.updateWithEvent(
      'entity-1',
      { title: 'Parcial' },
      { mode: 'local' }
    )

    expect(createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(entity.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('si crear el evento falla al editar, devuelve el error sin romper', async () => {
    const { lifecycle, entities, createEvent } = build()
    seed(entities)
    createEvent.mockRejectedValueOnce(new Error('boom'))

    const { eventError } = await lifecycle.updateWithEvent(
      'entity-1',
      { title: 'Parcial' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
  })
})

describe('deleteWithEvent', () => {
  it('sin vínculo sólo borra la entidad', async () => {
    const { lifecycle, entities, deleteEvent, adapter } = build()
    seed(entities)

    await lifecycle.deleteWithEvent('entity-1', true)

    expect(deleteEvent).not.toHaveBeenCalled()
    expect(adapter.persistDelete).toHaveBeenCalledWith('entity-1')
  })

  it('con deleteEvent borra el evento de su calendario y luego la entidad', async () => {
    const { lifecycle, entities, state, deleteEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await lifecycle.deleteWithEvent('entity-1', true)

    expect(deleteEvent).toHaveBeenCalledWith('local', 'evt-1')
  })

  it('un vínculo huérfano sólo borra la entidad', async () => {
    const { lifecycle, entities, deleteEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-ausente' } })

    await lifecycle.deleteWithEvent('entity-1', true)

    expect(deleteEvent).not.toHaveBeenCalled()
  })

  it('sin deleteEvent no toca el evento aunque el vínculo sea vigente', async () => {
    const { lifecycle, entities, state, deleteEvent } = build()
    seed(entities, { event_link: { calendarId: 'local', eventId: 'evt-1' } })
    state.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await lifecycle.deleteWithEvent('entity-1', false)

    expect(deleteEvent).not.toHaveBeenCalled()
  })
})
