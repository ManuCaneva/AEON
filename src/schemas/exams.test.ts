import { describe, expect, it } from 'vitest'
import {
  ExamSchema,
  ExamStatusSchema,
  ExamTopicSchema,
  CreateExamDraftSchema,
  UpdateExamDraftSchema,
  ExamRowSchema,
  rowToExam,
  examToRow,
  pruneEmptyTopics,
} from './exams'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validUuid2 = '660e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-06-27T10:00:00.000Z'
const validDate = '2026-07-01'

describe('ExamTopicSchema', () => {
  it('acepta un tema válido y normaliza el título', () => {
    const parsed = ExamTopicSchema.parse({
      id: validUuid2,
      title: '  Derivadas  ',
      completed: false,
    })
    expect(parsed.title).toBe('Derivadas')
    expect(parsed.completed).toBe(false)
  })

  it('rechaza un título vacío', () => {
    expect(() =>
      ExamTopicSchema.parse({ id: validUuid2, title: '   ', completed: false })
    ).toThrow()
  })

  it('rechaza completed no booleano', () => {
    expect(() =>
      ExamTopicSchema.parse({ id: validUuid2, title: 'Tema', completed: 'sí' })
    ).toThrow()
  })

  it('rechaza un id que no es uuid', () => {
    expect(() => ExamTopicSchema.parse({ id: 'tema-1', title: 'Tema', completed: false })).toThrow()
  })
})

describe('pruneEmptyTopics', () => {
  it('descarta los temas sin título y conserva los que sí lo tienen', () => {
    const topics = [
      { id: validUuid, title: 'Límites', completed: false },
      { id: validUuid2, title: '   ', completed: false },
    ]
    expect(pruneEmptyTopics(topics)).toEqual([
      { id: validUuid, title: 'Límites', completed: false },
    ])
  })

  it('descarta el tema con título estrictamente vacío', () => {
    const topics = [{ id: validUuid, title: '', completed: true }]
    expect(pruneEmptyTopics(topics)).toEqual([])
  })

  it('si todos los temas están vacíos devuelve una lista vacía', () => {
    const topics = [
      { id: validUuid, title: '', completed: false },
      { id: validUuid2, title: '  ', completed: false },
    ]
    expect(pruneEmptyTopics(topics)).toEqual([])
  })

  it('sin temas devuelve una lista vacía', () => {
    expect(pruneEmptyTopics([])).toEqual([])
  })
})

describe('ExamStatusSchema', () => {
  it('acepta pendiente, estudiando y rendido', () => {
    expect(ExamStatusSchema.parse('pendiente')).toBe('pendiente')
    expect(ExamStatusSchema.parse('estudiando')).toBe('estudiando')
    expect(ExamStatusSchema.parse('rendido')).toBe('rendido')
  })

  it('rechaza estados desconocidos', () => {
    expect(() => ExamStatusSchema.parse('aprobado')).toThrow()
    expect(() => ExamStatusSchema.parse('')).toThrow()
  })
})

