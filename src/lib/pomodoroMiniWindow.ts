import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import {
  loadPomodoroMiniWindowState,
  savePomodoroMiniWindowState,
} from '@/lib/pomodoroMiniWindowState'
import { focusWindow, windowExists } from '@/lib/appWindows'
import {
  clampOrbDiameter,
  resolveOrbDiameter,
  POMODORO_ORB_MIN_DIAMETER,
  type OrbRect,
} from '@/lib/pomodoroMiniLayout'
import type { PomodoroMiniWindowState } from '@/schemas/pomodoroMiniWindow'

/** Label único de la ventana de la mascota: la identifica como singleton. */
export const POMODORO_MINI_LABEL = 'pomodoro-mini'

/** Título a nivel de sistema de la ventana de la mascota. */
export const POMODORO_MINI_TITLE = 'AEON — Pomodoro'

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

/** Rectángulo lógico del monitor donde está la mascota, o null si no hay. */
export async function currentLogicalMonitorRect(): Promise<Rect | null> {
  const monitor = await currentMonitor()
  return monitor ? monitorRect(monitor) : null
}

/** true cuando esta webview es la mascota: decide el arranque del frontend. */
export function isPomodoroMiniWindow(): boolean {
  return getCurrentWebviewWindow().label === POMODORO_MINI_LABEL
}

/**
 * Abre la mascota como singleton: si ya existe la enfoca; si no, la crea como
 * disco cuadrado sin decoraciones (transparente, siempre arriba y fuera de la
 * taskbar), del tamaño que la dejó el usuario (nunca fuera del rango) y en la
 * posición donde quedó (o en la esquina inferior derecha del monitor de la
 * principal si nunca se movió). Es la acción explícita del usuario (botón
 * pop-out): la única que enfoca la mascota. Deja el flag de apertura persistido
 * para que el próximo arranque la reabra.
 */
export async function openPomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  await savePomodoroMiniWindowState({ ...state, isOpen: true })
  await showPomodoroMiniWindow(state, { focus: true })
}

/**
 * Arranque de la app: reabre la mascota solo si el usuario la dejó abierta, en
 * la posición donde quedó. No mira el temporizador: la disposición de pantalla
 * es independiente del estado del pomodoro. Nunca enfoca: la restauración no
 * roba la atención y el foco no rebota a la mascota cuando se recrea la ventana
 * principal desde su título.
 */
export async function restorePomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  if (state.isOpen) await showPomodoroMiniWindow(state, { focus: false })
}

/**
 * Deja la mascota visible en la posición y el diámetro dados. `focus` distingue
 * los dos caminos: la acción del usuario la trae al frente y la enfoca; la
 * restauración solo la crea si falta, sin tocar el foco de nadie. Sin máximo de
 * ventana a propósito: la pastilla de opciones necesita crecer más allá del
 * disco y el tope real lo impone `POMODORO_ORB_MAX_DIAMETER`.
 */
async function showPomodoroMiniWindow(
  state: PomodoroMiniWindowState,
  { focus }: { focus: boolean }
): Promise<void> {
  if (await windowExists(POMODORO_MINI_LABEL)) {
    if (focus) await focusWindow(POMODORO_MINI_LABEL)
    return
  }

  const diameter = resolveOrbDiameter(state)
  const placement =
    state.x !== null && state.y !== null
      ? { x: state.x, y: state.y }
      : await bottomRightOnMainMonitor(diameter, diameter)

  // La creación es fire-and-forget: Tauri avisa con `tauri://created`/`tauri://error`.
  new WebviewWindow(POMODORO_MINI_LABEL, {
    url: 'index.html',
    title: POMODORO_MINI_TITLE,
    width: diameter,
    height: diameter,
    minWidth: POMODORO_ORB_MIN_DIAMETER,
    minHeight: POMODORO_ORB_MIN_DIAMETER,
    resizable: false,
    alwaysOnTop: true,
    decorations: false,
    transparent: true,
    shadow: false,
    skipTaskbar: true,
    focus,
    ...placement,
  })
}

/**
 * Geometría en vivo de la ventana: mueve y redimensiona a la vez. Es el único
 * camino por el que cambia la geometría (el resize del disco y la expansión de
 * la pastilla), así la ventana no depende de bordes del sistema que ya no tiene.
 */
export async function setPomodoroMiniGeometry(rect: {
  x: number
  y: number
  width: number
  height: number
}): Promise<void> {
  const win = getCurrentWebviewWindow()
  await win.setSize(new PhysicalSize(Math.round(rect.width), Math.round(rect.height)))
  await win.setPosition(new PhysicalPosition(Math.round(rect.x), Math.round(rect.y)))
}

