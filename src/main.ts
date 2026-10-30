// Dev: instala el stub de IPC de Tauri si la app se abre en un navegador común.
import './lib/devBrowserStub'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tailwind.css'
import { seedSampleDataIfFirstRun } from '@/composables/seedSampleData'
import { bootPomodoroMini } from '@/composables/bootPomodoroMini'
import { isPomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'

if (isPomodoroMiniWindow()) {
  // La ventana de la mascota solo monta el pomodoro: nada del arranque de la app corre acá.
  void bootPomodoroMini()
} else {
  const app = createApp(App)
  app.use(createPinia())
  // La siembra corre antes del mount para que los stores arranquen con los datos
  // de ejemplo ya escritos. finally garantiza que la app monte pase lo que pase.
  void seedSampleDataIfFirstRun().finally(() => app.mount('#app'))
}
