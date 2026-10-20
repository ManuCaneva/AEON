import { describe, expect, it } from 'vitest'
import {
  TaskSchema,
  TaskStepSchema,
  TaskStatusSchema,
  CreateTaskDraftSchema,
  UpdateTaskDraftSchema,
  TaskRowSchema,
  rowToTask,
  taskToRow,
  pruneEmptySteps,
} from './tasks'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validUuid2 = '660e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-06-27T10:00:00.000Z'
const validDate = '2026-06-27'

describe('TaskStatusSchema', () => {
  it('acepta todo, doing, done', () => {
    expect(TaskStatusSchema.parse('todo')).toBe('todo')
    expect(TaskStatusSchema.parse('doing')).toBe('doing')
    expect(TaskStatusSchema.parse('done')).toBe('done')
  })

  it('rechaza status inválido', () => {
    expect(() => TaskStatusSchema.parse('cancelled')).toThrow()
    expect(() => TaskStatusSchema.parse('')).toThrow()
  })
})

describe('TaskStepSchema', () => {
  it('acepta un step válido', () => {
    expect(TaskStepSchema.parse({ id: validUuid, title: 'Paso 1', done: false })).toEqual({
      id: validUuid,
      title: 'Paso 1',
      done: false,
    })
  })

  it('rechaza title vacío', () => {
    expect(() => TaskStepSchema.parse({ id: validUuid, title: '', done: false })).toThrow()
  })

  it('rechaza done no-boolean', () => {
    expect(() => TaskStepSchema.parse({ id: validUuid, title: 'x', done: 'yes' })).toThrow()
  })

  it('rechaza id inválido', () => {
    expect(() => TaskStepSchema.parse({ id: 'not-uuid', title: 'x', done: false })).toThrow()
  })
})

describe('pruneEmptySteps', () => {
  it('descarta los pasos sin título y conserva los que sí lo tienen', () => {
    const steps = [
      { id: validUuid, title: 'Paso 1', done: false },
      { id: validUuid2, title: '   ', done: true },
    ]
    expect(pruneEmptySteps(steps)).toEqual([{ id: validUuid, title: 'Paso 1', done: false }])
  })

  it('descarta el paso con título estrictamente vacío', () => {
    const steps = [{ id: validUuid, title: '', done: false }]
    expect(pruneEmptySteps(steps)).toEqual([])
  })

  it('si todos los pasos están vacíos devuelve una lista vacía', () => {
    const steps = [
      { id: validUuid, title: '', done: false },
      { id: validUuid2, title: '  ', done: false },
    ]
    expect(pruneEmptySteps(steps)).toEqual([])
  })

  it('sin pasos devuelve una lista vacía', () => {
    expect(pruneEmptySteps([])).toEqual([])
  })
})

describe('TaskSchema', () => {
  const validTask = {
    id: validUuid,
    title: 'Comprar leche',
    description: null,
    color: '#ff5500',
    status: 'todo' as const,
    due_date: null,
    block_id: null,
    event_link: null,
    steps: [],
    sort_order: 0,
    created_at: validIso,
    updated_at: validIso,
    archived_at: null,
  }

  it('acepta una task válida sin due_date ni steps', () => {
    expect(TaskSchema.parse(validTask)).toEqual(validTask)
  })

  it('acepta una task con due_date y steps', () => {
    const task = {
      ...validTask,
      due_date: validDate,
      block_id: null,
      event_link: null,
      steps: [{ id: validUuid2, title: 'Ir al super', done: false }],
    }
    expect(TaskSchema.parse(task)).toEqual(task)
  })

  it('acepta status doing y done', () => {
    expect(TaskSchema.parse({ ...validTask, status: 'doing' })).toMatchObject({ status: 'doing' })
    expect(TaskSchema.parse({ ...validTask, status: 'done' })).toMatchObject({ status: 'done' })
  })

  it('rechaza status inválido', () => {
    expect(() => TaskSchema.parse({ ...validTask, status: 'cancelled' })).toThrow()
  })

  it('rechaza color mal formato', () => {
    expect(() => TaskSchema.parse({ ...validTask, color: 'red' })).toThrow()
    expect(() => TaskSchema.parse({ ...validTask, color: '#fff' })).toThrow()
  })

  it('rechaza due_date inválida', () => {
    expect(() => TaskSchema.parse({ ...validTask, due_date: '2026-13-40' })).toThrow()
  })

  it('rechaza title vacío', () => {
    expect(() => TaskSchema.parse({ ...validTask, title: '' })).toThrow()
  })

  it('rechaza steps con done no-boolean', () => {
    expect(() =>
      TaskSchema.parse({
        ...validTask,
        steps: [{ id: validUuid2, title: 'x', done: 1 }],
      })
    ).toThrow()
  })
})

