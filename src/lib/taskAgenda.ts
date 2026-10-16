/**
 * Una tarea entra en la agenda del día si sigue activa o ya está hecha (al
 * completarla el store la archiva). Una archivada sin completar fue descartada
 * por el usuario: no se muestra, y tampoco aporta su evento a la dedup.
 *
 * Tipo estructural mínimo: sólo miran `archived_at` y `status`.
 */
export function taskInAgenda(task: {
  archived_at?: string | null
  status: string
}): boolean {
  return task.archived_at === null || task.status === 'done'
}