describe('ExamSchema', () => {
  const validExam = {
    id: validUuid,
    title: 'Parcial 1 de Análisis',
    date: validDate,
    status: 'pendiente' as const,
    grade: null,
    block_id: null,
    fallback_color: 'lavender' as const,
    event_link: null,
    topics: [],
    sort_order: 0,
    created_at: validIso,
    updated_at: validIso,
  }

  it('acepta un examen válido', () => {
    expect(ExamSchema.parse(validExam)).toEqual(validExam)
  })

  it('el bloque es opcional: por defecto queda sin asociar', () => {
    const { block_id: _omit, ...withoutBlock } = validExam
    expect(ExamSchema.parse(withoutBlock).block_id).toBeNull()
  })

  it('el vínculo a un evento es opcional: por defecto queda sin vínculo', () => {
    const { event_link: _omit, ...withoutLink } = validExam
    expect(ExamSchema.parse(withoutLink).event_link).toBeNull()
  })

  it('acepta un vínculo (calendarId, eventId) y rechaza uno incompleto', () => {
    expect(
      ExamSchema.parse({ ...validExam, event_link: { calendarId: 'local', eventId: 'evt-1' } })
        .event_link
    ).toEqual({ calendarId: 'local', eventId: 'evt-1' })
    expect(() => ExamSchema.parse({ ...validExam, event_link: { calendarId: 'local' } })).toThrow()
    expect(() =>
      ExamSchema.parse({ ...validExam, event_link: { calendarId: 'local', eventId: '' } })
    ).toThrow()
  })

  it('acepta un bloque asociado por uuid y rechaza uno inválido', () => {
    expect(ExamSchema.parse({ ...validExam, block_id: validUuid2 }).block_id).toBe(validUuid2)
    expect(() => ExamSchema.parse({ ...validExam, block_id: 'bloque-1' })).toThrow()
  })

  it('por defecto no tiene temas', () => {
    const { topics: _omit, ...withoutTopics } = validExam
    expect(ExamSchema.parse(withoutTopics).topics).toEqual([])
  })

  it('acepta temas embebidos', () => {
    const parsed = ExamSchema.parse({
      ...validExam,
      topics: [{ id: validUuid2, title: 'Límites', completed: true }],
    })
    expect(parsed.topics).toHaveLength(1)
    expect(parsed.topics[0].completed).toBe(true)
  })

  it('acepta una nota nula (sin nota) y notas con decimales de 0 a 10', () => {
    expect(ExamSchema.parse({ ...validExam, grade: null }).grade).toBeNull()
    expect(ExamSchema.parse({ ...validExam, grade: 0 }).grade).toBe(0)
    expect(ExamSchema.parse({ ...validExam, grade: 10 }).grade).toBe(10)
    expect(ExamSchema.parse({ ...validExam, grade: 8.5 }).grade).toBe(8.5)
  })

  it('rechaza una nota fuera del rango 0–10', () => {
    expect(() => ExamSchema.parse({ ...validExam, grade: -0.5 })).toThrow()
    expect(() => ExamSchema.parse({ ...validExam, grade: 10.5 })).toThrow()
    expect(() => ExamSchema.parse({ ...validExam, grade: 100 })).toThrow()
  })

  it('rechaza título vacío', () => {
    expect(() => ExamSchema.parse({ ...validExam, title: '' })).toThrow()
  })

  it('rechaza fecha inválida', () => {
    expect(() => ExamSchema.parse({ ...validExam, date: '2026-13-40' })).toThrow()
    expect(() => ExamSchema.parse({ ...validExam, date: '1 de julio' })).toThrow()
  })

  it('rechaza estado inválido', () => {
    expect(() => ExamSchema.parse({ ...validExam, status: 'aprobado' })).toThrow()
  })

  it('rechaza color de respaldo fuera de la paleta de tokens', () => {
    expect(() => ExamSchema.parse({ ...validExam, fallback_color: '#ff0000' })).toThrow()
    expect(() => ExamSchema.parse({ ...validExam, fallback_color: 'chartreuse' })).toThrow()
  })
})

describe('CreateExamDraftSchema', () => {
  it('acepta draft mínimo (title + date) con defaults de dominio', () => {
    const parsed = CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate })
    expect(parsed).toMatchObject({ title: 'Parcial', date: validDate })
    expect(parsed.status).toBe('pendiente')
    expect(parsed.fallback_color).toBe('lavender')
    expect(parsed.topics).toEqual([])
  })

  it('rechaza sin título', () => {
    expect(() => CreateExamDraftSchema.parse({ date: validDate })).toThrow()
  })

  it('rechaza sin fecha', () => {
    expect(() => CreateExamDraftSchema.parse({ title: 'Parcial' })).toThrow()
  })

  it('no lleva id ni timestamps', () => {
    const parsed = CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate })
    expect(parsed).not.toHaveProperty('id')
    expect(parsed).not.toHaveProperty('created_at')
    expect(parsed).not.toHaveProperty('updated_at')
  })

  it('acepta una nota opcional válida y rechaza una fuera de rango', () => {
    expect(
      CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate, grade: 9.5 }).grade
    ).toBe(9.5)
    expect(
      CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate, grade: null }).grade
    ).toBeNull()
    expect(() =>
      CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate, grade: 11 })
    ).toThrow()
    expect(() =>
      CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate, grade: -1 })
    ).toThrow()
  })

  it('el bloque es opcional: sin bloque queda en null y acepta un uuid', () => {
    expect(CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate }).block_id).toBeNull()
    expect(
      CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate, block_id: validUuid2 })
        .block_id
    ).toBe(validUuid2)
  })

  it('el vínculo es opcional: sin vínculo queda en null y acepta uno válido', () => {
    expect(CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate }).event_link).toBeNull()
    expect(
      CreateExamDraftSchema.parse({
        title: 'Parcial',
        date: validDate,
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }).event_link
    ).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })
})

