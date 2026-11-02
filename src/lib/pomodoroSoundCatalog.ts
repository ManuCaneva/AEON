import bellSrc from '@/assets/sounds/pomodoro/mixkit-bell-notification-933.wav'
import happyBellsSrc from '@/assets/sounds/pomodoro/mixkit-happy-bells-notification-937.wav'
import interfaceBackSrc from '@/assets/sounds/pomodoro/mixkit-software-interface-back-2575.wav'
import urgentToneSrc from '@/assets/sounds/pomodoro/mixkit-urgent-simple-tone-loop-2976.wav'
import type { PomodoroSoundId } from '@/schemas/pomodoro'

export interface PomodoroSoundOption {
  id: PomodoroSoundId
  label: string
  src: string
}

/**
 * Catálogo de alarmas empaquetadas con la app. El orden es el que ve la
 * configuración; la primera es la alarma por defecto.
 */
export const POMODORO_SOUND_OPTIONS = [
  { id: 'bell', label: 'Campana', src: bellSrc },
  { id: 'happy-bells', label: 'Campanas alegres', src: happyBellsSrc },
  { id: 'interface-back', label: 'Interfaz', src: interfaceBackSrc },
  { id: 'urgent-tone', label: 'Tono urgente', src: urgentToneSrc },
] as const satisfies readonly PomodoroSoundOption[]
