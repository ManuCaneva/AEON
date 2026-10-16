import { describe, it, expect } from 'vitest'
import type { CalendarEvent } from '@/schemas/calendar'
import type { Task } from '@/schemas/tasks'
import {
  eventKey,
  resolveEntityLink,
  resolvedEntityLinkKeys,
  type EventLinkedEntity,
} from './entityEventLink'
import { eventKey as aliasedEventKey, resolveExamLink, resolvedLinkKeys } from './examEventLink'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    date: '2026-07-01',
    title: 'Consulta de Análisis',
    color: '#6e56cf',
    calendarId: 'local',
    start: '2026-07-01T10:00:00',
    end: '2026-07-01T11:00:00',
    ...overrides,
  }
}

/** Una tarea real (todos los campos del dominio) para probar la resolución. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Entregar informe',
    description: null,
    color: '#5e6ad2',
    status: 'todo',
    due_date: '2026-07-01',
    block_id: null,
    event_link: null,
    steps: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    archived_at: null,
    ...overrides,
  }
}

// La tarea guarda su fecha en `due_date`; el helper genérico la toma de `date`.
// El store adapta la tarea a esta forma al resolver su vínculo.
function linkedFromTask(task: Task): EventLinkedEntity {
  return { date: task.due_date ?? '', event_link: task.event_link }
}

describe('eventKey', () => {
  it('identifica un evento por el par (calendarId, id)', () => {
    expect(eventKey('local', 'evt-1')).toBe(eventKey('local', 'evt-1'))
  })

  it('distingue el mismo id en calendarios distintos', () => {
    expect(eventKey('local', 'evt-1')).not.toBe(eventKey('otro', 'evt-1'))
  })
})

describe('resolveEntityLink', () => {
  it('sin vínculo no resuelve nada', () => {
    expect(
      resolveEntityLink({ date: '2026-07-01', event_link: null }, [makeEvent()])
    ).toBeUndefined()
  })

  it('resuelve el evento del mismo día', () => {
    const event = makeEvent()
    const found = resolveEntityLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } },
      [event]
    )
    expect(found).toBe(event)
  })

  it('un vínculo huérfano (evento ausente) degrada a undefined', () => {
    const found = resolveEntityLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-ausente' } },
      [makeEvent()]
    )
    expect(found).toBeUndefined()
  })

  it('si el evento es de otro día no resuelve (el vínculo no mueve la fecha)', () => {
    const found = resolveEntityLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } },
      [makeEvent({ date: '2026-08-01' })]
    )
    expect(found).toBeUndefined()
  })

  it('resuelve igual una tarea con forma de entidad vinculada', () => {
    const event = makeEvent()
    const task = makeTask({ event_link: { calendarId: 'local', eventId: 'evt-1' } })
    expect(resolveEntityLink(linkedFromTask(task), [event])).toBe(event)
  })

  it('una tarea con vínculo de otro día degrada a undefined', () => {
    const task = makeTask({
      due_date: '2026-07-01',
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(
      resolveEntityLink(linkedFromTask(task), [makeEvent({ date: '2026-08-01' })])
    ).toBeUndefined()
  })

  it('una tarea con vínculo huérfano degrada a undefined', () => {
    const task = makeTask({
      due_date: '2026-07-01',
      event_link: { calendarId: 'local', eventId: 'evt-ausente' },
    })
    expect(resolveEntityLink(linkedFromTask(task), [makeEvent()])).toBeUndefined()
  })

  it('una tarea sin vínculo no resuelve nada', () => {
    expect(resolveEntityLink(linkedFromTask(makeTask()), [makeEvent()])).toBeUndefined()
  })
})

describe('resolvedEntityLinkKeys', () => {
  it('sólo devuelve claves de vínculos resueltos del mismo día', () => {
    const events = [makeEvent(), makeEvent({ id: 'evt-2', date: '2026-08-01' })]
    const keys = resolvedEntityLinkKeys(
      [
        { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } },
        { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-2' } },
        { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-ausente' } },
        { date: '2026-07-01', event_link: null },
      ],
      events
    )
    expect([...keys]).toEqual([eventKey('local', 'evt-1')])
  })

  it('mezcla entidades con forma de examen y de tarea para el dedup', () => {
    const events = [makeEvent()]
    const examLike: EventLinkedEntity = {
      date: '2026-07-01',
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    }
    const task = makeTask({ event_link: { calendarId: 'local', eventId: 'evt-1' } })
    const keys = resolvedEntityLinkKeys([examLike, linkedFromTask(task)], events)
    expect([...keys]).toEqual([eventKey('local', 'evt-1')])
  })
})

describe('examEventLink (compatibilidad)', () => {
  it('reexporta los mismos helpers genéricos', () => {
    expect(aliasedEventKey).toBe(eventKey)
    expect(resolveExamLink).toBe(resolveEntityLink)
    expect(resolvedLinkKeys).toBe(resolvedEntityLinkKeys)
  })
})
