import { describe, it, expect } from 'vitest'
import { taskInAgenda, taskEvent, taskDay } from './taskAgenda'

// El predicado sólo mira `archived_at` y `status`; el resto de la tarea no
// participa de la decisión.
function task(overrides: { archived_at: string | null; status: string }) {
  return overrides
}

describe('taskInAgenda', () => {
  it('una tarea activa entra en la agenda', () => {
    expect(taskInAgenda(task({ archived_at: null, status: 'todo' }))).toBe(true)
    expect(taskInAgenda(task({ archived_at: null, status: 'doing' }))).toBe(true)
  })

  it('una tarea hecha entra aunque el store la haya archivado', () => {
    expect(taskInAgenda(task({ archived_at: '2026-01-02T00:00:00.000Z', status: 'done' }))).toBe(
      true
    )
  })

  it('una tarea archivada sin completar no entra', () => {
    expect(taskInAgenda(task({ archived_at: '2026-01-02T00:00:00.000Z', status: 'todo' }))).toBe(
      false
    )
    expect(taskInAgenda(task({ archived_at: '2026-01-02T00:00:00.000Z', status: 'doing' }))).toBe(
      false
    )
  })
})

// Sólo se miran `event_link` y `due_date`; el resto de la tarea no participa.
function linkedTask(overrides: {
  event_link: { calendarId: string; eventId: string } | null
  due_date?: string | null
}) {
  return { due_date: null, ...overrides }
}

const events = [
  { calendarId: 'primary', id: 'e1', date: '2026-03-10' },
  { calendarId: 'primary', id: 'e2', date: '2026-04-01' },
]

describe('taskEvent', () => {
  it('resuelve el evento vinculado por el par (calendarId, id)', () => {
    const task = linkedTask({ event_link: { calendarId: 'primary', eventId: 'e2' } })
    expect(taskEvent(task, events)).toEqual(events[1])
  })

  it('sin vínculo no hay evento', () => {
    expect(taskEvent(linkedTask({ event_link: null }), events)).toBeUndefined()
  })

  it('si el evento ya no existe, no se resuelve', () => {
    const task = linkedTask({ event_link: { calendarId: 'primary', eventId: 'borrado' } })
    expect(taskEvent(task, events)).toBeUndefined()
  })
})

describe('taskDay', () => {
  it('el día del evento vinculado manda sobre el vencimiento', () => {
    const task = linkedTask({
      event_link: { calendarId: 'primary', eventId: 'e1' },
      due_date: '2026-03-25',
    })
    expect(taskDay(task, events)).toBe('2026-03-10')
  })

  it('sin vínculo resuelto agenda por vencimiento', () => {
    const sinVinculo = linkedTask({ event_link: null, due_date: '2026-03-25' })
    const vinculoRoto = linkedTask({
      event_link: { calendarId: 'primary', eventId: 'borrado' },
      due_date: '2026-03-25',
    })
    expect(taskDay(sinVinculo, events)).toBe('2026-03-25')
    expect(taskDay(vinculoRoto, events)).toBe('2026-03-25')
  })

  it('sin vínculo ni vencimiento no entra en ninguna agenda', () => {
    expect(taskDay(linkedTask({ event_link: null }), events)).toBeNull()
  })
})