describe('CreateTaskDraftSchema', () => {
  it('acepta draft mínimo (title + color)', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const parsed = CreateTaskDraftSchema.parse(draft)
    expect(parsed).toMatchObject({ title: 'Test', color: '#aabbcc' })
    expect(parsed.status).toBe('todo')
    expect(parsed.steps).toEqual([])
  })

  it('acepta draft completo', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      description: 'Desc',
      status: 'doing' as const,
      due_date: validDate,
      block_id: null,
      event_link: null,
      steps: [{ id: validUuid, title: 'S1', done: false }],
      sort_order: 5,
    }
    expect(CreateTaskDraftSchema.parse(draft)).toEqual(draft)
  })

  it('rechaza sin title', () => {
    expect(() => CreateTaskDraftSchema.parse({ color: '#aabbcc' })).toThrow()
  })

  it('rechaza sin color', () => {
    expect(() => CreateTaskDraftSchema.parse({ title: 'x' })).toThrow()
  })

  it('rechaza status inválido', () => {
    expect(() =>
      CreateTaskDraftSchema.parse({ title: 'x', color: '#aabbcc', status: 'bad' })
    ).toThrow()
  })

  it('no debe llevar id ni timestamps', () => {
    const parsed = CreateTaskDraftSchema.parse({ title: 'x', color: '#aabbcc' })
    expect(parsed).not.toHaveProperty('id')
    expect(parsed).not.toHaveProperty('created_at')
    expect(parsed).not.toHaveProperty('updated_at')
  })
})

describe('UpdateTaskDraftSchema', () => {
  it('acepta todo opcional', () => {
    expect(UpdateTaskDraftSchema.parse({})).toEqual({})
    expect(UpdateTaskDraftSchema.parse({ title: 'Nuevo' })).toMatchObject({ title: 'Nuevo' })
    expect(UpdateTaskDraftSchema.parse({ status: 'done' })).toMatchObject({ status: 'done' })
  })
})

describe('TaskRowSchema', () => {
  it('acepta row permissive (steps como string, timestamps crudos)', () => {
    const row = {
      id: validUuid,
      title: '  con espacios  ',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: '2026-06-27 10:00:00',
      updated_at: '2026-06-27 10:00:00',
      archived_at: null,
    }
    const parsed = TaskRowSchema.parse(row)
    expect(parsed.title).toBe('  con espacios  ')
    expect(parsed.steps).toBe('[]')
  })

  it('acepta steps con JSON válido', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: JSON.stringify([{ id: validUuid2, title: 'S1', done: false }]),
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(TaskRowSchema.parse(row).steps).toContain('S1')
  })
})

describe('rowToTask', () => {
  it('parsea steps JSON y normaliza timestamps', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: JSON.stringify([{ id: validUuid2, title: 'Paso 1', done: false }]),
      sort_order: 0,
      created_at: '2026-06-27 10:00:00',
      updated_at: '2026-06-27 10:00:00',
      archived_at: null,
    }
    const task = rowToTask(row)
    expect(task.steps).toHaveLength(1)
    expect(task.steps[0].title).toBe('Paso 1')
    expect(task.created_at).toBe('2026-06-27T10:00:00Z')
  })

  it('steps vacío → []', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(rowToTask(row).steps).toEqual([])
  })

  it('steps JSON inválido → throw', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: 'not-json',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(() => rowToTask(row)).toThrow()
  })

  it('steps con estructura inválida → throw', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: JSON.stringify([{ id: 'bad', title: 'x', done: false }]),
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(() => rowToTask(row)).toThrow()
  })

  it('due_date null se preserva', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(rowToTask(row).due_date).toBeNull()
  })

  it('due_date válida se preserva', () => {
    const row = {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: validDate,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
    }
    expect(rowToTask(row).due_date).toBe(validDate)
  })
})

describe('taskToRow', () => {
  it('serializa steps a JSON string', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const row = taskToRow(draft)
    expect(row.steps).toBe('[]')
  })

  it('serializa steps con contenido', () => {
    const draft = {
      title: 'Test',
      color: '#aabbcc',
      steps: [{ id: validUuid, title: 'S1', done: false }],
    }
    const row = taskToRow(draft)
    const parsed = JSON.parse(row.steps)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(validUuid)
  })

  it('description null por defecto', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const row = taskToRow(draft)
    expect(row.description).toBeNull()
  })

  it('description se preserva', () => {
    const draft = { title: 'Test', color: '#aabbcc', description: 'Desc' }
    const row = taskToRow(draft)
    expect(row.description).toBe('Desc')
  })

  it('sort_order default 0', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const row = taskToRow(draft)
    expect(row.sort_order).toBe(0)
  })

  it('due_date null por defecto', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const row = taskToRow(draft)
    expect(row.due_date).toBeNull()
  })

  it('status default todo', () => {
    const draft = { title: 'Test', color: '#aabbcc' }
    const row = taskToRow(draft)
    expect(row.status).toBe('todo')
  })
})

