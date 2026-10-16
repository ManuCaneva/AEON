import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTasksStore, daysUntilDue, urgencyLevel, deadlineProgress } from './tasks'
import { useWeeklyScheduleStore } from './weeklySchedule'
import type { CalendarEvent } from '@/schemas/calendar'
import type { ScheduleBlockWithSlots } from '@/schemas/weeklySchedule'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  archiveTask: vi.fn().mockResolvedValue(undefined),
  restoreTask: vi.fn().mockResolvedValue(undefined),
}))

// El store de tareas orquesta el calendario: se mockea entero para no tocar
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

function makeTask(overrides: Partial<ReturnType<typeof useTasksStore>['tasks'][0]> = {}) {
  const now = new Date().toISOString()
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Test task',
    description: null,
    color: '#5e6ad2',
    status: 'todo' as const,
    due_date: null,
    block_id: null,
    event_link: null,
    steps: [],
    sort_order: 0,
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  }
}

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('tasks store - createTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should generate id and timestamps, call db.createTask, and add to state', async () => {
    const store = useTasksStore()
    const draft = { title: 'Test task', color: '#5e6ad2', status: 'todo' as const, steps: [] }
    const mockRow = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Test task',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }

    vi.mocked(db.createTask).mockResolvedValue(mockRow)

    await store.createTask(draft)

    expect(db.createTask).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.createTask).mock.calls[0]
    expect(callArgs[0]).toEqual(draft)
    expect(typeof callArgs[1]).toBe('string')
    expect(typeof callArgs[2]).toBe('string')
    expect(typeof callArgs[3]).toBe('string')

    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0].id).toBe('11111111-1111-1111-1111-111111111111')
    expect(store.tasks[0].title).toBe('Test task')
  })

  it('should be immutable (replace state array)', async () => {
    const store = useTasksStore()
    const mockRow = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Test',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }

    vi.mocked(db.createTask).mockResolvedValue(mockRow)

    const initialTasks = store.tasks
    await store.createTask({ title: 'Test', color: '#5e6ad2', status: 'todo' as const, steps: [] })
    expect(store.tasks).not.toBe(initialTasks)
  })
})

describe('tasks store - loadTasks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should load tasks and map rows', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const mockRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Task 1',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        calendar_id: null,
        event_id: null,
        steps: '[]',
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Task 2',
        description: null,
        color: '#ff0000',
        status: 'doing',
        due_date: null,
        block_id: null,
        calendar_id: null,
        event_id: null,
        steps: '[{"id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","title":"Step 1","done":true}]',
        sort_order: 1,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    vi.mocked(db.listTasks).mockResolvedValue(mockRows)

    await store.loadTasks()

    expect(store.tasks).toHaveLength(2)
    expect(store.tasks[0].title).toBe('Task 1')
    expect(store.tasks[1].steps).toHaveLength(1)
    expect(store.tasks[1].steps[0].done).toBe(true)
  })
})

describe('tasks store - updateTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should call db.updateTask with id, patch, and updated_at', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const taskId = '11111111-1111-1111-1111-111111111111'

    store.tasks = [
      {
        id: taskId,
        title: 'Original',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    const mockRow = {
      id: taskId,
      title: 'Updated',
      description: null,
      color: '#5e6ad2',
      status: 'doing',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: now,
      updated_at: new Date().toISOString(),
      archived_at: null,
    }

    vi.mocked(db.updateTask).mockResolvedValue(mockRow)

    await store.updateTask(taskId, { title: 'Updated', status: 'doing' })

    expect(db.updateTask).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.updateTask).mock.calls[0]
    expect(callArgs[0]).toBe(taskId)
    expect(callArgs[1]).toEqual({ title: 'Updated', status: 'doing' })
    expect(typeof callArgs[2]).toBe('string')

    expect(store.tasks[0].title).toBe('Updated')
    expect(store.tasks[0].status).toBe('doing')
  })
})

describe('tasks store - deleteTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should call db.deleteTask and remove from state', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const taskId = '11111111-1111-1111-1111-111111111111'

    store.tasks = [
      {
        id: taskId,
        title: 'To delete',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    await store.deleteTask(taskId)

    expect(db.deleteTask).toHaveBeenCalledWith(taskId)
    expect(store.tasks).toHaveLength(0)
  })
})

