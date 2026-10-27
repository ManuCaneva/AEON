import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PomodoroMini from '@/components/pomodoro/PomodoroMini.vue'
import { useTheme } from '@/composables/useTheme'
import { closePomodoroMiniWindow, trackPomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'
import { showPomodoroInMainWindow } from '@/lib/pomodoroMainWindow'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'

/**
 * Clase del documento para la ventana de la mascota: el fondo de la app queda
 * transparente y solo se ve el disco. La misma `index.html` corre la app
 * grande, así que el cambio se hace acá y no en el CSS base.
 */
export const ORB_WINDOW_CLASS = 'orb-window'

/**
 * Arranque de la ventana de la mascota: tema y escala de texto propios de la
 * ventana, más el disco del pomodoro sobre el store compartido. Ningún dominio
 * de la app se carga acá: la mascota es solo el pomodoro.
 */
export async function bootPomodoroMini(): Promise<void> {
  // La mascota se sigue a sí misma: persiste su disposición y el cierre con la
  // pastilla, aunque la ventana que la creó ya no exista.
  trackPomodoroMiniWindow()
  document.documentElement.classList.add(ORB_WINDOW_CLASS)
  // La pastilla no navega por cuenta propia: le pide a la ventana principal
  // que aparezca en la página Pomodoro, y el botón de cerrar destruye la ventana.
  const app = createApp(PomodoroMini, {
    onGo: () => void showPomodoroInMainWindow(),
    onClose: () => void closePomodoroMiniWindow(),
  })
  app.use(createPinia())
  useTheme()
  // El store de UI es el dueño de `--text-scale`; la mascota no usa nada más de él.
  useUiStore()
  app.mount('#app')

  // Único punto donde la ventana de la mascota arranca el reloj del pomodoro.
  const pomodoro = usePomodoroStore()
  await pomodoro.load()
  pomodoro.startTicker()
}