/** Arrastre nativo de la ventana: el disco entero es el asidero. */
export function startDraggingPomodoroMiniWindow(): void {
  void getCurrentWebviewWindow().startDragging()
}

/**
 * Disco actual (posición y diámetro) según la ventana. La posición Y se corrige
 * con el offset vigente de la pastilla: cuando flipa arriba, la ventana está
 * `offset` más arriba que el disco.
 */
export async function getPomodoroMiniOrbRect(): Promise<OrbRect> {
  const win = getCurrentWebviewWindow()
  const scale = await win.scaleFactor()
  const posicion = (await win.outerPosition()).toLogical(scale)
  const tamano = (await win.outerSize()).toLogical(scale)
  return { x: posicion.x, y: posicion.y + orbOffset, diameter: tamano.width }
}

/**
 * Offset vertical del disco dentro de la ventana (0, o la franja de la pastilla
 * cuando flipa arriba). Lo setea el componente ANTES de cada cambio de
 * geometría: el offset se captura al llegar los eventos de movimiento, así un
 * flush tardío no mezcla geometrías.
 */
let orbOffset = 0

export function setPomodoroMiniOrbOffset(offsetY: number): void {
  orbOffset = offsetY
}

/** Espera tras el último gesto (mover o redimensionar): una sola escritura por gesto. */
const LAYOUT_SAVE_DELAY_MS = 250

/** Ventanas ya seguidas: cada instancia se registra una sola vez. */
const trackedWindows = new WeakSet<WebviewWindow>()

/** Último movimiento pendiente, con el offset vigente al momento del evento. */
let pendingPosition: {
  toLogical: (scale: number) => { x: number; y: number }
  offsetY: number
} | null = null
let pendingSize: { toLogical: (scale: number) => { width: number; height: number } } | null = null
let layoutTimer: ReturnType<typeof setTimeout> | undefined

/**
 * La mascota persiste su propia disposición de pantalla (posición del disco y
 * diámetro). Se registra sobre su propia webview y no sobre el handle de quien
 * la creó: con la ventana principal cerrada nadie más la seguiría y el cierre
 * no se escribiría. El flag de apertura solo se escribe en las acciones del
 * usuario (abrir, cerrar): la destrucción de la ventana por el cierre de la app
 * no pasa por acá y deja el flag como estaba, así la próxima sesión la reabre.
 * El cierre lo coordina el store (marca `windowClosing` y espera el guardado
 * antes de destruir). El diámetro se deriva del ancho de la ventana: el alto
 * incluye la franja de la pastilla y no dice nada del disco.
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
    // El offset viaja con el evento: un flush tardío no puede mezclar
    // geometrías de la pastilla abierta con la cerrada.
    pendingPosition = {
      toLogical: (scale) => event.payload.toLogical(scale),
      offsetY: orbOffset,
    }
    programarGuardado()
  })
  void win.onResized((event) => {
    pendingSize = { toLogical: (scale) => event.payload.toLogical(scale) }
    programarGuardado()
  })
}

/**
 * Persiste el cierre de la mascota: deja el flag de apertura en false y guarda
 * la última disposición pendiente. La espera el handler de cierre del store
 * antes de que Tauri destruya la ventana: si el destroy gana la carrera, el
 * cierre no se guarda y la mascota reaparece en el próximo arranque.
 */
export async function flushPomodoroMiniWindowClosed(): Promise<void> {
  if (layoutTimer !== undefined) {
    clearTimeout(layoutTimer)
    layoutTimer = undefined
  }
  await flushMiniWindowState(getCurrentWebviewWindow(), false)
}

/**
 * Cierra la mascota desde su pastilla: persiste el cierre primero (la ventana
 * se destruye al instante) y recién entonces destruye.
 */
export async function closePomodoroMiniWindow(): Promise<void> {
  await flushPomodoroMiniWindowClosed()
  await getCurrentWebviewWindow().close()
}

/** Persiste el flag indicado junto a la última disposición pendiente (si hay). */
async function flushMiniWindowState(win: WebviewWindow, isOpen: boolean): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  let { x, y, width, height } = state
  if (pendingPosition) {
    const logical = pendingPosition.toLogical(await win.scaleFactor())
    x = logical.x
    y = logical.y + pendingPosition.offsetY
    pendingPosition = null
  }
  if (pendingSize) {
    const logical = pendingSize.toLogical(await win.scaleFactor())
    // El ancho de la ventana es el disco; el alto suma la franja de la pastilla.
    width = clampOrbDiameter(logical.width)
    height = width
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
