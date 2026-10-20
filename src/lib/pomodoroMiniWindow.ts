import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Label único de la ventana mini: la identifica como singleton entre webviews. */
export const POMODORO_MINI_LABEL = 'pomodoro-mini'

/** Título a nivel de sistema de la ventana mini. */
export const POMODORO_MINI_TITLE = 'AEON — Pomodoro'

/** Geometría fija de la ventana mini, en píxeles lógicos. */
export const POMODORO_MINI_WIDTH = 300
export const POMODORO_MINI_HEIGHT = 320

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Esquina inferior derecha del área dada, para una ventana del tamaño dado. */
function bottomRightPlacement(area: Rect, width: number, height: number): { x: number; y: number } {
  return { x: area.x + area.width - width, y: area.y + area.height - height }
}

/** Rectángulo del monitor en píxeles lógicos (los que espera la API de ventanas). */
function monitorRect(monitor: Monitor): Rect {
  const size = monitor.size.toLogical(monitor.scaleFactor)
  const position = monitor.position.toLogical(monitor.scaleFactor)
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

/** true cuando esta webview es la ventana mini: decide el arranque del frontend. */
export function isPomodoroMiniWindow(): boolean {
  return getCurrentWebviewWindow().label === POMODORO_MINI_LABEL
}

/**
 * Abre la ventana mini como singleton: si ya existe la enfoca; si no, la crea
 * fija, siempre arriba y en la esquina inferior derecha del monitor donde está
 * la ventana principal.
 */
export async function openPomodoroMiniWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(POMODORO_MINI_LABEL)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }

  const monitor = await currentMonitor()
  const placement = monitor
    ? bottomRightPlacement(monitorRect(monitor), POMODORO_MINI_WIDTH, POMODORO_MINI_HEIGHT)
    : {}

  // La creación es fire-and-forget: Tauri avisa con `tauri://created`/`tauri://error`.
  new WebviewWindow(POMODORO_MINI_LABEL, {
    url: 'index.html',
    title: POMODORO_MINI_TITLE,
    width: POMODORO_MINI_WIDTH,
    height: POMODORO_MINI_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    decorations: true,
    ...placement,
  })
}
