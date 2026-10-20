import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { PhysicalPosition } from '@tauri-apps/api/dpi'
import {
  loadPomodoroMiniWindowState,
  savePomodoroMiniWindowState,
} from '@/lib/pomodoroMiniWindowState'
import type { PomodoroMiniWindowState } from '@/schemas/pomodoroMiniWindow'

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
 * fija, siempre arriba y en la posición donde quedó (o en la esquina inferior
 * derecha del monitor de la principal si nunca se movió). Deja el flag de
 * apertura persistido para que el próximo arranque la reabra.
 */
export async function openPomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  await savePomodoroMiniWindowState({ isOpen: true, x: state.x, y: state.y })
  await presentPomodoroMiniWindow(state)
}

/**
 * Arranque de la app: reabre la ventana mini solo si el usuario la dejó abierta,
 * en la posición donde quedó. No mira el temporizador: la disposición de pantalla
 * es independiente del estado del pomodoro.
 */
export async function restorePomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  if (state.isOpen) await presentPomodoroMiniWindow(state)
}

async function presentPomodoroMiniWindow(state: PomodoroMiniWindowState): Promise<void> {
  const existing = await WebviewWindow.getByLabel(POMODORO_MINI_LABEL)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }

  const placement =
    state.x !== null && state.y !== null
      ? { x: state.x, y: state.y }
      : await bottomRightOnMainMonitor()

  // La creación es fire-and-forget: Tauri avisa con `tauri://created`/`tauri://error`.
  const win = new WebviewWindow(POMODORO_MINI_LABEL, {
    url: 'index.html',
    title: POMODORO_MINI_TITLE,
    width: POMODORO_MINI_WIDTH,
    height: POMODORO_MINI_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    decorations: true,
    ...placement,
  })
  trackPomodoroMiniWindow(win)
}

/** Espera tras el último movimiento: una sola escritura por arrastre. */
const POSITION_SAVE_DELAY_MS = 250

/** Ventanas ya seguidas: cada instancia se registra una sola vez. */
const trackedWindows = new WeakSet<WebviewWindow>()

let pendingPosition: PhysicalPosition | null = null
let positionTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Sigue la ventana mini para persistir su disposición de pantalla. El flag de
 * apertura solo se escribe en las acciones del usuario (abrir, cerrar con la X):
 * la destrucción de la ventana por el cierre de la app no pasa por acá y deja
 * el flag como estaba, así la próxima sesión la reabre.
 */
function trackPomodoroMiniWindow(win: WebviewWindow): void {
  if (trackedWindows.has(win)) return
  trackedWindows.add(win)

  void win.onMoved((event) => {
    pendingPosition = event.payload
    if (positionTimer !== undefined) clearTimeout(positionTimer)
    positionTimer = setTimeout(() => {
      positionTimer = undefined
      // La ventana existe: mientras se mueve está abierta.
      return flushMiniWindowState(win, true)
    }, POSITION_SAVE_DELAY_MS)
  })

  void win.onCloseRequested(() => {
    if (positionTimer !== undefined) {
      clearTimeout(positionTimer)
      positionTimer = undefined
    }
    return flushMiniWindowState(win, false)
  })
}

/** Persiste el flag indicado junto a la última posición pendiente (si hay). */
async function flushMiniWindowState(win: WebviewWindow, isOpen: boolean): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  let { x, y } = state
  if (pendingPosition) {
    const logical = pendingPosition.toLogical(await win.scaleFactor())
    x = logical.x
    y = logical.y
    pendingPosition = null
  }
  await savePomodoroMiniWindowState({ isOpen, x, y })
}

/** Esquina inferior derecha del monitor donde está la ventana principal. */
async function bottomRightOnMainMonitor(): Promise<{ x?: number; y?: number }> {
  const monitor = await currentMonitor()
  return monitor
    ? bottomRightPlacement(monitorRect(monitor), POMODORO_MINI_WIDTH, POMODORO_MINI_HEIGHT)
    : {}
}
