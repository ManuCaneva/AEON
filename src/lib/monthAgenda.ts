import type { Exam } from '@/schemas/exams'
import type { Task } from '@/schemas/tasks'
import type { CalendarEvent } from '@/schemas/calendar'
import { eventKey } from './entityEventLink'
import { taskInAgenda, taskDay } from './taskAgenda'

export type MonthAgendaKind = 'exam' | 'task' | 'event'

export interface MonthAgendaItem {
  id: string
  title: string
  color: string
  kind: MonthAgendaKind
}

export type MonthAgendaByDate = Map<string, MonthAgendaItem[]>

/**
 * Agenda completa indexada por fecha (YYYY-MM-DD): exámenes, tareas y eventos
 * de Calendar, con la misma regla de agenda y dedup que la Agenda del Día
 * (DayDetailsModal) — una entidad que representa a su evento nunca se muestra
 * dos veces. El orden dentro de cada día es exámenes → tareas → eventos.
 *
 * Indexa todo sin recorte de rango: cada celda de la grilla mira su fecha.
 * Los colores los resuelve el caller porque viven en los stores (bloques).
 */
export function buildMonthAgenda(input: {
  exams: readonly Exam[]
  tasks: readonly Task[]
  events: readonly CalendarEvent[]
  representedEventKeys: ReadonlySet<string>
  examColor: (exam: Exam) => string
  taskColor: (task: Task) => string
}): MonthAgendaByDate {
  const byDate: MonthAgendaByDate = new Map()
  const push = (date: string, item: MonthAgendaItem) => {
    const list = byDate.get(date)
    if (list) list.push(item)
    else byDate.set(date, [item])
  }

  for (const exam of input.exams) {
    push(exam.date, {
      id: `exam_${exam.id}`,
      title: exam.title,
      color: input.examColor(exam),
      kind: 'exam',
    })
  }

  for (const task of input.tasks) {
    if (!taskInAgenda(task)) continue
    const day = taskDay(task, input.events)
    if (day === null) continue
    push(day, {
      id: `task_${task.id}`,
      title: task.title,
      color: input.taskColor(task),
      kind: 'task',
    })
  }

  for (const event of input.events) {
    if (input.representedEventKeys.has(eventKey(event.calendarId, event.id))) continue
    push(event.date, {
      id: `evt_${event.id}`,
      title: event.title,
      color: event.color,
      kind: 'event',
    })
  }

  return byDate
}
