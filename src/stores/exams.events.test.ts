import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExamsStore } from './exams'
import type { Exam } from '@/schemas/exams'
import type { CalendarEvent } from '@/schemas/calendar'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listExams: vi.fn().mockResolvedValue([]),
  createExam: vi.fn(),
  updateExam: vi.fn(),
  deleteExam: vi.fn().mockResolvedValue(undefined),
}))

// El store de exámenes orquesta el calendario: se mockea entero para no tocar
// Tauri y poder observar create/update/deleteEvent.
const calendarMock = {
  events: [] as CalendarEvent[],
  connected: true,
  calendars: [{ id: 'primary', summary: 'Principal', primary: true }],
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => calendarMock,
}))

const examId = '22222222-2222-4222-8222-222222222222'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: examId,
    title: 'Parcial',
    date: '2026-07-01',
    status: 'pendiente',
    grade: null,
    block_id: null,
    fallback_color: 'lavender',
    calendar_id: null,
    event_id: null,
    topics: '[]',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeExam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: examId,
    title: 'Parcial',
    date: '2026-07-01',
    status: 'pendiente',
    grade: null,
    block_id: null,
    fallback_color: 'lavender',
    event_link: null,
    topics: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

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

function resetCalendarMock(): void {
  calendarMock.events = []
  calendarMock.connected = true
  calendarMock.createEvent.mockReset()
  calendarMock.updateEvent.mockReset()
  calendarMock.deleteEvent.mockReset()
  calendarMock.createEvent.mockImplementation(
    async (calendarId: string, data: { title: string; start: string }) => {
      const id = calendarId === 'local' ? 'local_1' : 'google_1'
      const created = makeEvent({
        id,
        calendarId,
        date: data.start,
        title: data.title,
        start: data.start,
        end: data.start,
      })
      calendarMock.events = [...calendarMock.events, created]
      return created
    }
  )
  calendarMock.updateEvent.mockResolvedValue(undefined)
  calendarMock.deleteEvent.mockResolvedValue(undefined)
}

