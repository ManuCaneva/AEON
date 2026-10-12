import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExamsStore } from './exams'
import { useWeeklyScheduleStore } from './weeklySchedule'
import { useCalendarStore } from './calendar'
import type { ScheduleBlockWithSlots } from '@/schemas/weeklySchedule'
import type { CalendarEvent } from '@/schemas/calendar'
import { eventKey } from '@/lib/examEventLink'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listExams: vi.fn().mockResolvedValue([]),
  createExam: vi.fn(),
  updateExam: vi.fn(),
  deleteExam: vi.fn().mockResolvedValue(undefined),
}))

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
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

describe('exams store - loadExams', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('mapea las filas al dominio', async () => {
    vi.mocked(db.listExams).mockResolvedValue([makeRow({ title: 'Parcial 1', date: '2026-07-01' })])
    const store = useExamsStore()
    await store.loadExams()
    expect(store.exams).toHaveLength(1)
    expect(store.exams[0].title).toBe('Parcial 1')
    expect(store.exams[0].status).toBe('pendiente')
  })

  it('expone la nota mapeada (nula y con decimales)', async () => {
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ status: 'rendido', grade: 8.5 }),
      makeRow({ status: 'pendiente', grade: null }),
    ])
    const store = useExamsStore()
    await store.loadExams()
    expect(store.exams.find((e) => e.status === 'rendido')?.grade).toBe(8.5)
    expect(store.exams.find((e) => e.status === 'pendiente')?.grade).toBeNull()
  })

  it('ordena por fecha ascendente: el más próximo primero', async () => {
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ date: '2026-09-01' }),
      makeRow({ date: '2026-07-01' }),
      makeRow({ date: '2026-08-01' }),
    ])
    const store = useExamsStore()
    await store.loadExams()
    expect(store.exams.map((e) => e.date)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
  })

  it('desempata por creación cuando comparten fecha', async () => {
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ date: '2026-07-01', created_at: '2026-02-01T00:00:00.000Z' }),
      makeRow({ date: '2026-07-01', created_at: '2026-01-01T00:00:00.000Z' }),
    ])
    const store = useExamsStore()
    await store.loadExams()
    expect(store.exams.map((e) => e.created_at)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ])
  })

  it('registra el error de carga sin lanzar', async () => {
    vi.mocked(db.listExams).mockRejectedValue(new Error('boom'))
    const store = useExamsStore()
    await store.loadExams()
    expect(store.lastError).toBe('boom')
    expect(store.loading).toBe(false)
  })
})

describe('exams store - createExam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('genera id y timestamps en el store, llama db.createExam y ordena', async () => {
    const store = useExamsStore()
    await store.loadExams()
    vi.mocked(db.listExams).mockResolvedValue([makeRow({ date: '2026-12-01' })])
    await store.loadExams()

    vi.mocked(db.createExam).mockResolvedValue(makeRow({ title: 'Nuevo', date: '2026-07-01' }))
    const exam = await store.createExam({ title: 'Nuevo', date: '2026-07-01' })

    expect(db.createExam).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.createExam).mock.calls[0]
    expect(callArgs[0]).toEqual({ title: 'Nuevo', date: '2026-07-01' })
    expect(typeof callArgs[1]).toBe('string')
    expect(typeof callArgs[2]).toBe('string')
    expect(typeof callArgs[3]).toBe('string')

    expect(store.exams.map((e) => e.id)).toContain(exam.id)
    expect(store.exams[0].title).toBe('Nuevo')
  })
})

describe('exams store - updateExam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('reemplaza el examen y reordena por la nueva fecha', async () => {
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: '11111111-1111-4111-8111-111111111111', date: '2026-12-01' }),
      makeRow({ id: '22222222-2222-4222-8222-222222222222', date: '2026-11-01' }),
    ])
    await store.loadExams()

    vi.mocked(db.updateExam).mockResolvedValue(
      makeRow({ id: '11111111-1111-4111-8111-111111111111', date: '2026-07-01' })
    )
    await store.updateExam('11111111-1111-4111-8111-111111111111', { date: '2026-07-01' })

    expect(db.updateExam).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      { date: '2026-07-01' },
      expect.any(String)
    )
    expect(store.exams.map((e) => e.date)).toEqual(['2026-07-01', '2026-11-01'])
  })
})

describe('exams store - deleteExam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('elimina el examen persistido y del estado', async () => {
    const store = useExamsStore()
    const id = '11111111-1111-4111-8111-111111111111'
    vi.mocked(db.listExams).mockResolvedValue([makeRow({ id })])
    await store.loadExams()

    await store.deleteExam(id)

    expect(db.deleteExam).toHaveBeenCalledWith(id)
    expect(store.exams).toHaveLength(0)
  })
})

