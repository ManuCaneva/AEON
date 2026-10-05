import type { Component } from 'vue'
import HabitsWidget from '@/components/dashboard/HabitsWidget.vue'
import TasksWidget from '@/components/dashboard/TasksWidget.vue'
import GoalsWidget from '@/components/dashboard/GoalsWidget.vue'
import YearCalendarWidget from '@/components/dashboard/YearCalendarWidget.vue'
import WeeklyScheduleWidget from '@/components/dashboard/WeeklyScheduleWidget.vue'
import NotesWidget from '@/components/dashboard/NotesWidget.vue'
import PomodoroWidget from '@/components/dashboard/PomodoroWidget.vue'

export interface DashboardWidget {
  id: string
  title: string
  icon?: string
  component: Component
  minW: number
  minH: number
  defaultX: number
  defaultY: number
  defaultW: number
  defaultH: number
  defaultEnabled?: boolean
}

export const widgets: DashboardWidget[] = [
  {
    id: 'habits',
    title: 'Hábitos',
    icon: 'check-circle',
    component: HabitsWidget,
    minW: 1,
    minH: 1,
    defaultX: 0,
    defaultY: 0,
    defaultW: 2,
    defaultH: 7,
  },
  {
    id: 'tasks',
    title: 'Tareas',
    icon: 'list-todo',
    component: TasksWidget,
    minW: 1,
    minH: 1,
    defaultX: 8,
    defaultY: 5,
    defaultW: 3,
    defaultH: 5,
  },
  {
    id: 'goals',
    title: 'Objetivos',
    icon: 'target',
    component: GoalsWidget,
    minW: 1,
    minH: 1,
    defaultX: 8,
    defaultY: 0,
    defaultW: 3,
    defaultH: 5,
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro',
    icon: 'timer',
    component: PomodoroWidget,
    minW: 2,
    minH: 3,
    defaultX: 0,
    defaultY: 7,
    defaultW: 2,
    defaultH: 3,
    defaultEnabled: true,
  },
  {
    id: 'year-calendar',
    title: 'Calendario Anual',
    icon: 'calendar',
    component: YearCalendarWidget,
    minW: 1,
    minH: 3,
    defaultX: 11,
    defaultY: 0,
    defaultW: 1,
    defaultH: 10,
  },
  {
    id: 'weekly-schedule',
    title: 'Cronograma Semanal',
    icon: 'calendar-week',
    component: WeeklyScheduleWidget,
    minW: 5,
    minH: 4,
    defaultX: 2,
    defaultY: 0,
    defaultW: 6,
    defaultH: 5,
  },
  {
    id: 'notes',
    title: 'Notas',
    icon: 'sticky-note',
    component: NotesWidget,
    minW: 1,
    minH: 2,
    defaultX: 2,
    defaultY: 5,
    defaultW: 6,
    defaultH: 5,
  },
]

export function getWidgetById(id: string): DashboardWidget | undefined {
  return widgets.find((w) => w.id === id)
}
