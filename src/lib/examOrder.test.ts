import { describe, it, expect } from 'vitest'
import { compareExamsForList, isPastExam, sortExamsForList } from './examOrder'
import { formatYyyyMmDd } from './calendarDates'
import type { Exam } from '@/schemas/exams'

/** Fecha local (YYYY-MM-DD) a `days` días de hoy. */
function dateFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatYyyyMmDd(d)
}

function makeExam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: crypto.randomUUID(),
    title: 'Examen',
    date: dateFromToday(1),
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

describe('isPastExam', () => {
  const today = new Date(2026, 9, 20) // 20 de octubre de 2026

  it('un examen anterior a hoy ya pasó', () => {
    expect(isPastExam('2026-10-19', today)).toBe(true)
  })

  it('el examen de hoy todavía no pasó', () => {
    expect(isPastExam('2026-10-20', today)).toBe(false)
  })

  it('un examen futuro no pasó', () => {
    expect(isPastExam('2026-10-21', today)).toBe(false)
  })
})

describe('compareExamsForList', () => {
  const today = new Date(2026, 9, 20)

  it('los próximos van antes que los ya pasados', () => {
    const future = makeExam({ date: '2026-10-25' })
    const past = makeExam({ date: '2026-10-01' })
    expect(compareExamsForList(future, past, today)).toBeLessThan(0)
    expect(compareExamsForList(past, future, today)).toBeGreaterThan(0)
  })

  it('entre los próximos manda la fecha más cercana', () => {
    const near = makeExam({ date: '2026-10-21' })
    const far = makeExam({ date: '2026-11-30' })
    expect(compareExamsForList(near, far, today)).toBeLessThan(0)
  })

  it('entre los ya pasados manda el más reciente', () => {
    const recent = makeExam({ date: '2026-10-19' })
    const old = makeExam({ date: '2026-09-01' })
    expect(compareExamsForList(recent, old, today)).toBeLessThan(0)
  })

  it('el examen de hoy se considera próximo, no pasado', () => {
    const todayExam = makeExam({ date: '2026-10-20' })
    const future = makeExam({ date: '2026-11-01' })
    const past = makeExam({ date: '2026-10-18' })
    expect(compareExamsForList(todayExam, past, today)).toBeLessThan(0)
    expect(compareExamsForList(todayExam, future, today)).toBeLessThan(0)
  })

  it('a igual fecha desempata por creación', () => {
    const older = makeExam({ date: '2026-11-01', created_at: '2026-01-01T00:00:00.000Z' })
    const newer = makeExam({ date: '2026-11-01', created_at: '2026-02-01T00:00:00.000Z' })
    expect(compareExamsForList(older, newer, today)).toBeLessThan(0)
    expect(compareExamsForList(newer, older, today)).toBeGreaterThan(0)
  })
})

describe('sortExamsForList', () => {
  const today = new Date(2026, 9, 20)

  it('ordena próximos arriba y ya pasados abajo, con el más reciente primero', () => {
    const list = [
      makeExam({ title: 'Pasado viejo', date: '2026-09-01' }),
      makeExam({ title: 'Próximo lejano', date: '2026-12-01' }),
      makeExam({ title: 'Pasado reciente', date: '2026-10-19' }),
      makeExam({ title: 'Próximo cercano', date: '2026-10-22' }),
      makeExam({ title: 'Hoy', date: '2026-10-20' }),
    ]
    expect(sortExamsForList(list, today).map((e) => e.title)).toEqual([
      'Hoy',
      'Próximo cercano',
      'Próximo lejano',
      'Pasado reciente',
      'Pasado viejo',
    ])
  })

  it('no muta el array original', () => {
    const list = [makeExam({ date: '2026-09-01' }), makeExam({ date: '2026-11-01' })]
    const before = list.map((e) => e.title)
    sortExamsForList(list, today)
    expect(list.map((e) => e.title)).toEqual(before)
  })
})
