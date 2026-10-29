// En DEV la app puede abrirse en un navegador común (sin Tauri): este módulo
// instala el stub de tests/perf/inject-stub.js como IPC antes de que arranque la
// app (va como primer import de main.ts). Sin él, el boot crashea con
// "Cannot read properties of undefined (reading 'metadata')" y renderiza vacío.
// Gates: solo DEV y solo si no hay Tauri de verdad. En producción el if colapsa
// a false y el bundle elimina este módulo y el stub.

import stubSource from '../../tests/perf/inject-stub.js?raw'

declare global {
  interface Window {
    __perfParams?: Record<string, string | number | undefined>
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
  // Deja solo el widget del Calendario Anual con datos de fixture: el contexto
  // más directo para probar el calendario en el navegador.
  window.__perfParams = { perfFocus: 'year-calendar' }
  new Function(stubSource)()
}

export {}