describe('exams store - temas', () => {
  const examId = '11111111-1111-4111-8111-111111111111'
  const topicA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const topicB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  function topicsRow(topics: unknown) {
    return makeRow({ id: examId, topics: JSON.stringify(topics) })
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(db.listExams).mockResolvedValue([
      topicsRow([
        { id: topicA, title: 'Límites', completed: false },
        { id: topicB, title: 'Derivadas', completed: true },
      ]),
    ])
    vi.mocked(db.updateExam).mockImplementation(async (id, patch) =>
      makeRow({
        id,
        topics: patch.topics !== undefined ? JSON.stringify(patch.topics) : '[]',
      })
    )
  })

  it('toggleTopic invierte completed y persiste la lista', async () => {
    const store = useExamsStore()
    await store.loadExams()

    await store.toggleTopic(examId, topicA)

    expect(db.updateExam).toHaveBeenCalledTimes(1)
    expect(db.updateExam).toHaveBeenCalledWith(
      examId,
      {
        topics: [
          { id: topicA, title: 'Límites', completed: true },
          { id: topicB, title: 'Derivadas', completed: true },
        ],
      },
      expect.any(String)
    )
    expect(store.exams[0].topics[0].completed).toBe(true)
  })

  it('toggleTopic no cambia el estado del examen', async () => {
    const store = useExamsStore()
    await store.loadExams()
    await store.toggleTopic(examId, topicB)
    expect(store.exams[0].status).toBe('pendiente')
  })

  it('toggleTopic con un examen inexistente no persiste', async () => {
    const store = useExamsStore()
    await store.loadExams()
    await store.toggleTopic('99999999-9999-4999-8999-999999999999', topicA)
    expect(db.updateExam).not.toHaveBeenCalled()
  })

  it('addTopic agrega un tema sin completar con id generado', async () => {
    const store = useExamsStore()
    await store.loadExams()

    await store.addTopic(examId, 'Integrales')

    const patch = vi.mocked(db.updateExam).mock.calls[0][1] as { topics: unknown[] }
    expect(patch.topics).toHaveLength(3)
    const added = patch.topics[2] as { id: string; title: string; completed: boolean }
    expect(added.title).toBe('Integrales')
    expect(added.completed).toBe(false)
    expect(typeof added.id).toBe('string')
    expect(store.exams[0].topics).toHaveLength(3)
  })

  it('updateTopic cambia el título del tema', async () => {
    const store = useExamsStore()
    await store.loadExams()

    await store.updateTopic(examId, topicA, 'Sucesiones')

    expect(db.updateExam).toHaveBeenCalledWith(
      examId,
      {
        topics: [
          { id: topicA, title: 'Sucesiones', completed: false },
          { id: topicB, title: 'Derivadas', completed: true },
        ],
      },
      expect.any(String)
    )
    expect(store.exams[0].topics[0].title).toBe('Sucesiones')
  })

  it('removeTopic quita el tema de la lista', async () => {
    const store = useExamsStore()
    await store.loadExams()

    await store.removeTopic(examId, topicA)

    expect(db.updateExam).toHaveBeenCalledWith(
      examId,
      { topics: [{ id: topicB, title: 'Derivadas', completed: true }] },
      expect.any(String)
    )
    expect(store.exams[0].topics).toHaveLength(1)
  })

  it('reemplaza el array de temas (inmutabilidad)', async () => {
    const store = useExamsStore()
    await store.loadExams()
    const before = store.exams[0].topics
    await store.toggleTopic(examId, topicA)
    expect(store.exams[0].topics).not.toBe(before)
  })
})

describe('exams store - color vivo del bloque', () => {
  const blockId = '11111111-1111-4111-8111-111111111111'
  const examId = '22222222-2222-4222-8222-222222222222'

  function makeBlock(overrides: Partial<ScheduleBlockWithSlots> = {}): ScheduleBlockWithSlots {
    return {
      id: blockId,
      title: 'Física',
      color: 'green',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      slots: [],
      ...overrides,
    }
  }

  function setBlocks(blocks: ScheduleBlockWithSlots[]) {
    useWeeklyScheduleStore().blocksWithSlots = blocks
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sin bloque asociado usa el color de respaldo del examen', async () => {
    setBlocks([])
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, block_id: null, fallback_color: 'pink' }),
    ])
    await store.loadExams()

    expect(store.colorFor(store.exams[0])).toBe('pink')
    expect(store.blockFor(store.exams[0])).toBeUndefined()
  })

  it('con bloque existente deriva en vivo el color del bloque', async () => {
    setBlocks([makeBlock()])
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, block_id: blockId, fallback_color: 'lavender' }),
    ])
    await store.loadExams()

    expect(store.colorFor(store.exams[0])).toBe('green')
    expect(store.blockFor(store.exams[0])?.title).toBe('Física')
  })

  it('si el bloque ya no existe degrada en silencio al color de respaldo', async () => {
    setBlocks([])
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, block_id: blockId, fallback_color: 'cyan' }),
    ])
    await store.loadExams()

    expect(store.colorFor(store.exams[0])).toBe('cyan')
    expect(store.blockFor(store.exams[0])).toBeUndefined()
  })

  it('no escribe el color derivado en el examen (sólo lo resuelve)', async () => {
    setBlocks([makeBlock({ color: 'orange' })])
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, block_id: blockId, fallback_color: 'lavender' }),
    ])
    await store.loadExams()

    store.colorFor(store.exams[0])
    expect(store.exams[0].fallback_color).toBe('lavender')
    expect(store.exams[0].block_id).toBe(blockId)
  })
})

