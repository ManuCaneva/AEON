import { describe, it, expect } from 'vitest'
import { taskInAgenda } from './taskAgenda'

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
