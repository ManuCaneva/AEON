import { describe, expect, it } from 'vitest'
import {
  ExamSchema,
  ExamStatusSchema,
  CreateExamDraftSchema,
  UpdateExamDraftSchema,
  ExamRowSchema,
  rowToExam,
  examToRow,
} from './exams'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-06-27T10:00:00.000Z'
const validDate = '2026-07-01'

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
    fallback_color: 'lavender' as const,
    sort_order: 0,
    created_at: validIso,
    updated_at: validIso,
  }

  it('acepta un examen válido', () => {
    expect(ExamSchema.parse(validExam)).toEqual(validExam)
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
})

describe('UpdateExamDraftSchema', () => {
  it('acepta todo opcional', () => {
    expect(UpdateExamDraftSchema.parse({})).toEqual({})
    expect(UpdateExamDraftSchema.parse({ title: 'Nuevo' })).toMatchObject({ title: 'Nuevo' })
    expect(UpdateExamDraftSchema.parse({ date: validDate })).toMatchObject({ date: validDate })
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

  it('no expone columnas fuera del alcance de este ticket', () => {
    const exam = rowToExam(rawRow)
    expect(exam).not.toHaveProperty('topics')
    expect(exam).not.toHaveProperty('block_id')
    expect(exam).not.toHaveProperty('calendar_id')
    expect(exam).not.toHaveProperty('event_id')
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
})