describe('exams store - crear con evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('"none" persiste el examen sin vínculo y no toca el calendario', async () => {
    vi.mocked(db.createExam).mockResolvedValue(makeRow())
    const store = useExamsStore()

    const { exam, eventError } = await store.createExamWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'none' }
    )

    expect(calendarMock.createEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.createExam).mock.calls[0][0]).toMatchObject({ event_link: null })
    expect(exam.event_link).toBeNull()
    expect(eventError).toBeNull()
  })

  it('"existing" persiste el vínculo elegido sin crear ni actualizar el evento', async () => {
    vi.mocked(db.createExam).mockResolvedValue(makeRow({ calendar_id: 'local', event_id: 'evt-1' }))
    const store = useExamsStore()

    const { exam, eventError } = await store.createExamWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.createEvent).not.toHaveBeenCalled()
    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.createExam).mock.calls[0][0]).toMatchObject({
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(exam.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
    expect(eventError).toBeNull()
  })

  it('"local" crea un evento de todo el día en el calendario local y lo vincula', async () => {
    vi.mocked(db.createExam).mockResolvedValue(makeRow())
    vi.mocked(db.updateExam).mockResolvedValue(
      makeRow({ calendar_id: 'local', event_id: 'local_1' })
    )
    const store = useExamsStore()

    const { exam, eventError } = await store.createExamWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ title: 'Parcial', allDay: true, start: '2026-07-01' })
    )
    expect(vi.mocked(db.updateExam).mock.calls[0][1]).toEqual({
      event_link: { calendarId: 'local', eventId: 'local_1' },
    })
    expect(exam.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('"new" crea el evento en el calendario elegido', async () => {
    vi.mocked(db.createExam).mockResolvedValue(makeRow())
    vi.mocked(db.updateExam).mockResolvedValue(
      makeRow({ calendar_id: 'primary', event_id: 'google_1' })
    )
    const store = useExamsStore()

    const { exam } = await store.createExamWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'new', calendarId: 'primary' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'primary',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(exam.event_link).toEqual({ calendarId: 'primary', eventId: 'google_1' })
  })

  it('si crear el evento falla, el examen queda sin vínculo y devuelve el error', async () => {
    vi.mocked(db.createExam).mockResolvedValue(makeRow())
    calendarMock.createEvent.mockRejectedValue(new Error('boom'))
    const store = useExamsStore()

    const { exam, eventError } = await store.createExamWithEvent(
      { title: 'Parcial', date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
    expect(exam.event_link).toBeNull()
    expect(db.updateExam).not.toHaveBeenCalled()
    expect(store.exams[0].event_link).toBeNull()
  })
})

describe('exams store - editar con evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('"none" limpia el vínculo y deja el evento intacto', async () => {
    const store = useExamsStore()
    store.exams = [makeExam({ event_link: { calendarId: 'local', eventId: 'evt-1' } })]
    calendarMock.events = [makeEvent({ id: 'evt-1' })]
    vi.mocked(db.updateExam).mockResolvedValue(makeRow({ calendar_id: null, event_id: null }))

    await store.updateExamWithEvent(examId, { title: 'Nuevo' }, { mode: 'none' })

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.updateExam).mock.calls[0][1]).toMatchObject({ event_link: null })
    expect(store.exams[0].event_link).toBeNull()
  })

  it('con vínculo vigente y "existing", un cambio de título actualiza el evento', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({
        title: 'Viejo',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateExam).mockResolvedValue(
      makeRow({ title: 'Nuevo', calendar_id: 'local', event_id: 'evt-1' })
    )

    const { eventError } = await store.updateExamWithEvent(
      examId,
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).toHaveBeenCalledWith(
      'local',
      'evt-1',
      expect.objectContaining({ title: 'Nuevo', allDay: true, start: '2026-07-01' })
    )
    expect(eventError).toBeNull()
  })

  it('con vínculo vigente y "existing", un cambio de fecha mueve el evento', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({
        title: 'Parcial',
        date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateExam).mockResolvedValue(
      makeRow({ date: '2026-07-10', calendar_id: 'local', event_id: 'evt-1' })
    )

    await store.updateExamWithEvent(
      examId,
      { date: '2026-07-10' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).toHaveBeenCalledWith(
      'local',
      'evt-1',
      expect.objectContaining({ title: 'Parcial', allDay: true, start: '2026-07-10' })
    )
  })

  it('sin cambios de título ni fecha no actualiza el evento', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({
        title: 'Parcial',
        date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateExam).mockResolvedValue(makeRow({ calendar_id: 'local', event_id: 'evt-1' }))

    await store.updateExamWithEvent(
      examId,
      { status: 'estudiando' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('un vínculo de otro día degrada en silencio: no actualiza el evento', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({
        title: 'Viejo',
        date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-05' })]
    vi.mocked(db.updateExam).mockResolvedValue(makeRow({ title: 'Nuevo' }))

    await store.updateExamWithEvent(
      examId,
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('un vínculo huérfano degrada en silencio: no actualiza el evento', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({
        title: 'Viejo',
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
      }),
    ]
    calendarMock.events = []
    vi.mocked(db.updateExam).mockResolvedValue(makeRow({ title: 'Nuevo' }))

    await store.updateExamWithEvent(
      examId,
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-ausente' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('"local" crea el evento y lo vincula', async () => {
    const store = useExamsStore()
    store.exams = [makeExam({ title: 'Parcial', date: '2026-07-01' })]
    vi.mocked(db.updateExam)
      .mockResolvedValueOnce(makeRow({ title: 'Parcial', date: '2026-07-01' }))
      .mockResolvedValueOnce(makeRow({ calendar_id: 'local', event_id: 'local_1' }))

    const { exam, eventError } = await store.updateExamWithEvent(
      examId,
      { title: 'Parcial' },
      { mode: 'local' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(exam.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('si crear el evento falla al editar, devuelve el error sin romper', async () => {
    const store = useExamsStore()
    store.exams = [makeExam({ title: 'Parcial', date: '2026-07-01' })]
    calendarMock.createEvent.mockRejectedValue(new Error('boom'))
    vi.mocked(db.updateExam).mockResolvedValue(makeRow({ title: 'Parcial' }))

    const { eventError } = await store.updateExamWithEvent(
      examId,
      { title: 'Parcial' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
  })
})

describe('exams store - borrar examen y su evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('sin vínculo sólo borra el examen', async () => {
    const store = useExamsStore()
    store.exams = [makeExam()]

    await store.deleteExamWithEvent(examId, true)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteExam).toHaveBeenCalledWith(examId)
    expect(store.exams).toHaveLength(0)
  })

  it('con deleteEvent borra el evento en su calendario y luego el examen', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({ date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await store.deleteExamWithEvent(examId, true)

    expect(calendarMock.deleteEvent).toHaveBeenCalledWith('local', 'evt-1')
    expect(db.deleteExam).toHaveBeenCalledWith(examId)
    expect(store.exams).toHaveLength(0)
  })

  it('con deleteEvent pero vínculo huérfano sólo borra el examen', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({ date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-ausente' } }),
    ]
    calendarMock.events = []

    await store.deleteExamWithEvent(examId, true)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteExam).toHaveBeenCalledWith(examId)
  })

  it('sin deleteEvent no toca el evento aunque el vínculo sea vigente', async () => {
    const store = useExamsStore()
    store.exams = [
      makeExam({ date: '2026-07-01', event_link: { calendarId: 'local', eventId: 'evt-1' } }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await store.deleteExamWithEvent(examId, false)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteExam).toHaveBeenCalledWith(examId)
  })
})
