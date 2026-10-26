import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import {
  loadPomodoroMiniWindowState,
  savePomodoroMiniWindowState,
} from '@/lib/pomodoroMiniWindowState'
import { focusWindow, windowExists } from '@/lib/appWindows'
import type { PomodoroMiniWindowState } from '@/schemas/pomodoroMiniWindow'

/** Label único de la ventana mini: la identifica como singleton entre webviews. */
export const POMODORO_MINI_LABEL = 'pomodoro-mini'

/** Título a nivel de sistema de la ventana mini. */
export const POMODORO_MINI_TITLE = 'AEON — Pomodoro'

/** Tamaño por defecto de la ventana mini, en píxeles lógicos. */
export const POMODORO_MINI_WIDTH = 210
export const POMODORO_MINI_HEIGHT = 224

/**
 * Mínimos de la mini redimensionable, en píxeles lógicos: por debajo de esto
 * el contador y los controles ya no entran en el disco.
 */
export const POMODORO_MINI_MIN_WIDTH = 140
export const POMODORO_MINI_MIN_HEIGHT = 150

/** Tamaño con el que se abre la mini: el guardado del usuario, nunca bajo el mínimo. */
function resolvedSize(state: PomodoroMiniWindowState): { width: number; height: number } {
  return {
    width:
      state.width === null ? POMODORO_MINI_WIDTH : Math.max(POMODORO_MINI_MIN_WIDTH, state.width),
    height:
      state.height === null
        ? POMODORO_MINI_HEIGHT
        : Math.max(POMODORO_MINI_MIN_HEIGHT, state.height),
  }
}

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
 * redimensionable (nunca más chica que sus mínimos), siempre arriba y en la
 * posición y el tamaño donde quedó (o en la esquina inferior derecha del
 * monitor de la principal si nunca se movió). Es la acción explícita del
 * usuario (botón pop-out): la única que enfoca la mini. Deja el flag de
 * apertura persistido para que el próximo arranque la reabra.
 */
export async function openPomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  await savePomodoroMiniWindowState({ ...state, isOpen: true })
  await showPomodoroMiniWindow(state, { focus: true })
}

/**
 * Arranque de la app: reabre la ventana mini solo si el usuario la dejó abierta,
 * en la posición donde quedó. No mira el temporizador: la disposición de pantalla
 * es independiente del estado del pomodoro. Nunca enfoca: la restauración no
 * roba la atención y el foco no rebota a la mini cuando se recrea la ventana
 * principal desde su título.
 */
export async function restorePomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  if (state.isOpen) await showPomodoroMiniWindow(state, { focus: false })
}

/**
 * Deja la mini visible en la posición y el tamaño dados. `focus` distingue los
 * dos caminos: la acción del usuario la trae al frente y la enfoca; la
 * restauración solo la crea si falta, sin tocar el foco de nadie.
 */
async function showPomodoroMiniWindow(
  state: PomodoroMiniWindowState,
  { focus }: { focus: boolean }
): Promise<void> {
  if (await windowExists(POMODORO_MINI_LABEL)) {
    if (focus) await focusWindow(POMODORO_MINI_LABEL)
    return
  }

  const { width, height } = resolvedSize(state)
  const placement =
    state.x !== null && state.y !== null
      ? { x: state.x, y: state.y }
      : await bottomRightOnMainMonitor(width, height)

  // La creación es fire-and-forget: Tauri avisa con `tauri://created`/`tauri://error`.
  new WebviewWindow(POMODORO_MINI_LABEL, {
    url: 'index.html',
    title: POMODORO_MINI_TITLE,
    width,
    height,
    minWidth: POMODORO_MINI_MIN_WIDTH,
    minHeight: POMODORO_MINI_MIN_HEIGHT,
    resizable: true,
    alwaysOnTop: true,
    decorations: true,
    focus,
    ...placement,
  })
}

/** Espera tras el último gesto (mover o redimensionar): una sola escritura por gesto. */
const LAYOUT_SAVE_DELAY_MS = 250

/** Ventanas ya seguidas: cada instancia se registra una sola vez. */
const trackedWindows = new WeakSet<WebviewWindow>()

let pendingPosition: PhysicalPosition | null = null
let pendingSize: PhysicalSize | null = null
let layoutTimer: ReturnType<typeof setTimeout> | undefined

/**
 * La ventana mini persiste su propia disposición de pantalla (posición y
 * tamaño). Se registra sobre su propia webview y no sobre el handle de quien la
 * creó: con la ventana principal cerrada nadie más la seguiría y la X no se
 * escribiría. El flag de apertura solo se escribe en las acciones del usuario
 * (abrir, cerrar con la X): la destrucción de la ventana por el cierre de la
 * app no pasa por acá y deja el flag como estaba, así la próxima sesión la
 * reabre. El cierre lo coordina el store (marca `windowClosing` y espera el
 * guardado antes de destruir), así la X no compite contra la escritura del estado.
 */
export function trackPomodoroMiniWindow(): void {
  const win = getCurrentWebviewWindow()
  if (trackedWindows.has(win)) return
  trackedWindows.add(win)

  function programarGuardado(): void {
    if (layoutTimer !== undefined) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => {
      layoutTimer = undefined
      // La ventana existe: mientras se mueve o se redimensiona está abierta.
      return flushMiniWindowState(win, true)
    }, LAYOUT_SAVE_DELAY_MS)
  }

  void win.onMoved((event) => {
    pendingPosition = event.payload
    programarGuardado()
  })
  void win.onResized((event) => {
    pendingSize = event.payload
    programarGuardado()
  })
}

/**
 * Persiste el cierre de la mini por la X: deja el flag de apertura en false y
 * guarda la última disposición pendiente. La espera el handler de cierre del
 * store antes de que Tauri destruya la ventana: si el destroy gana la carrera,
 * el cierre no se guarda y la mini reaparece en el próximo arranque.
 */
export async function flushPomodoroMiniWindowClosed(): Promise<void> {
  if (layoutTimer !== undefined) {
    clearTimeout(layoutTimer)
    layoutTimer = undefined
  }
  await flushMiniWindowState(getCurrentWebviewWindow(), false)
}

/** Persiste el flag indicado junto a la última posición y tamaño pendientes (si hay). */
async function flushMiniWindowState(win: WebviewWindow, isOpen: boolean): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  let { x, y, width, height } = state
  if (pendingPosition) {
    const logical = pendingPosition.toLogical(await win.scaleFactor())
    x = logical.x
    y = logical.y
    pendingPosition = null
  }
  if (pendingSize) {
    const logical = pendingSize.toLogical(await win.scaleFactor())
    width = logical.width
    height = logical.height
    pendingSize = null
  }
  await savePomodoroMiniWindowState({ isOpen, x, y, width, height })
}

/** Esquina inferior derecha del monitor donde está la ventana principal. */
async function bottomRightOnMainMonitor(
  width: number,
  height: number
): Promise<{ x?: number; y?: number }> {
  const monitor = await currentMonitor()
  return monitor ? bottomRightPlacement(monitorRect(monitor), width, height) : {}
}
