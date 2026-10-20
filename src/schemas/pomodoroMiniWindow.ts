import { z } from 'zod'

/**
 * Estado persistido de la ventana mini del pomodoro: si el usuario la dejó
 * abierta y dónde quedó. Vive en la tabla `config` como JSON validado acá.
 */
export const PomodoroMiniWindowStateSchema = z.object({
  /** true si la mini quedó abierta: se reabre sola en el próximo arranque. */
  isOpen: z.boolean().default(false),
  /** Última posición guardada en píxeles lógicos; null = nunca se movió. */
  x: z.number().finite().nullable().default(null),
  y: z.number().finite().nullable().default(null),
})
export type PomodoroMiniWindowState = z.infer<typeof PomodoroMiniWindowStateSchema>

/** Primera ejecución: sin mini abierta y sin posición guardada. */
export const defaultPomodoroMiniWindowState: PomodoroMiniWindowState =
  PomodoroMiniWindowStateSchema.parse({})

/** Estado persistido → estado válido; cualquier corrupción cae al default. */
export function parsePomodoroMiniWindowStateJson(
  raw: string | null | undefined
): PomodoroMiniWindowState {
  if (!raw) return defaultPomodoroMiniWindowState
  try {
    const parsed = PomodoroMiniWindowStateSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return defaultPomodoroMiniWindowState
    return { isOpen: parsed.data.isOpen, x: parsed.data.x, y: parsed.data.y }
  } catch {
    return defaultPomodoroMiniWindowState
  }
}