describe('UpdateExamDraftSchema', () => {
  it('acepta todo opcional', () => {
    expect(UpdateExamDraftSchema.parse({})).toEqual({})
    expect(UpdateExamDraftSchema.parse({ title: 'Nuevo' })).toMatchObject({ title: 'Nuevo' })
    expect(UpdateExamDraftSchema.parse({ date: validDate })).toMatchObject({ date: validDate })
  })

  it('acepta el vínculo, incluido null para limpiarlo', () => {
    expect(
      UpdateExamDraftSchema.parse({ event_link: { calendarId: 'local', eventId: 'evt-1' } })
        .event_link
    ).toEqual({ calendarId: 'local', eventId: 'evt-1' })
    expect(UpdateExamDraftSchema.parse({ event_link: null }).event_link).toBeNull()
  })
})

describe('ExamRowSchema', () => {
  const rawRow = {
    id: validUuid,
    title: '  con espacios  ',
    date: validDate,
    status: 'pendiente',
    grade: null,
    block_id: null,
    fallback_color: 'lavender',
    calendar_id: null,
    event_id: null,
    topics: '[]',
    sort_order: 0,
    created_at: '2026-06-27 10:00:00',
    updated_at: '2026-06-27 10:00:00',
  }

  it('acepta una fila cruda permisiva (sin trimear, timestamps crudos, topics string)', () => {
    const parsed = ExamRowSchema.parse(rawRow)
    expect(parsed.title).toBe('  con espacios  ')
    expect(parsed.created_at).toBe('2026-06-27 10:00:00')
    expect(parsed.topics).toBe('[]')
  })

  it('acepta una nota numérica y un bloque asociado', () => {
    const parsed = ExamRowSchema.parse({ ...rawRow, grade: 8.5, block_id: validUuid })
    expect(parsed.grade).toBe(8.5)
    expect(parsed.block_id).toBe(validUuid)
  })

  it('acepta un vínculo persistido (calendar_id + event_id)', () => {
    const parsed = ExamRowSchema.parse({ ...rawRow, calendar_id: 'local', event_id: 'evt-1' })
    expect(parsed.calendar_id).toBe('local')
    expect(parsed.event_id).toBe('evt-1')
  })
})

