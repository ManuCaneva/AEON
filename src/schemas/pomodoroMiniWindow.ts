import { z } from 'zod'

/**
 * Estado persistido de la mascota del pomodoro: si el usuario la dejó abierta,
 * dónde quedó el disco y qué diámetro le dio. Vive en la tabla `config` como
 * JSON validado acá. El tamaño es opcional: los estados guardados cuando la
 * mini era rectangular siguen siendo válidos (el ancho pasa a ser el diámetro).
 */
export const PomodoroMiniWindowStateSchema = z.object({
  /** true si la mascota quedó abierta: se reabre sola en el próximo arranque. */
  isOpen: z.boolean().default(false),
  /** Última posición del disco guardada en píxeles lógicos; null = nunca se movió. */
  x: z.number().finite().nullable().default(null),
  y: z.number().finite().nullable().default(null),
  /** Último diámetro guardado en píxeles lógicos; null = nunca se redimensionó. */
  width: z.number().finite().positive().nullable().default(null),
  height: z.number().finite().positive().nullable().default(null),
})
export type PomodoroMiniWindowState = z.infer<typeof PomodoroMiniWindowStateSchema>

/** Primera ejecución: sin mini abierta y sin posición ni tamaño guardados. */
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
    return {
      isOpen: parsed.data.isOpen,
      x: parsed.data.x,
      y: parsed.data.y,
      width: parsed.data.width,
      height: parsed.data.height,
    }
  } catch {
    return defaultPomodoroMiniWindowState
  }
}
