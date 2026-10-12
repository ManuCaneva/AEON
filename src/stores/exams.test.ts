import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExamsStore } from './exams'
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