describe('tasks store - toggleStep', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should toggle step done status and call updateTask', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const taskId = '11111111-1111-1111-1111-111111111111'
    const stepId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    store.tasks = [
      {
        id: taskId,
        title: 'Task',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [{ id: stepId, title: 'Step 1', done: false }],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    const mockRow = {
      id: taskId,
      title: 'Task',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","title":"Step 1","done":true}]',
      sort_order: 0,
      created_at: now,
      updated_at: new Date().toISOString(),
      archived_at: null,
    }

    vi.mocked(db.updateTask).mockResolvedValue(mockRow)

    await store.toggleStep(taskId, stepId)

    expect(db.updateTask).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(db.updateTask).mock.calls[0]
    expect(callArgs[0]).toBe(taskId)
    expect(callArgs[1]).toHaveProperty('steps')
    const steps = callArgs[1].steps
    expect(steps).toHaveLength(1)
    expect(steps![0].done).toBe(true)

    expect(store.tasks[0].steps[0].done).toBe(true)
  })
})

describe('tasks store - pendingTasks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("should filter out tasks with status 'done'", async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()

    store.tasks = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Pending',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Done',
        description: null,
        color: '#ff0000',
        status: 'done',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 1,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        title: 'Doing',
        description: null,
        color: '#00ff00',
        status: 'doing',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 2,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    expect(store.pendingTasks).toHaveLength(2)
    expect(store.pendingTasks[0].status).toBe('todo')
    expect(store.pendingTasks[1].status).toBe('doing')
  })
})

describe('tasks store - filas vacías al guardar', () => {
  const stepA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const stepB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('al crear una tarea descarta los pasos sin título y persiste solo los válidos', async () => {
    const store = useTasksStore()
    vi.mocked(db.createTask).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Comprar',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: JSON.stringify([{ id: stepA, title: 'Ir al super', done: false }]),
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.createTask({
      title: 'Comprar',
      color: '#5e6ad2',
      status: 'todo' as const,
      steps: [
        { id: stepA, title: 'Ir al super', done: false },
        { id: stepB, title: '   ', done: false },
      ],
    })

    const draft = vi.mocked(db.createTask).mock.calls[0][0] as { steps: unknown[] }
    expect(draft.steps).toEqual([{ id: stepA, title: 'Ir al super', done: false }])
  })

  it('al crear una tarea sin ningún paso válido persiste una lista vacía', async () => {
    const store = useTasksStore()
    vi.mocked(db.createTask).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Comprar',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.createTask({
      title: 'Comprar',
      color: '#5e6ad2',
      status: 'todo' as const,
      steps: [
        { id: stepA, title: '', done: false },
        { id: stepB, title: '  ', done: true },
      ],
    })

    const draft = vi.mocked(db.createTask).mock.calls[0][0] as { steps: unknown[] }
    expect(draft.steps).toEqual([])
  })

  it('al editar descarta los pasos sin título igual que al crear', async () => {
    const store = useTasksStore()
    vi.mocked(db.updateTask).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Comprar',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: JSON.stringify([{ id: stepA, title: 'Ir al super', done: false }]),
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.updateTask('11111111-1111-1111-1111-111111111111', {
      steps: [
        { id: stepA, title: 'Ir al super', done: false },
        { id: stepB, title: '', done: false },
      ],
    })

    const patch = vi.mocked(db.updateTask).mock.calls[0][1] as { steps: unknown[] }
    expect(patch.steps).toEqual([{ id: stepA, title: 'Ir al super', done: false }])
  })

  it('un patch sin pasos no toca la lista de pasos', async () => {
    const store = useTasksStore()
    vi.mocked(db.updateTask).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Nuevo',
      description: null,
      color: '#5e6ad2',
      status: 'doing',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.updateTask('11111111-1111-1111-1111-111111111111', {
      title: 'Nuevo',
      status: 'doing',
    })

    const patch = vi.mocked(db.updateTask).mock.calls[0][1] as Record<string, unknown>
    expect(patch).toEqual({ title: 'Nuevo', status: 'doing' })
  })
})

