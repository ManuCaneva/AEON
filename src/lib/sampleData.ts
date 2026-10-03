import type { CreateHabitDraft, HabitFrequency } from '@/schemas/habits'
import type { CreateTaskDraft } from '@/schemas/tasks'
import type { CreateGoalDraft, GoalFrequency } from '@/schemas/goals'
import type { CreateNoteDraft } from '@/schemas/notes'
import type { CreateScheduleBlockDraft, CreateScheduleSlotDraft } from '@/schemas/weeklySchedule'
import { CalendarEventSchema, CALENDAR_COLORS, DEFAULT_EVENT_COLOR } from '@/schemas/calendar'
import type { CalendarEvent } from '@/schemas/calendar'
import { HABIT_COLORS } from './habitColors'

/** Año en el que viven todas las fechas con vencimiento de los datos de ejemplo. */
export const SAMPLE_YEAR = 2027

export interface SampleHabit {
  id: string
  draft: CreateHabitDraft
  created_at: string
}

export interface SampleHabitLog {
  id: string
  habit_id: string
  log_date: string
  count: number
  created_at: string
}

export interface SampleTask {
  id: string
  draft: CreateTaskDraft
  created_at: string
}

export interface SampleGoal {
  id: string
  draft: CreateGoalDraft
  created_at: string
}

export interface SampleGoalLog {
  id: string
  goal_id: string
  log_date: string
  amount: number
  created_at: string
}

export interface SampleNote {
  id: string
  draft: CreateNoteDraft
  created_at: string
}

export interface SampleScheduleBlock {
  id: string
  draft: CreateScheduleBlockDraft
  created_at: string
  slots: {
    id: string
    draft: CreateScheduleSlotDraft
    created_at: string
  }[]
}

export interface SampleData {
  habits: SampleHabit[]
  habitLogs: SampleHabitLog[]
  tasks: SampleTask[]
  goals: SampleGoal[]
  goalLogs: SampleGoalLog[]
  notes: SampleNote[]
  scheduleBlocks: SampleScheduleBlock[]
  calendarEvents: CalendarEvent[]
}

interface HabitSpec {
  name: string
  description: string
  icon: string
  colorIdx: number
  frequency: HabitFrequency
  historyDays: number
  /** Si es true, hoy queda sin registrar para que el usuario pueda tocarlo. */
  pendingToday?: boolean
  /** El check-in falta cuando daysAgo % missEvery === missAt. */
  missEvery?: number
  missAt?: number
  /** 0 = lunes … 6 = domingo (solo para frecuencia weekly). */
  weekdays?: number[]
}

const HABIT_SPECS: HabitSpec[] = [
  {
    name: 'Beber agua',
    description: 'Ocho vasos al día, repartidos desde la mañana.',
    icon: 'droplets',
    colorIdx: 5,
    frequency: { type: 'daily', target_per_period: 8 },
    historyDays: 88,
    pendingToday: true,
    missEvery: 13,
    missAt: 5,
  },
  {
    name: 'Caminar 30 minutos',
    description: 'Una vuelta al aire libre después de comer.',
    icon: 'footprints',
    colorIdx: 1,
    frequency: { type: 'daily', target_per_period: 1 },
    historyDays: 75,
    pendingToday: true,
    missEvery: 11,
    missAt: 3,
  },
  {
    name: 'Meditar',
    description: 'Diez minutos de respiración para arrancar el día.',
    icon: 'brain',
    colorIdx: 0,
    frequency: { type: 'daily', target_per_period: 1 },
    historyDays: 70,
    missEvery: 9,
    missAt: 4,
  },
  {
    name: 'Leer',
    description: 'Un tramo de lectura antes de dormir.',
    icon: 'book',
    colorIdx: 2,
    frequency: { type: 'daily', target_per_period: 1 },
    historyDays: 66,
    pendingToday: true,
    missEvery: 7,
    missAt: 3,
  },
  {
    name: 'Entrenamiento',
    description: 'Fuerza y movilidad, tres veces por semana.',
    icon: 'dumbbell',
    colorIdx: 3,
    frequency: { type: 'weekly', target_per_period: 3 },
    historyDays: 84,
    weekdays: [1, 3, 5],
    missEvery: 17,
    missAt: 6,
  },
  {
    name: 'Practicar inglés',
    description: 'Veinte minutos de vocabulario y escucha.',
    icon: 'languages',
    colorIdx: 4,
    frequency: { type: 'weekly', target_per_period: 2 },
    historyDays: 80,
    weekdays: [2, 6],
    missEvery: 19,
    missAt: 5,
  },
  {
    name: 'Días sin azúcar',
    description: 'Evitar bebidas y golosinas de lunes a viernes.',
    icon: 'no-smoke',
    colorIdx: 7,
    frequency: { type: 'weekly', target_per_period: 5 },
    historyDays: 82,
    weekdays: [0, 1, 2, 3, 4],
    missEvery: 23,
    missAt: 9,
  },
  {
    name: 'Escribir',
    description: 'Un párrafo en el diario de proyectos.',
    icon: 'pencil',
    colorIdx: 6,
    frequency: { type: 'interval', target_per_period: 1, interval_days: 3 },
    historyDays: 84,
    missEvery: 21,
    missAt: 0,
  },
  {
    name: 'Ordenar la casa',
    description: 'Una ronda rápida de orden y limpieza.',
    icon: 'bath',
    colorIdx: 5,
    frequency: { type: 'interval', target_per_period: 1, interval_days: 7 },
    historyDays: 84,
    missEvery: 35,
    missAt: 0,
  },
]