describe('rowToExam', () => {
  const rawRow = {
    id: validUuid,
    title: 'Parcial 1 de Análisis',
    date: validDate,
    status: 'estudiando',
    grade: null,
    block_id: null,
    fallback_color: 'green',
    calendar_id: null,
    event_id: null,
    topics: '[]',
    sort_order: 0,
    created_at: '2026-06-27 10:00:00',
    updated_at: '2026-06-27 10:00:00',
  }

  it('mapea la fila al dominio y normaliza timestamps', () => {
    const exam = rowToExam(rawRow)
    expect(exam.status).toBe('estudiando')
    expect(exam.fallback_color).toBe('green')
    expect(exam.created_at).toBe('2026-06-27T10:00:00Z')
  })

  it('mapea la nota nula y una nota con decimales', () => {
    expect(rowToExam(rawRow).grade).toBeNull()
    expect(rowToExam({ ...rawRow, grade: 7.5 }).grade).toBe(7.5)
  })

  it('mapea el bloque asociado y su ausencia (null)', () => {
    expect(rowToExam(rawRow).block_id).toBeNull()
    expect(rowToExam({ ...rawRow, block_id: validUuid2 }).block_id).toBe(validUuid2)
  })

  it('reconstruye el vínculo (calendarId, eventId) desde las columnas', () => {
    const exam = rowToExam({ ...rawRow, calendar_id: 'local', event_id: 'evt-1' })
    expect(exam.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })

  it('sin ambas columnas del vínculo el par queda en null', () => {
    expect(rowToExam(rawRow).event_link).toBeNull()
    expect(rowToExam({ ...rawRow, calendar_id: 'local', event_id: null }).event_link).toBeNull()
    expect(rowToExam({ ...rawRow, calendar_id: null, event_id: 'evt-1' }).event_link).toBeNull()
  })

  it('no expone las columnas crudas del vínculo (solo el par event_link)', () => {
    const exam = rowToExam(rawRow)
    expect(exam).not.toHaveProperty('calendar_id')
    expect(exam).not.toHaveProperty('event_id')
  })

  it('parsea el JSON de temas y normaliza cada tema', () => {
    const exam = rowToExam({
      ...rawRow,
      topics: JSON.stringify([
        { id: validUuid2, title: '  Derivadas  ', completed: true },
        { id: validUuid, title: 'Integrales', completed: false },
      ]),
    })
    expect(exam.topics).toHaveLength(2)
    expect(exam.topics[0]).toEqual({ id: validUuid2, title: 'Derivadas', completed: true })
    expect(exam.topics[1].completed).toBe(false)
  })

  it('sin temas persistidos mapea una lista vacía', () => {
    expect(rowToExam(rawRow).topics).toEqual([])
  })

  it('lanza con JSON de temas inválido', () => {
    expect(() => rowToExam({ ...rawRow, topics: 'no-json' })).toThrow()
  })

  it('lanza con estructura de temas inválida', () => {
    expect(() =>
      rowToExam({
        ...rawRow,
        topics: JSON.stringify([{ id: validUuid2, title: '', completed: 'x' }]),
      })
    ).toThrow()
  })

  it('lanza con fecha inválida', () => {
    expect(() => rowToExam({ ...rawRow, date: '2026-13-40' })).toThrow()
  })

  it('lanza con estado inválido', () => {
    expect(() => rowToExam({ ...rawRow, status: 'aprobado' })).toThrow()
  })
})

describe('examToRow', () => {
  it('incluye solo los campos presentes (patch parcial no inventa estado)', () => {
    const row = examToRow({ title: 'Nuevo', date: validDate })
    expect(row.title).toBe('Nuevo')
    expect(row.date).toBe(validDate)
    expect(row.status).toBeUndefined()
    expect(row.fallback_color).toBeUndefined()
  })

  it('un draft de creación ya trae los defaults de dominio', () => {
    const draft = CreateExamDraftSchema.parse({ title: 'Parcial', date: validDate })
    const row = examToRow(draft)
    expect(row.status).toBe('pendiente')
    expect(row.fallback_color).toBe('lavender')
  })

  it('omite title y date ausentes', () => {
    const row = examToRow({ status: 'rendido' })
    expect(row.title).toBeUndefined()
    expect(row.date).toBeUndefined()
    expect(row.status).toBe('rendido')
  })

  it('incluye la nota cuando está presente, incluido null para limpiarla', () => {
    expect(examToRow({ grade: 8.5 }).grade).toBe(8.5)
    expect(examToRow({ grade: null }).grade).toBeNull()
  })

  it('omite la nota cuando el patch no la trae (no la toca)', () => {
    expect(examToRow({ title: 'Nuevo' }).grade).toBeUndefined()
  })

  it('incluye el bloque cuando está presente, incluido null para limpiarlo', () => {
    expect(examToRow({ block_id: validUuid2 }).block_id).toBe(validUuid2)
    expect(examToRow({ block_id: null }).block_id).toBeNull()
  })

  it('omite el bloque cuando el patch no lo trae (no lo toca)', () => {
    expect(examToRow({ title: 'Nuevo' }).block_id).toBeUndefined()
  })

  it('incluye el vínculo cuando está presente, incluido null para limpiarlo', () => {
    const linked = examToRow({ event_link: { calendarId: 'local', eventId: 'evt-1' } })
    expect(linked.calendar_id).toBe('local')
    expect(linked.event_id).toBe('evt-1')
    const cleared = examToRow({ event_link: null })
    expect(cleared.calendar_id).toBeNull()
    expect(cleared.event_id).toBeNull()
  })

  it('omite el vínculo cuando el patch no lo trae (no lo toca)', () => {
    const row = examToRow({ title: 'Nuevo' })
    expect(row.calendar_id).toBeUndefined()
    expect(row.event_id).toBeUndefined()
  })

  it('serializa los temas como JSON string', () => {
    const row = examToRow({
      topics: [{ id: validUuid2, title: 'Límites', completed: false }],
    })
    expect(row.topics).toBe(
      JSON.stringify([{ id: validUuid2, title: 'Límites', completed: false }])
    )
  })

  it('sin temas serializa una lista vacía', () => {
    expect(examToRow({ title: 'Nuevo' }).topics).toBe('[]')
  })

  it('roundtrip dominio↔fila preserva los temas', () => {
    const row = examToRow({
      title: 'Parcial',
      date: validDate,
      topics: [{ id: validUuid2, title: 'Límites', completed: true }],
    })
    const domain = rowToExam({
      id: validUuid,
      title: row.title!,
      date: row.date!,
      status: 'pendiente',
      grade: null,
      block_id: null,
      fallback_color: 'lavender',
      calendar_id: null,
      event_id: null,
      topics: row.topics,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
    })
    expect(domain.topics).toEqual([{ id: validUuid2, title: 'Límites', completed: true }])
  })

  it('roundtrip dominio↔fila preserva el vínculo al evento', () => {
    const row = examToRow({ event_link: { calendarId: 'local', eventId: 'evt-1' } })
    const domain = rowToExam({
      id: validUuid,
      title: 'Parcial',
      date: validDate,
      status: 'pendiente',
      grade: null,
      block_id: null,
      fallback_color: 'lavender',
      calendar_id: row.calendar_id!,
      event_id: row.event_id!,
      topics: '[]',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
    })
    expect(domain.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })
})