describe('daysUntilDue', () => {
  it('should return positive days for future date', () => {
    const today = todayLocalDate()
    const future = addDays(today, 5)
    expect(daysUntilDue(future)).toBe(5)
  })

  it('should return negative days for past date', () => {
    const today = todayLocalDate()
    const past = addDays(today, -3)
    expect(daysUntilDue(past)).toBe(-3)
  })

  it('should return 0 for today', () => {
    const today = todayLocalDate()
    expect(daysUntilDue(today)).toBe(0)
  })
})

describe('urgencyLevel', () => {
  it("should return 'none' for null due_date", () => {
    expect(urgencyLevel(null)).toBe('none')
  })

  it("should return 'overdue' for past date", () => {
    const today = todayLocalDate()
    const past = addDays(today, -1)
    expect(urgencyLevel(past)).toBe('overdue')
  })

  it("should return 'warning' for date <= 3 days", () => {
    const today = todayLocalDate()
    expect(urgencyLevel(today)).toBe('warning')
    expect(urgencyLevel(addDays(today, 1))).toBe('warning')
    expect(urgencyLevel(addDays(today, 2))).toBe('warning')
    expect(urgencyLevel(addDays(today, 3))).toBe('warning')
  })

  it("should return 'normal' for date > 3 days", () => {
    const today = todayLocalDate()
    expect(urgencyLevel(addDays(today, 4))).toBe('normal')
    expect(urgencyLevel(addDays(today, 10))).toBe('normal')
  })
})

describe('deadlineProgress', () => {
  it('should return null for null due_date', () => {
    const now = new Date().toISOString()
    expect(deadlineProgress(now, null)).toBeNull()
  })

  it('should return null if due_date <= created_at', () => {
    const createdDate = '2026-01-01'
    const dueDate = '2025-12-31'
    expect(deadlineProgress(createdDate, dueDate)).toBeNull()
  })

  it('should return 0 if today == created_at', () => {
    const today = todayLocalDate()
    const createdDate = today
    const dueDate = addDays(today, 10)
    expect(deadlineProgress(createdDate, dueDate)).toBe(0)
  })

  it('should return 1 if today >= due_date', () => {
    const today = todayLocalDate()
    const createdDate = addDays(today, -10)
    const dueDate = addDays(today, -1)
    expect(deadlineProgress(createdDate, dueDate)).toBe(1)
  })

  it('should return progress between 0 and 1', () => {
    const today = todayLocalDate()
    const createdDate = addDays(today, -5)
    const dueDate = addDays(today, 5)
    const progress = deadlineProgress(createdDate, dueDate)
    expect(progress).not.toBeNull()
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThan(1)
  })
})

describe('tasks store - archiveTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should call db.archiveTask and set archived_at on the task', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const taskId = '11111111-1111-1111-1111-111111111111'

    store.tasks = [
      {
        id: taskId,
        title: 'To archive',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
    ]

    await store.archiveTask(taskId)

    expect(db.archiveTask).toHaveBeenCalledTimes(1)
    expect(db.archiveTask).toHaveBeenCalledWith(taskId, expect.any(String))
    expect(store.tasks[0].archived_at).not.toBeNull()
    expect(store.tasks[0].archived_at).toBeTruthy()
  })

  it('should exclude archived tasks from activeTasks', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()

    store.tasks = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Active',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: null,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Archived',
        description: null,
        color: '#ff0000',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 1,
        created_at: now,
        updated_at: now,
        archived_at: now,
      },
    ]

    expect(store.activeTasks).toHaveLength(1)
    expect(store.activeTasks[0].title).toBe('Active')
    expect(store.archivedTasks).toHaveLength(1)
    expect(store.archivedTasks[0].title).toBe('Archived')
  })
})

describe('tasks store - restoreTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should call db.restoreTask and clear archived_at', async () => {
    const store = useTasksStore()
    const now = new Date().toISOString()
    const taskId = '11111111-1111-1111-1111-111111111111'

    store.tasks = [
      {
        id: taskId,
        title: 'To restore',
        description: null,
        color: '#5e6ad2',
        status: 'todo',
        due_date: null,
        block_id: null,
        event_link: null,
        steps: [],
        sort_order: 0,
        created_at: now,
        updated_at: now,
        archived_at: now,
      },
    ]

    await store.restoreTask(taskId)

    expect(db.restoreTask).toHaveBeenCalledTimes(1)
    expect(db.restoreTask).toHaveBeenCalledWith(taskId, expect.any(String))
    expect(store.tasks[0].archived_at).toBeNull()
  })
})