interface TaskSpec {
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  dueDate: string
  colorIdx: number
  steps?: { title: string; done: boolean }[]
}

const TASK_SPECS: TaskSpec[] = [
  {
    title: 'Pagar el alquiler',
    description: 'Transferencia antes del día 10.',
    status: 'todo',
    dueDate: `${SAMPLE_YEAR}-01-10`,
    colorIdx: 0,
  },
  {
    title: 'Renovar el DNI',
    description: 'Sacar turno y llevar una foto actualizada.',
    status: 'todo',
    dueDate: `${SAMPLE_YEAR}-02-15`,
    colorIdx: 2,
  },
  {
    title: 'Presentar el informe mensual',
    description: 'Consolidar los números y enviar el resumen.',
    status: 'doing',
    dueDate: `${SAMPLE_YEAR}-01-25`,
    colorIdx: 5,
  },
  {
    title: 'Comprar un regalo',
    description: 'Algo para el cumpleaños de la semana que viene.',
    status: 'todo',
    dueDate: `${SAMPLE_YEAR}-03-05`,
    colorIdx: 4,
  },
  {
    title: 'Ordenar los archivos del trabajo',
    description: 'Papelera y carpetas del escritorio.',
    status: 'done',
    dueDate: `${SAMPLE_YEAR}-01-08`,
    colorIdx: 1,
  },
  {
    title: 'Inscribirme al curso',
    description: 'Completar la inscripción y pagar la primera cuota.',
    status: 'done',
    dueDate: `${SAMPLE_YEAR}-02-01`,
    colorIdx: 6,
  },
  {
    title: 'Planear el viaje',
    description: 'Definir fechas y presupuesto.',
    status: 'todo',
    dueDate: `${SAMPLE_YEAR}-04-12`,
    colorIdx: 7,
    steps: [
      { title: 'Reservar alojamiento', done: true },
      { title: 'Comprar pasajes', done: false },
      { title: 'Hacer la valija', done: false },
    ],
  },
]

interface GoalSpec {
  title: string
  description: string
  colorIdx: number
  target: number
  unit: string
  frequency: GoalFrequency
  createdAtDaysAgo: number
  logs: { daysAgo: number; amount: number }[]
}

const GOAL_SPECS: GoalSpec[] = [
  {
    title: 'Caminar 10.000 pasos',
    description: 'Meta diaria de actividad.',
    colorIdx: 1,
    target: 10_000,
    unit: 'pasos',
    frequency: { type: 'daily' },
    createdAtDaysAgo: 88,
    logs: [
      { daysAgo: 0, amount: 6_500 },
      { daysAgo: 1, amount: 8_000 },
      { daysAgo: 2, amount: 9_200 },
    ],
  },
  {
    title: 'Ir al gimnasio',
    description: 'Cuatro visitas por semana.',
    colorIdx: 3,
    target: 4,
    unit: 'veces',
    frequency: { type: 'weekly' },
    createdAtDaysAgo: 30,
    logs: [
      { daysAgo: 0, amount: 1 },
      { daysAgo: 1, amount: 1 },
      { daysAgo: 7, amount: 1 },
    ],
  },
  {
    title: 'Leer libros',
    description: 'Dos libros por mes.',
    colorIdx: 6,
    target: 2,
    unit: 'libros',
    frequency: { type: 'interval', interval_days: 30 },
    createdAtDaysAgo: 60,
    logs: [
      { daysAgo: 0, amount: 1 },
      { daysAgo: 35, amount: 1 },
    ],
  },
  {
    title: 'Correr 30 km',
    description: 'Kilómetros acumulados en la semana.',
    colorIdx: 5,
    target: 30,
    unit: 'km',
    frequency: { type: 'weekly' },
    createdAtDaysAgo: 45,
    logs: [
      { daysAgo: 0, amount: 7 },
      { daysAgo: 1, amount: 8 },
      { daysAgo: 8, amount: 5 },
    ],
  },
]

