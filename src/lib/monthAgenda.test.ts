import { describe, it, expect } from 'vitest'
import { buildMonthAgenda } from './monthAgenda'
import { eventKey } from './entityEventLink'
import type { Exam } from '@/schemas/exams'
import type { Task } from '@/schemas/tasks'
import type { CalendarEvent } from '@/schemas/calendar'

function exam(overrides: { id: string; date: string; title: string } & Partial<Exam>): Exam {
  return {
    status: 'pendiente',
    grade: null,
    block_id: null,
    fallback_color: 'lavender',
    event_link: null,
    topics: [],
    sort_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function task(overrides: { id: string; title: string } & Partial<Task>): Task {
  return {
    description: null,
    color: '#7986cb',
    status: 'todo',
    due_date: null,
    block_id: null,
    event_link: null,
    steps: [],
    sort_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    archived_at: null,
    ...overrides,
  }
}

function evt(overrides: { id: string; date: string; title: string } & Partial<CalendarEvent>) {
  return {
    color: '#33b679',
    calendarId: 'primary',
    start: `${overrides.date}T10:00:00`,
    end: `${overrides.date}T11:00:00`,
    ...overrides,
  }
}

const examColor = () => 'rgb(var(--color-block-green))'
const taskColor = () => '#7986cb'

function build(input: {
  exams?: Exam[]
  tasks?: Task[]
  events?: CalendarEvent[]
  representedEventKeys?: ReadonlySet<string>
}) {
  return buildMonthAgenda({
    exams: [],
    tasks: [],
    events: [],
    representedEventKeys: new Set(),
    examColor,
    taskColor,
    ...input,
  })
}

describe('buildMonthAgenda', () => {
  it('agrupa exámenes por su fecha con el color resuelto por el caller', () => {
    const e1 = exam({ id: 'a', date: '2025-01-05', title: 'Parcial' })
    const e2 = exam({ id: 'b', date: '2025-01-05', title: 'Oral' })
    const agenda = build({ exams: [e1, e2] })
    expect(agenda.get('2025-01-05')).toEqual([
      { id: 'exam_a', title: 'Parcial', color: 'rgb(var(--color-block-green))', kind: 'exam' },
      { id: 'exam_b', title: 'Oral', color: 'rgb(var(--color-block-green))', kind: 'exam' },
    ])
  })

  it('las tareas agendan por el día del evento vinculado; sin resolución, por vencimiento', () => {
    const linked = task({
      id: 't1',
      title: 'Entregar',
      due_date: '2025-01-20',
      event_link: { calendarId: 'primary', eventId: 'e1' },
    })
    const free = task({ id: 't2', title: 'Estudiar', due_date: '2025-01-20' })
    const agenda = build({
      tasks: [linked, free],
      events: [evt({ id: 'e1', date: '2025-01-10', title: 'Entrega' })],
      representedEventKeys: new Set([eventKey('primary', 'e1')]),
    })
    expect(agenda.get('2025-01-10')).toEqual([
      { id: 'task_t1', title: 'Entregar', color: '#7986cb', kind: 'task' },
    ])
    expect(agenda.get('2025-01-20')).toEqual([
      { id: 'task_t2', title: 'Estudiar', color: '#7986cb', kind: 'task' },
    ])
  })

  it('una tarea archivada sin completar no agendan, pero la hecha sí', () => {
    const discarded = task({
      id: 't1',
      title: 'Vieja',
      due_date: '2025-01-10',
      archived_at: '2025-01-02T00:00:00.000Z',
      status: 'todo',
    })
    const done = task({
      id: 't2',
      title: 'Hecha',
      due_date: '2025-01-10',
      archived_at: '2025-01-02T00:00:00.000Z',
      status: 'done',
    })
    const agenda = build({ tasks: [discarded, done] })
    expect(agenda.get('2025-01-10')).toEqual([
      { id: 'task_t2', title: 'Hecha', color: '#7986cb', kind: 'task' },
    ])
  })

  it('los eventos representados por una entidad no se duplican', () => {
    const linked = task({
      id: 't1',
      title: 'TP',
      due_date: '2025-01-10',
      event_link: { calendarId: 'primary', eventId: 'e1' },
    })
    const agenda = build({
      tasks: [linked],
      events: [
        evt({ id: 'e1', date: '2025-01-10', title: 'TP (evento)' }),
        evt({ id: 'e2', date: '2025-01-10', title: 'Cena' }),
      ],
      representedEventKeys: new Set([eventKey('primary', 'e1')]),
    })
    const items = agenda.get('2025-01-10') ?? []
    expect(items.map((i) => i.title)).toEqual(['TP', 'Cena'])
    expect(items[1]).toEqual({ id: 'evt_e2', title: 'Cena', color: '#33b679', kind: 'event' })
  })

  it('dentro de un día el orden es exámenes, tareas, eventos', () => {
    const agenda = build({
      exams: [exam({ id: 'a', date: '2025-01-10', title: 'Parcial' })],
      tasks: [task({ id: 't', title: 'Resumen', due_date: '2025-01-10' })],
      events: [evt({ id: 'e', date: '2025-01-10', title: 'Cena' })],
    })
    const kinds = (agenda.get('2025-01-10') ?? []).map((i) => i.kind)
    expect(kinds).toEqual(['exam', 'task', 'event'])
  })

  it('los días sin elementos no aparecen en el mapa', () => {
    const agenda = build({ exams: [exam({ id: 'a', date: '2025-01-05', title: 'Parcial' })] })
    expect(agenda.has('2025-01-06')).toBe(false)
    expect(agenda.size).toBe(1)
  })

  it('los ids no colisionan entre tipos', () => {
    const agenda = build({
      exams: [exam({ id: 'x', date: '2025-01-10', title: 'Parcial' })],
      events: [evt({ id: 'x', date: '2025-01-10', title: 'Evento' })],
    })
    const ids = (agenda.get('2025-01-10') ?? []).map((i) => i.id)
    expect(ids).toEqual(['exam_x', 'evt_x'])
  })
})