describe('tasks store - completeTask / uncompleteTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('completeTask sets status to done and archives', async () => {
    const store = useTasksStore()
    const taskId = '11111111-1111-1111-1111-111111111111'
    store.tasks = [makeTask({ id: taskId, status: 'todo' as const, archived_at: null })]

    vi.mocked(db.updateTask).mockResolvedValue({
      id: taskId,
      title: 'Test task',
      description: null,
      color: '#5e6ad2',
      status: 'done',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.completeTask(taskId)

    expect(db.updateTask).toHaveBeenCalledWith(taskId, { status: 'done' }, expect.any(String))
    expect(db.archiveTask).toHaveBeenCalledWith(taskId, expect.any(String))
    expect(store.tasks[0].status).toBe('done')
    expect(store.tasks[0].archived_at).not.toBeNull()
  })

  it('uncompleteTask sets status to doing and restores', async () => {
    const store = useTasksStore()
    const taskId = '11111111-1111-1111-1111-111111111111'
    const archivedAt = new Date().toISOString()
    store.tasks = [makeTask({ id: taskId, status: 'done' as const, archived_at: archivedAt })]

    vi.mocked(db.updateTask).mockResolvedValue({
      id: taskId,
      title: 'Test task',
      description: null,
      color: '#5e6ad2',
      status: 'doing',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: '[]',
      sort_order: 0,
      created_at: archivedAt,
      updated_at: new Date().toISOString(),
      archived_at: null,
    })

    await store.uncompleteTask(taskId)

    expect(db.updateTask).toHaveBeenCalledWith(taskId, { status: 'doing' }, expect.any(String))
    expect(db.restoreTask).toHaveBeenCalledWith(taskId, expect.any(String))
    expect(store.tasks[0].status).toBe('doing')
    expect(store.tasks[0].archived_at).toBeNull()
  })
})

describe('tasks store - toggleStep (no auto-complete)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('toggleStep no auto-completa cuando todos los pasos están done', async () => {
    const store = useTasksStore()
    const taskId = '11111111-1111-1111-1111-111111111111'
    const step1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const step2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

    store.tasks = [
      makeTask({
        id: taskId,
        steps: [
          { id: step1, title: 'Step 1', done: false },
          { id: step2, title: 'Step 2', done: false },
        ],
        status: 'todo' as const,
        archived_at: null,
      }),
    ]

    vi.mocked(db.updateTask).mockImplementation(async (id, patch) => ({
      id,
      title: 'Test task',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: patch.steps ? JSON.stringify(patch.steps) : '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }))

    await store.toggleStep(taskId, step1)
    expect(store.tasks[0].steps[0].done).toBe(true)
    expect(store.tasks[0].status).toBe('todo')
    expect(store.tasks[0].archived_at).toBeNull()
    expect(db.archiveTask).not.toHaveBeenCalled()

    await store.toggleStep(taskId, step2)
    expect(store.tasks[0].steps[1].done).toBe(true)
    expect(store.tasks[0].status).toBe('todo')
    expect(store.tasks[0].archived_at).toBeNull()
    expect(db.archiveTask).not.toHaveBeenCalled()
  })

  it('toggleStep no revierte estado ni restaura al desmarcar paso', async () => {
    const store = useTasksStore()
    const taskId = '11111111-1111-1111-1111-111111111111'
    const step1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const step2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

    store.tasks = [
      makeTask({
        id: taskId,
        steps: [
          { id: step1, title: 'Step 1', done: true },
          { id: step2, title: 'Step 2', done: true },
        ],
        status: 'todo' as const,
        archived_at: null,
      }),
    ]

    vi.mocked(db.updateTask).mockImplementation(async (id, patch) => ({
      id,
      title: 'Test task',
      description: null,
      color: '#5e6ad2',
      status: 'todo',
      due_date: null,
      block_id: null,
      calendar_id: null,
      event_id: null,
      steps: patch.steps ? JSON.stringify(patch.steps) : '[]',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }))

    await store.toggleStep(taskId, step1)
    expect(store.tasks[0].steps[0].done).toBe(false)
    expect(store.tasks[0].status).toBe('todo')
    expect(store.tasks[0].archived_at).toBeNull()
    expect(db.restoreTask).not.toHaveBeenCalled()
  })
})