const NOTE_SPECS: { title: string; description: string; colorIdx: number }[] = [
  {
    title: 'Lista del súper',
    description: 'Frutas, verduras y lo básico para la semana.',
    colorIdx: 1,
  },
  {
    title: 'Ideas para el proyecto',
    description: 'Ordenar el backlog y definir los próximos milestones.',
    colorIdx: 0,
  },
  {
    title: 'Cómo va la semana',
    description: 'Buen ritmo de hábitos; falta consolidar la rutina de la mañana.',
    colorIdx: 5,
  },
  {
    title: 'Receta de emergencia',
    description: 'Pasta con ajo, aceite de oliva, pimienta y queso rallado.',
    colorIdx: 2,
  },
  {
    title: 'Regalos pendientes',
    description: 'Pensar ideas para el cumpleaños de noviembre.',
    colorIdx: 4,
  },
]

interface BlockSpec {
  title: string
  color: CreateScheduleBlockDraft['color']
  slots: { day_of_week: number; start_minutes: number; end_minutes: number }[]
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

const BLOCK_SPECS: BlockSpec[] = [
  {
    title: 'Trabajo',
    color: 'lavender',
    slots: range(0, 4).map((day_of_week) => ({
      day_of_week,
      start_minutes: 9 * 60,
      end_minutes: 12 * 60,
    })),
  },
  {
    title: 'Almuerzo',
    color: 'yellow',
    slots: range(0, 4).map((day_of_week) => ({
      day_of_week,
      start_minutes: 12 * 60 + 30,
      end_minutes: 13 * 60 + 30,
    })),
  },
  {
    title: 'Ejercicio',
    color: 'green',
    slots: [0, 2, 4].map((day_of_week) => ({
      day_of_week,
      start_minutes: 7 * 60,
      end_minutes: 8 * 60,
    })),
  },
  {
    title: 'Estudio',
    color: 'cyan',
    slots: [1, 3].map((day_of_week) => ({
      day_of_week,
      start_minutes: 19 * 60,
      end_minutes: 21 * 60,
    })),
  },
  {
    title: 'Casa',
    color: 'orange',
    slots: [{ day_of_week: 5, start_minutes: 10 * 60, end_minutes: 12 * 60 }],
  },
  {
    title: 'Descanso',
    color: 'pink',
    slots: [{ day_of_week: 6, start_minutes: 16 * 60, end_minutes: 17 * 60 }],
  },
]

interface EventSpec {
  date: string
  start: string
  end: string
  title: string
  description?: string
}

const EVENT_SPECS: EventSpec[] = [
  {
    date: `${SAMPLE_YEAR}-01-01`,
    start: '10:00',
    end: '13:00',
    title: 'Año Nuevo',
    description: 'Saludo familiar y mate.',
  },
  {
    date: `${SAMPLE_YEAR}-01-15`,
    start: '10:00',
    end: '11:00',
    title: 'Turno del dentista',
    description: 'Llevar la credencial de obra social.',
  },
  { date: `${SAMPLE_YEAR}-02-06`, start: '20:00', end: '23:00', title: 'Cumpleaños de Ana' },
  { date: `${SAMPLE_YEAR}-02-20`, start: '19:30', end: '21:30', title: 'Noche de cine' },
  { date: `${SAMPLE_YEAR}-03-04`, start: '09:00', end: '10:00', title: 'Reunión de equipo' },
  {
    date: `${SAMPLE_YEAR}-03-21`,
    start: '18:30',
    end: '20:30',
    title: 'Clase de cocina',
  },
  {
    date: `${SAMPLE_YEAR}-04-16`,
    start: '18:00',
    end: '19:30',
    title: 'Encuentro de lectura',
  },
  { date: `${SAMPLE_YEAR}-05-10`, start: '11:00', end: '11:45', title: 'Turno médico' },
  { date: `${SAMPLE_YEAR}-06-15`, start: '21:00', end: '23:00', title: 'Concierto' },
  { date: `${SAMPLE_YEAR}-07-09`, start: '11:00', end: '17:00', title: 'Salida con amigos' },
  { date: `${SAMPLE_YEAR}-08-22`, start: '08:00', end: '14:00', title: 'Viaje a la costa' },
  { date: `${SAMPLE_YEAR}-10-05`, start: '19:00', end: '22:00', title: 'Cena de aniversario' },
]

function habitColor(colorIdx: number): string {
  return HABIT_COLORS[colorIdx % HABIT_COLORS.length].value
}

function fmtDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/**
 * Genera el conjunto completo de datos de ejemplo. Es determinista: para la
 * misma fecha de referencia produce siempre exactamente los mismos datos.
 */
export function buildSampleData(today: Date = new Date()): SampleData {
  let seq = 0
  const nextUuid = (): string => {
    seq += 1
    return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`
  }

  const dateNDaysAgo = (n: number): Date =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - n)
  /** Timestamp ISO el mismo día a mediodía UTC (estable en cualquier zona). */
  const noonUtc = (dateStr: string): string => `${dateStr}T12:00:00.000Z`

  const habits: SampleHabit[] = []
  const habitLogs: SampleHabitLog[] = []

  HABIT_SPECS.forEach((spec, index) => {
    const createdDate = fmtDate(dateNDaysAgo(spec.historyDays))
    const habitId = nextUuid()
    habits.push({
      id: habitId,
      draft: {
        name: spec.name,
        description: spec.description,
        icon: spec.icon,
        color: habitColor(spec.colorIdx),
        frequency: spec.frequency,
        sort_order: index,
      },
      created_at: noonUtc(createdDate),
    })

    for (let daysAgo = 0; daysAgo <= spec.historyDays; daysAgo++) {
      if (spec.pendingToday && daysAgo === 0) continue
      if (
        spec.missEvery !== undefined &&
        spec.missAt !== undefined &&
        daysAgo % spec.missEvery === spec.missAt
      ) {
        continue
      }
      const date = dateNDaysAgo(daysAgo)
      if (spec.frequency.type === 'weekly') {
        const dayOfWeek = (date.getDay() + 6) % 7 // 0 = lunes
        if (!spec.weekdays?.includes(dayOfWeek)) continue
      } else if (spec.frequency.type === 'interval') {
        if (daysAgo % spec.frequency.interval_days !== 0) continue
      }
      const logDate = fmtDate(date)
      habitLogs.push({
        id: nextUuid(),
        habit_id: habitId,
        log_date: logDate,
        count: 1,
        created_at: noonUtc(logDate),
      })
    }
  })

  const tasks: SampleTask[] = TASK_SPECS.map((spec, index) => {
    const createdAt = noonUtc(fmtDate(today))
    return {
      id: nextUuid(),
      draft: {
        title: spec.title,
        description: spec.description,
        color: habitColor(spec.colorIdx),
        status: spec.status,
        due_date: spec.dueDate,
        steps: (spec.steps ?? []).map((step) => ({
          id: nextUuid(),
          title: step.title,
          done: step.done,
        })),
        sort_order: index,
      },
      created_at: createdAt,
    }
  })

  const goals: SampleGoal[] = []
  const goalLogs: SampleGoalLog[] = []
  GOAL_SPECS.forEach((spec, index) => {
    const goalId = nextUuid()
    goals.push({
      id: goalId,
      draft: {
        title: spec.title,
        description: spec.description,
        color: habitColor(spec.colorIdx),
        target: spec.target,
        unit: spec.unit,
        frequency: spec.frequency,
        sort_order: index,
      },
      created_at: noonUtc(fmtDate(dateNDaysAgo(spec.createdAtDaysAgo))),
    })
    for (const log of spec.logs) {
      const logDate = fmtDate(dateNDaysAgo(log.daysAgo))
      goalLogs.push({
        id: nextUuid(),
        goal_id: goalId,
        log_date: logDate,
        amount: log.amount,
        created_at: noonUtc(logDate),
      })
    }
  })

  const notes: SampleNote[] = NOTE_SPECS.map((spec) => ({
    id: nextUuid(),
    draft: {
      title: spec.title,
      description: spec.description,
      color: habitColor(spec.colorIdx),
    },
    created_at: noonUtc(fmtDate(today)),
  }))

  const scheduleBlocks: SampleScheduleBlock[] = BLOCK_SPECS.map((spec, index) => ({
    id: nextUuid(),
    draft: {
      title: spec.title,
      color: spec.color,
      sort_order: index,
    },
    created_at: noonUtc(fmtDate(today)),
    slots: spec.slots.map((slot) => ({
      id: nextUuid(),
      draft: slot,
      created_at: noonUtc(fmtDate(today)),
    })),
  }))

  const eventColors = Object.values(CALENDAR_COLORS)
  const calendarEvents = EVENT_SPECS.map((spec, index) =>
    CalendarEventSchema.parse({
      id: `local_sample_${String(index + 1).padStart(2, '0')}`,
      date: spec.date,
      title: spec.title,
      color: index === 0 ? DEFAULT_EVENT_COLOR : eventColors[index % eventColors.length],
      calendarId: 'local',
      start: `${spec.date}T${spec.start}:00.000Z`,
      end: `${spec.date}T${spec.end}:00.000Z`,
      description: spec.description ?? undefined,
    })
  )

  return {
    habits,
    habitLogs,
    tasks,
    goals,
    goalLogs,
    notes,
    scheduleBlocks,
    calendarEvents,
  }
}