describe('exams store - overlay del calendario anual', () => {
  const blockId = '11111111-1111-4111-8111-111111111111'
  const examId = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('mapea cada examen a un punto por fecha con id exam_ y su color resuelto', async () => {
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, date: '2026-07-01', fallback_color: 'pink' }),
    ])
    await store.loadExams()

    const dots = store.overlayByDate.get('2026-07-01')
    expect(dots).toHaveLength(1)
    expect(dots![0].id).toBe(`exam_${examId}`)
    // El color viaja como variable CSS del token, sin hex.
    expect(dots![0].color).toBe('rgb(var(--color-block-pink))')
  })

  it('usa el color vivo del bloque cuando el examen está asociado', async () => {
    const store = useExamsStore()
    useWeeklyScheduleStore().blocksWithSlots = [
      {
        id: blockId,
        title: 'Física',
        color: 'green',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        slots: [],
      },
    ]
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, date: '2026-07-01', block_id: blockId, fallback_color: 'lavender' }),
    ])
    await store.loadExams()

    expect(store.overlayByDate.get('2026-07-01')![0].color).toBe('rgb(var(--color-block-green))')
  })

  it('agrupa varios exámenes de la misma fecha con ids únicos (nunca local_)', async () => {
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-07-01' }),
      makeRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date: '2026-07-01' }),
    ])
    await store.loadExams()

    const dots = store.overlayByDate.get('2026-07-01')!
    expect(dots).toHaveLength(2)
    expect(dots.map((d) => d.id)).toEqual([
      'exam_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'exam_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ])
    for (const dot of dots) expect(dot.id.startsWith('local_')).toBe(false)
  })

  it('sin exámenes el overlay queda vacío', () => {
    const store = useExamsStore()
    expect(store.overlayByDate.size).toBe(0)
  })
})

describe('exams store - reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('vacía los exámenes y el error (Borrar datos)', async () => {
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([makeRow()])
    await store.loadExams()
    store.reset()
    expect(store.exams).toEqual([])
    expect(store.lastError).toBeNull()
  })
})

describe('exams store - vínculo al evento (dedup)', () => {
  const examId = '22222222-2222-4222-8222-222222222222'

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

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('expone la clave del evento cuando el vínculo resuelve el mismo día', async () => {
    useCalendarStore().events = [makeEvent()]
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, date: '2026-07-01', calendar_id: 'local', event_id: 'evt-1' }),
    ])
    await store.loadExams()

    expect([...store.linkedEventKeys]).toEqual([eventKey('local', 'evt-1')])
  })

  it('un vínculo huérfano no aporta claves y el examen sigue pintando su punto', async () => {
    useCalendarStore().events = []
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, date: '2026-07-01', calendar_id: 'local', event_id: 'evt-ausente' }),
    ])
    await store.loadExams()

    expect(store.linkedEventKeys.size).toBe(0)
    expect(store.overlayByDate.get('2026-07-01')).toHaveLength(1)
  })

  it('un examen sin vínculo no aporta claves y sigue pintando su punto', async () => {
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([makeRow({ id: examId, date: '2026-07-01' })])
    await store.loadExams()

    expect(store.linkedEventKeys.size).toBe(0)
    expect(store.overlayByDate.get('2026-07-01')).toHaveLength(1)
  })

  it('el vínculo no mueve la fecha del examen', async () => {
    useCalendarStore().events = [makeEvent({ date: '2026-07-01' })]
    const store = useExamsStore()
    vi.mocked(db.listExams).mockResolvedValue([
      makeRow({ id: examId, date: '2026-07-01', calendar_id: 'local', event_id: 'evt-1' }),
    ])
    await store.loadExams()

    expect(store.exams[0].date).toBe('2026-07-01')
    expect(store.overlayByDate.get('2026-07-01')![0].id).toBe(`exam_${examId}`)
  })
})