const blockUuid = '11111111-1111-4111-8111-111111111111'
const linkedTaskId = '22222222-2222-4222-8222-222222222222'

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: linkedTaskId,
    title: 'Test task',
    description: null,
    color: '#5e6ad2',
    status: 'todo',
    due_date: null,
    block_id: null,
    calendar_id: null,
    event_id: null,
    steps: '[]',
    sort_order: 0,
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  }
}

function makeBlock(overrides: Partial<ScheduleBlockWithSlots> = {}): ScheduleBlockWithSlots {
  return {
    id: blockUuid,
    title: 'Física',
    color: 'green',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    slots: [],
    ...overrides,
  }
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    date: '2026-07-01',
    title: 'Entregar informe',
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
      calendarMock.events = [
        ...calendarMock.events,
        makeEvent({
          id,
          calendarId,
          date: data.start,
          title: data.title,
          start: data.start,
          end: data.start,
        }),
      ]
    }
  )
  calendarMock.updateEvent.mockResolvedValue(undefined)
  calendarMock.deleteEvent.mockResolvedValue(undefined)
}

describe('tasks store - color vivo del bloque', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sin bloque asociado usa el color manual de la tarea', async () => {
    useWeeklyScheduleStore().blocksWithSlots = []
    const store = useTasksStore()
    vi.mocked(db.listTasks).mockResolvedValue([makeTaskRow({ color: '#ff0000' })])
    await store.loadTasks()

    expect(store.colorFor(store.tasks[0])).toBe('#ff0000')
    expect(store.blockFor(store.tasks[0])).toBeUndefined()
  })

  it('con bloque existente el color del bloque gana sobre el manual', async () => {
    useWeeklyScheduleStore().blocksWithSlots = [makeBlock()]
    const store = useTasksStore()
    vi.mocked(db.listTasks).mockResolvedValue([
      makeTaskRow({ color: '#ff0000', block_id: blockUuid }),
    ])
    await store.loadTasks()

    expect(store.colorFor(store.tasks[0])).toBe('rgb(var(--color-block-green))')
    expect(store.blockFor(store.tasks[0])?.title).toBe('Física')
    // El color manual persistido no se pisa.
    expect(store.tasks[0].color).toBe('#ff0000')
  })

  it('si el bloque se borró, la tarea queda sin bloque y conserva su color manual', async () => {
    useWeeklyScheduleStore().blocksWithSlots = []
    const store = useTasksStore()
    vi.mocked(db.listTasks).mockResolvedValue([
      makeTaskRow({ color: '#00ff00', block_id: blockUuid }),
    ])
    await store.loadTasks()

    expect(store.blockFor(store.tasks[0])).toBeUndefined()
    expect(store.colorFor(store.tasks[0])).toBe('#00ff00')
  })
})

