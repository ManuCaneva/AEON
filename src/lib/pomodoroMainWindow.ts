import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { focusWindow, windowExists } from '@/lib/appWindows'

/** Label de la ventana principal de la app (el de `tauri.conf.json`). */
export const POMODORO_MAIN_LABEL = 'main'

/** Evento con el que la ventana mini le pide a la principal abrir la página Pomodoro. */
export const SHOW_POMODORO_IN_MAIN_EVENT = 'pomodoro-show-in-main'

/**
 * Geometría de la ventana principal, espejo de `src-tauri/tauri.conf.json`:
 * la ventana recreada debe abrir igual que la del arranque.
 */
const MAIN_WINDOW_OPTIONS = {
  title: 'AEON',
  width: 800,
  height: 600,
  minWidth: 600,
  minHeight: 400,
  maximized: true,
} as const

/** Consulta de arranque con la que se pide abrir la app en la página Pomodoro. */
const POMODORO_VIEW_PARAM = 'view'
const POMODORO_VIEW_VALUE = 'pomodoro'

/** URL de la ventana principal cuando se la crea ya pedida en la página Pomodoro. */
const POMODORO_MAIN_URL = `index.html?${new URLSearchParams({
  [POMODORO_VIEW_PARAM]: POMODORO_VIEW_VALUE,
})}`

/** true cuando la URL de arranque pide abrir la app en la página Pomodoro. */
export function requestsPomodoroView(search: string): boolean {
  return new URLSearchParams(search).get(POMODORO_VIEW_PARAM) === POMODORO_VIEW_VALUE
}

/** Suscribe la ventana principal a los pedidos de la mini de abrir la página Pomodoro. */
export function onShowPomodoroInMain(handler: () => void): Promise<UnlistenFn> {
  return listen(SHOW_POMODORO_IN_MAIN_EVENT, handler)
}

/**
 * Trae la ventana principal al frente con la página Pomodoro abierta. La
 * navegación en sí vive en la store `ui` de la ventana principal; acá solo se
 * la pide con un evento entre ventanas. Si la principal está cerrada, se
 * recrea abierta ya en esa página: la URL es la única forma de pedirle la vista
 * a una ventana que recién arranca.
 */
export async function showPomodoroInMainWindow(): Promise<void> {
  if (!(await windowExists(POMODORO_MAIN_LABEL))) {
    new WebviewWindow(POMODORO_MAIN_LABEL, {
      ...MAIN_WINDOW_OPTIONS,
      url: POMODORO_MAIN_URL,
    })
    return
  }

  await emit(SHOW_POMODORO_IN_MAIN_EVENT)
  await focusWindow(POMODORO_MAIN_LABEL)
}
