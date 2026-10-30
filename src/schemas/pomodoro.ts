import { z } from 'zod'
import { isoTimestamp } from './primitives'

export const PomodoroPhaseSchema = z.enum(['idle', 'focus', 'shortBreak', 'longBreak'])
export type PomodoroPhase = z.infer<typeof PomodoroPhaseSchema>

const positiveMinutes = z.number().int().min(1).max(1440)

export const PomodoroSettingsSchema = z.object({
  focusMinutes: positiveMinutes.default(25),
  shortBreakMinutes: positiveMinutes.default(5),
  longBreakMinutes: positiveMinutes.default(15),
  longBreakInterval: z.number().int().min(1).max(100).default(4),
  autoStartBreak: z.boolean().default(true),
  autoStartFocus: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(0.3),
  muted: z.boolean().default(false),
})
export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>

export const defaultPomodoroSettings: PomodoroSettings = PomodoroSettingsSchema.parse({})

export const ActivePomodoroSessionSchema = z
  .object({
    phase: z.enum(['focus', 'shortBreak', 'longBreak']),
    isRunning: z.boolean(),
    endsAt: isoTimestamp.nullable(),
    remainingMs: z.number().int().nonnegative().nullable(),
    completedFocusSessions: z.number().int().nonnegative(),
  })
  .superRefine((session, ctx) => {
    if (session.isRunning && (session.endsAt === null || session.remainingMs !== null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Una sesión corriendo requiere endsAt sin remainingMs',
      })
    }
    if (!session.isRunning && (session.endsAt !== null || session.remainingMs === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Una sesión pausada requiere remainingMs sin endsAt',
      })
    }
  })
export type ActivePomodoroSession = z.infer<typeof ActivePomodoroSessionSchema>

/**
 * Snapshot del estado del pomodoro que una ventana publica al resto cuando muta.
 * `origin` identifica a la ventana emisora para que no aplique su propio eco ni
 * vuelva a escribir lo que ya persistió.
 */
export const PomodoroSyncPayloadSchema = z.object({
  origin: z.string().min(1),
  settings: PomodoroSettingsSchema,
  session: ActivePomodoroSessionSchema,
})
export type PomodoroSyncPayload = z.infer<typeof PomodoroSyncPayloadSchema>
