import { z } from 'zod'
import { hexColor } from './primitives'

export const CalendarEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  color: hexColor,
  calendarId: z.string(),
  start: z.string(),
  end: z.string(),
  description: z.string().optional(),
})

export type CalendarEvent = z.infer<typeof CalendarEventSchema>

// Punto de overlay del calendario anual: una capa derivada que se pinta como
// un punto de día más, sin entrar en el CRUD del calendario. La usa el widget
// para pintar exámenes sin crear eventos espejo. `color` ya llega listo para
// usar (token de Bloque resuelto a variable CSS, o hex de respaldo).
export interface DayOverlayDot {
  id: string
  color: string
}

export type DayOverlayByDate = Map<string, DayOverlayDot[]>

const GcalDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
})

const GcalEventItemSchema = z.object({
  id: z.string(),
  summary: z.string().optional().default(''),
  start: GcalDateTimeSchema,
  end: GcalDateTimeSchema,
  colorId: z.string().optional(),
  description: z.string().optional(),
})

export const GcalEventApiResponseSchema = z.object({
  items: z.array(GcalEventItemSchema).optional().default([]),
})

export type GcalEventApiResponse = z.infer<typeof GcalEventApiResponseSchema>

export const GcalVisibleCalendarsSchema = z.object({
  hiddenCalendarIds: z.array(z.string()).default([]),
})
export type GcalVisibleCalendars = z.infer<typeof GcalVisibleCalendarsSchema>
export const DEFAULT_GCAL_VISIBLE_CALENDARS: GcalVisibleCalendars =
  GcalVisibleCalendarsSchema.parse({})

export function parseGcalVisibleCalendarsJson(
  raw: string | null | undefined
): GcalVisibleCalendars {
  if (!raw) return { hiddenCalendarIds: [] }
  try {
    const parsed = GcalVisibleCalendarsSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return { hiddenCalendarIds: [] }
    return { hiddenCalendarIds: [...parsed.data.hiddenCalendarIds] }
  } catch {
    return { hiddenCalendarIds: [] }
  }
}

export const CALENDAR_COLORS: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6bf26',
  '6': '#f5511d',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#c0c0c0',
}

export function toLocalDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return null
  }
}

export const DEFAULT_EVENT_COLOR = '#6e56cf'

export function resolveEventColor(
  colorId: string | undefined,
  calendarColor: string | undefined
): string {
  if (colorId && CALENDAR_COLORS[colorId]) return CALENDAR_COLORS[colorId]
  return calendarColor ?? DEFAULT_EVENT_COLOR
}
