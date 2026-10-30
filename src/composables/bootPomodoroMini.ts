import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import PomodoroMini from '@/components/pomodoro/PomodoroMini.vue'
import { useTheme } from '@/composables/useTheme'
import {
  applyPomodoroMiniWindowShape,
  showReadyPomodoroMiniWindow,
  trackPomodoroMiniWindow,
} from '@/lib/pomodoroMiniWindow'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'

/**
 * Clase del documento para las ventanas de la mascota: el fondo de la app queda
 * transparente y solo se ve el contenido. La misma `index.html` corre la app
 * grande, así que el cambio se hace acá y no en el CSS base.
 */
export const ORB_WINDOW_CLASS = 'orb-window'

/**
 * Arranque de la ventana de la mascota: tema y escala de texto propios de la
 * ventana, más el disco y la pastilla del pomodoro sobre el store compartido.
 * Las dos piezas viven en la misma superficie.
 */
export async function bootPomodoroMini(): Promise<void> {
  // El disco se sigue a sí mismo: persiste su posición aunque la ventana que lo
  // creó ya no exista.
  trackPomodoroMiniWindow()
  document.documentElement.classList.add(ORB_WINDOW_CLASS)

  const app = createApp(PomodoroMini)
  app.use(createPinia())
  useTheme()
  // El store de UI es el dueño de `--text-scale`; el disco no usa nada más de él.
  useUiStore()
  app.mount('#app')

  // Único punto donde la ventana del disco arranca el reloj del pomodoro.
  const pomodoro = usePomodoroStore()
  await pomodoro.load()
  pomodoro.startTicker()
  await nextTick()
  // Nunca exponer la superficie rectangular de arranque al compositor.
  await applyPomodoroMiniWindowShape()
  await showReadyPomodoroMiniWindow()
}
