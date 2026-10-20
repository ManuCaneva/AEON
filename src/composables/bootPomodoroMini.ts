import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PomodoroMini from '@/components/pomodoro/PomodoroMini.vue'
import { useTheme } from '@/composables/useTheme'
import { showPomodoroInMainWindow } from '@/lib/pomodoroMainWindow'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'

/**
 * Arranque de la ventana mini: tema y escala de texto propios de la ventana,
 * más la réplica del widget sobre el store compartido. Ningún dominio de la
 * app se carga acá: la mini es solo el pomodoro.
 */
export async function bootPomodoroMini(): Promise<void> {
  // El título de la mini no navega por cuenta propia: le pide a la ventana
  // principal que aparezca en la página Pomodoro.
  const app = createApp(PomodoroMini, {
    onHeaderActivate: () => void showPomodoroInMainWindow(),
  })
  app.use(createPinia())
  useTheme()
  // El store de UI es el dueño de `--text-scale`; la mini no usa nada más de él.
  useUiStore()
  app.mount('#app')

  // Único punto donde la ventana mini arranca el reloj del pomodoro.
  const pomodoro = usePomodoroStore()
  await pomodoro.load()
  pomodoro.startTicker()
}