describe('TaskSchema - bloque y vínculo a evento', () => {
  const base = {
    id: validUuid,
    title: 'Comprar leche',
    description: null,
    color: '#ff5500',
    status: 'todo' as const,
    due_date: null,
    steps: [],
    sort_order: 0,
    created_at: validIso,
    updated_at: validIso,
    archived_at: null,
  }

  it('sin bloque ni vínculo quedan en null por defecto', () => {
    const parsed = TaskSchema.parse(base)
    expect(parsed.block_id).toBeNull()
    expect(parsed.event_link).toBeNull()
  })

  it('acepta un bloque y un vínculo (par calendario + evento)', () => {
    const parsed = TaskSchema.parse({
      ...base,
      block_id: validUuid2,
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(parsed.block_id).toBe(validUuid2)
    expect(parsed.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })

  it('rechaza un vínculo incompleto', () => {
    expect(() =>
      TaskSchema.parse({ ...base, event_link: { calendarId: 'local', eventId: '' } })
    ).toThrow()
    expect(() => TaskSchema.parse({ ...base, event_link: { calendarId: '' } })).toThrow()
  })
})

describe('CreateTaskDraftSchema - bloque y vínculo', () => {
  it('por defecto sin bloque ni vínculo', () => {
    const parsed = CreateTaskDraftSchema.parse({ title: 'x', color: '#aabbcc' })
    expect(parsed.block_id).toBeNull()
    expect(parsed.event_link).toBeNull()
  })

  it('acepta bloque y vínculo explícitos', () => {
    const parsed = CreateTaskDraftSchema.parse({
      title: 'x',
      color: '#aabbcc',
      block_id: validUuid2,
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(parsed.block_id).toBe(validUuid2)
    expect(parsed.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
  })
})

describe('rowToTask - bloque y vínculo', () => {
  function makeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: validUuid,
      title: 'Test',
      description: null,
      color: '#ff5500',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      archived_at: null,
      ...overrides,
    }
  }

  it('reconstruye el vínculo sólo cuando existen ambas columnas', () => {
    expect(rowToTask(makeRow({ calendar_id: 'local', event_id: 'evt-1' })).event_link).toEqual({
      calendarId: 'local',
      eventId: 'evt-1',
    })
    expect(rowToTask(makeRow({ calendar_id: 'local' })).event_link).toBeNull()
    expect(rowToTask(makeRow({ event_id: 'evt-1' })).event_link).toBeNull()
    expect(rowToTask(makeRow()).event_link).toBeNull()
  })

  it('mapea block_id (presente o ausente)', () => {
    expect(rowToTask(makeRow({ block_id: validUuid2 })).block_id).toBe(validUuid2)
    expect(rowToTask(makeRow()).block_id).toBeNull()
  })
})

describe('taskToRow - bloque y vínculo', () => {
  it('emite block_id cuando está presente o null (para limpiarlo)', () => {
    expect(taskToRow({ title: 'x', color: '#aabbcc', block_id: validUuid2 }).block_id).toBe(
      validUuid2
    )
    expect(taskToRow({ title: 'x', color: '#aabbcc', block_id: null }).block_id).toBeNull()
  })

  it('sin block_id no incluye la clave (no toca la columna)', () => {
    expect(taskToRow({ title: 'x', color: '#aabbcc' })).not.toHaveProperty('block_id')
  })

  it('event_link undefined no toca las columnas del vínculo', () => {
    const row = taskToRow({ title: 'x', color: '#aabbcc' })
    expect(row).not.toHaveProperty('calendar_id')
    expect(row).not.toHaveProperty('event_id')
  })

  it('event_link null limpia ambas columnas', () => {
    const row = taskToRow({ title: 'x', color: '#aabbcc', event_link: null })
    expect(row.calendar_id).toBeNull()
    expect(row.event_id).toBeNull()
  })

  it('event_link objeto fija ambas columnas', () => {
    const row = taskToRow({
      title: 'x',
      color: '#aabbcc',
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(row.calendar_id).toBe('local')
    expect(row.event_id).toBe('evt-1')
  })

  it('mantiene description/status/due_date/sort_order siempre presentes', () => {
    const row = taskToRow({ title: 'x', color: '#aabbcc' })
    expect(row).toMatchObject({ description: null, status: 'todo', due_date: null, sort_order: 0 })
  })
})