describe('tasks store - crear con evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('"none" persiste la tarea sin vínculo y no toca el calendario', async () => {
    vi.mocked(db.createTask).mockResolvedValue(makeTaskRow())
    const store = useTasksStore()

    const { task, eventError } = await store.createTaskWithEvent(
      { title: 'Entregar', color: '#5e6ad2', due_date: '2026-07-01' },
      { mode: 'none' }
    )

    expect(calendarMock.createEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.createTask).mock.calls[0][0]).toMatchObject({ event_link: null })
    expect(task.event_link).toBeNull()
    expect(eventError).toBeNull()
  })

  it('"existing" persiste el vínculo elegido sin crear ni actualizar el evento', async () => {
    vi.mocked(db.createTask).mockResolvedValue(
      makeTaskRow({ calendar_id: 'local', event_id: 'evt-1' })
    )
    const store = useTasksStore()

    const { task, eventError } = await store.createTaskWithEvent(
      { title: 'Entregar', color: '#5e6ad2', due_date: '2026-07-01' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.createEvent).not.toHaveBeenCalled()
    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.createTask).mock.calls[0][0]).toMatchObject({
      event_link: { calendarId: 'local', eventId: 'evt-1' },
    })
    expect(task.event_link).toEqual({ calendarId: 'local', eventId: 'evt-1' })
    expect(eventError).toBeNull()
  })

  it('"local" crea un evento de todo el día en el calendario local y lo vincula', async () => {
    vi.mocked(db.createTask).mockResolvedValue(
      makeTaskRow({ due_date: '2026-07-01', title: 'Entregar' })
    )
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({ due_date: '2026-07-01', calendar_id: 'local', event_id: 'local_1' })
    )
    const store = useTasksStore()

    const { task, eventError } = await store.createTaskWithEvent(
      { title: 'Entregar', color: '#5e6ad2', due_date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ title: 'Entregar', allDay: true, start: '2026-07-01' })
    )
    expect(vi.mocked(db.updateTask).mock.calls[0][1]).toEqual({
      event_link: { calendarId: 'local', eventId: 'local_1' },
    })
    expect(task.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('"new" crea el evento en el calendario elegido', async () => {
    vi.mocked(db.createTask).mockResolvedValue(
      makeTaskRow({ due_date: '2026-07-01', title: 'Entregar' })
    )
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({ due_date: '2026-07-01', calendar_id: 'primary', event_id: 'google_1' })
    )
    const store = useTasksStore()

    const { task } = await store.createTaskWithEvent(
      { title: 'Entregar', color: '#5e6ad2', due_date: '2026-07-01' },
      { mode: 'new', calendarId: 'primary' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'primary',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(task.event_link).toEqual({ calendarId: 'primary', eventId: 'google_1' })
  })

  it('si crear el evento falla, la tarea queda sin vínculo y devuelve el error', async () => {
    vi.mocked(db.createTask).mockResolvedValue(
      makeTaskRow({ due_date: '2026-07-01', title: 'Entregar' })
    )
    calendarMock.createEvent.mockRejectedValue(new Error('boom'))
    const store = useTasksStore()

    const { task, eventError } = await store.createTaskWithEvent(
      { title: 'Entregar', color: '#5e6ad2', due_date: '2026-07-01' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
    expect(task.event_link).toBeNull()
    expect(db.updateTask).not.toHaveBeenCalled()
    expect(store.tasks[0].event_link).toBeNull()
  })
})

describe('tasks store - editar con evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('"none" limpia el vínculo y deja el evento intacto', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1' })]
    vi.mocked(db.updateTask).mockResolvedValue(makeTaskRow({ calendar_id: null, event_id: null }))

    await store.updateTaskWithEvent(linkedTaskId, { title: 'Nuevo' }, { mode: 'none' })

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(vi.mocked(db.updateTask).mock.calls[0][1]).toMatchObject({ event_link: null })
    expect(store.tasks[0].event_link).toBeNull()
  })

  it('con vínculo vigente y "existing", un cambio de título actualiza el evento', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        title: 'Viejo',
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({
        id: linkedTaskId,
        title: 'Nuevo',
        due_date: '2026-07-01',
        calendar_id: 'local',
        event_id: 'evt-1',
      })
    )

    const { eventError } = await store.updateTaskWithEvent(
      linkedTaskId,
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
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        title: 'Entregar',
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({
        id: linkedTaskId,
        title: 'Entregar',
        due_date: '2026-07-10',
        calendar_id: 'local',
        event_id: 'evt-1',
      })
    )

    await store.updateTaskWithEvent(
      linkedTaskId,
      { due_date: '2026-07-10' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).toHaveBeenCalledWith(
      'local',
      'evt-1',
      expect.objectContaining({ title: 'Entregar', allDay: true, start: '2026-07-10' })
    )
  })

  it('un vínculo de otro día degrada en silencio: no actualiza el evento', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        title: 'Viejo',
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-05' })]
    vi.mocked(db.updateTask).mockResolvedValue(makeTaskRow({ title: 'Nuevo' }))

    await store.updateTaskWithEvent(
      linkedTaskId,
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('un vínculo huérfano degrada en silencio: no actualiza el evento', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        title: 'Viejo',
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
      }),
    ]
    calendarMock.events = []
    vi.mocked(db.updateTask).mockResolvedValue(makeTaskRow({ title: 'Nuevo' }))

    await store.updateTaskWithEvent(
      linkedTaskId,
      { title: 'Nuevo' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-ausente' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('sin cambios de título ni fecha no actualiza el evento', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        title: 'Entregar',
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({ title: 'Entregar', due_date: '2026-07-01' })
    )

    await store.updateTaskWithEvent(
      linkedTaskId,
      { status: 'doing' },
      { mode: 'existing', link: { calendarId: 'local', eventId: 'evt-1' } }
    )

    expect(calendarMock.updateEvent).not.toHaveBeenCalled()
  })

  it('"local" crea el evento y lo vincula', async () => {
    const store = useTasksStore()
    store.tasks = [makeTask({ id: linkedTaskId, title: 'Entregar', due_date: '2026-07-01' })]
    vi.mocked(db.updateTask)
      .mockResolvedValueOnce(
        makeTaskRow({ id: linkedTaskId, title: 'Entregar', due_date: '2026-07-01' })
      )
      .mockResolvedValueOnce(
        makeTaskRow({ id: linkedTaskId, calendar_id: 'local', event_id: 'local_1' })
      )

    const { task, eventError } = await store.updateTaskWithEvent(
      linkedTaskId,
      { title: 'Entregar' },
      { mode: 'local' }
    )

    expect(calendarMock.createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ allDay: true, start: '2026-07-01' })
    )
    expect(task.event_link).toEqual({ calendarId: 'local', eventId: 'local_1' })
    expect(eventError).toBeNull()
  })

  it('si crear el evento falla al editar, devuelve el error sin romper', async () => {
    const store = useTasksStore()
    store.tasks = [makeTask({ id: linkedTaskId, title: 'Entregar', due_date: '2026-07-01' })]
    calendarMock.createEvent.mockRejectedValue(new Error('boom'))
    vi.mocked(db.updateTask).mockResolvedValue(
      makeTaskRow({ id: linkedTaskId, title: 'Entregar', due_date: '2026-07-01' })
    )

    const { eventError } = await store.updateTaskWithEvent(
      linkedTaskId,
      { title: 'Entregar' },
      { mode: 'local' }
    )

    expect(eventError).toBe('boom')
  })
})

