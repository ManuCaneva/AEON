import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tailwind.css'
import { seedSampleDataIfFirstRun } from '@/composables/seedSampleData'

const app = createApp(App)
app.use(createPinia())

// La siembra corre antes del mount para que los stores arranquen con los datos
// de ejemplo ya escritos. finally garantiza que la app monte pase lo que pase.
void seedSampleDataIfFirstRun().finally(() => app.mount('#app'))
