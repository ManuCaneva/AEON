import { describe, it, expect } from 'vitest'
import type { CalendarEvent } from '@/schemas/calendar'
import { eventKey, omitLinkedEvents, resolveExamLink, resolvedLinkKeys } from './examEventLink'

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

describe('eventKey', () => {
  it('identifica un evento por el par (calendarId, id)', () => {
    expect(eventKey('local', 'evt-1')).toBe(eventKey('local', 'evt-1'))
  })

  it('distingue el mismo id en calendarios distintos', () => {
    expect(eventKey('local', 'evt-1')).not.toBe(eventKey('otro', 'evt-1'))
  })
})

describe('resolveExamLink', () => {
  it('sin vínculo no resuelve nada', () => {
    expect(resolveExamLink({ date: '2026-07-01', event_link: null }, [makeEvent()])).toBeUndefined()
  })

  it('resuelve el evento del mismo día', () => {
    const event = makeEvent()
    const found = resolveExamLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } },
      [event]
    )
    expect(found).toBe(event)
  })

  it('un vínculo huérfano (evento ausente) degrada a undefined', () => {
    const found = resolveExamLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-ausente' } },
      [makeEvent()]
    )
    expect(found).toBeUndefined()
  })

  it('si el evento es de otro día no resuelve (el vínculo no mueve la fecha)', () => {
    const found = resolveExamLink(
      { date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } },
      [makeEvent({ date: '2026-08-01' })]
    )
    expect(found).toBeUndefined()
  })
})

describe('resolvedLinkKeys', () => {
  it('sólo devuelve claves de vínculos resueltos del mismo día', () => {
    const events = [makeEvent(), makeEvent({ id: 'evt-2', date: '2026-08-01' })]
    const keys = resolvedLinkKeys(
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
})

describe('omitLinkedEvents', () => {
  it('omite el evento vinculado y conserva el resto del día', () => {
    const other = makeEvent({ id: 'evt-2' })
    const eventsByDate = new Map([
      ['2026-07-01', [makeEvent(), other]],
    ])
    const result = omitLinkedEvents(eventsByDate, new Set([eventKey('local', 'evt-1')]))
    expect(result.get('2026-07-01')).toEqual([other])
  })

  it('quita el día cuando su único evento estaba vinculado', () => {
    const eventsByDate = new Map([['2026-07-01', [makeEvent()]]])
    const result = omitLinkedEvents(eventsByDate, new Set([eventKey('local', 'evt-1')]))
    expect(result.has('2026-07-01')).toBe(false)
  })

  it('sin claves devuelve el mismo mapa (no copia innecesaria)', () => {
    const eventsByDate = new Map([['2026-07-01', [makeEvent()]]])
    expect(omitLinkedEvents(eventsByDate, new Set())).toBe(eventsByDate)
  })
})