describe('tasks store - borrar tarea y su evento', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetCalendarMock()
  })

  it('sin vínculo sólo borra la tarea', async () => {
    const store = useTasksStore()
    store.tasks = [makeTask({ id: linkedTaskId })]

    await store.deleteTaskWithEvent(linkedTaskId, true)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteTask).toHaveBeenCalledWith(linkedTaskId)
    expect(store.tasks).toHaveLength(0)
  })

  it('con deleteEvent borra el evento en su calendario y luego la tarea', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await store.deleteTaskWithEvent(linkedTaskId, true)

    expect(calendarMock.deleteEvent).toHaveBeenCalledWith('local', 'evt-1')
    expect(db.deleteTask).toHaveBeenCalledWith(linkedTaskId)
    expect(store.tasks).toHaveLength(0)
  })

  it('con deleteEvent pero vínculo huérfano sólo borra la tarea', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-ausente' },
      }),
    ]
    calendarMock.events = []

    await store.deleteTaskWithEvent(linkedTaskId, true)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteTask).toHaveBeenCalledWith(linkedTaskId)
  })

  it('sin deleteEvent no toca el evento aunque el vínculo sea vigente', async () => {
    const store = useTasksStore()
    store.tasks = [
      makeTask({
        id: linkedTaskId,
        due_date: '2026-07-01',
        event_link: { calendarId: 'local', eventId: 'evt-1' },
      }),
    ]
    calendarMock.events = [makeEvent({ id: 'evt-1', date: '2026-07-01' })]

    await store.deleteTaskWithEvent(linkedTaskId, false)

    expect(calendarMock.deleteEvent).not.toHaveBeenCalled()
    expect(db.deleteTask).toHaveBeenCalledWith(linkedTaskId)
  })
})
