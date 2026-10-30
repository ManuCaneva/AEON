import { currentMonitor, type Monitor } from '@tauri-apps/api/window'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { invoke } from '@tauri-apps/api/core'
import {
  loadPomodoroMiniWindowState,
  savePomodoroMiniWindowState,
} from '@/lib/pomodoroMiniWindowState'
import { focusWindow, windowExists } from '@/lib/appWindows'
import {
  POMODORO_ORB_DEFAULT_DIAMETER,
  containOrbInMonitor,
  defaultOrbRect,
  orbIntersectsMonitor,
  orbWindowRect,
  orbWindowOffsetX,
  mascotShapeRects,
  type MonitorRect,
  type OrbRect,
} from '@/lib/pomodoroMiniLayout'
import type { PomodoroMiniWindowState } from '@/schemas/pomodoroMiniWindow'

/** Label único de la ventana de la mascota: la identifica como singleton. */
export const POMODORO_MINI_LABEL = 'pomodoro-mini'

/** Título a nivel de sistema de la ventana de la mascota. */
export const POMODORO_MINI_TITLE = 'AEON — Pomodoro'
const MINI_READY_EVENT = 'pomodoro-mini-ready'

/** Rectángulo del monitor en píxeles lógicos (los que espera la API de ventanas). */
function monitorRect(monitor: Monitor): MonitorRect {
  const size = monitor.size.toLogical(monitor.scaleFactor)
  const position = monitor.position.toLogical(monitor.scaleFactor)
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

/** Rectángulo lógico del monitor donde está la mascota, o null si no hay. */
export async function currentLogicalMonitorRect(): Promise<MonitorRect | null> {
  const monitor = await currentMonitor()
  return monitor ? monitorRect(monitor) : null
}

/** true cuando esta webview es la mascota: decide el arranque del frontend. */
export function isPomodoroMiniWindow(): boolean {
  return getCurrentWebviewWindow().label === POMODORO_MINI_LABEL
}

/**
 * Recorta la ventana opaca a la forma del disco y la pastilla. La ventana se
 * crea rectangular para que WebKitGTK pinte toda la superficie; el recorte
 * nativo deja ver el escritorio alrededor sin depender de la transparencia.
 */
export async function applyPomodoroMiniWindowShape(pillReveal = 0): Promise<void> {
  await invoke('set_pomodoro_mini_shape', {
    rects: mascotShapeRects(POMODORO_ORB_DEFAULT_DIAMETER, pillReveal),
  })
}

/** GTK informa cruces que WebKit pierde al usar una región de entrada. */
export async function listenPomodoroMiniPointer(
  handler: (inside: boolean) => void
): Promise<() => void> {
  const unlisten = await getCurrentWebviewWindow().listen<boolean>(
    'pomodoro-mini-pointer',
    (event) => handler(event.payload)
  )
  try {
    await invoke('watch_pomodoro_mini_pointer')
    return unlisten
  } catch (error) {
    unlisten()
    throw error
  }
}

/** El recorte Win32 está en píxeles físicos y debe seguir los cambios de DPI. */
export function listenPomodoroMiniScaleChanged(handler: () => void): Promise<() => void> {
  return getCurrentWebviewWindow().onScaleChanged(handler)
}

/** Solo se muestra después de montar, cargar el reloj y preparar el recorte. */
export async function showReadyPomodoroMiniWindow(): Promise<void> {
  const win = getCurrentWebviewWindow()
  await win.show()
  await win.emit(MINI_READY_EVENT)
  if (new URLSearchParams(location.search).get('miniFocus') === '1') await win.setFocus()
}

/** Escuchar antes de consultar evita perder el primer show durante la consulta. */
async function focusReadyMiniWindow(): Promise<void> {
  const win = await WebviewWindow.getByLabel(POMODORO_MINI_LABEL)
  if (!win) return
  let ready!: () => void
  const prepared = new Promise<void>((resolve) => {
    ready = resolve
  })
  const unlisten = await win.once(MINI_READY_EVENT, ready)
  try {
    if (!(await win.isVisible())) await prepared
    await focusWindow(POMODORO_MINI_LABEL)
  } finally {
    unlisten()
  }
}

/**
 * Abre la mascota como singleton: si ya existe la enfoca; si no, crea la única
 * ventana con el disco y la franja de la pastilla. Es la acción explícita del
 * usuario (botón pop-out): la única que enfoca la mascota.
 */
export async function openPomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  await savePomodoroMiniWindowState({
    ...state,
    isOpen: true,
    width: POMODORO_ORB_DEFAULT_DIAMETER,
    height: POMODORO_ORB_DEFAULT_DIAMETER,
  })
  await showPomodoroMiniWindow(state, { focus: true })
}

/**
 * Arranque de la app: reabre la mascota solo si el usuario la dejó abierta, en
 * la posición donde quedó. No roba el foco.
 */
export async function restorePomodoroMiniWindow(): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  if (state.isOpen) await showPomodoroMiniWindow(state, { focus: false })
}

/**
 * Deja visible la mascota en la posición guardada. La ventana se crea una sola
 * vez con el tamaño completo (disco + franja) y no se redimensiona después: el
 * arrastre nativo mueve las dos piezas juntas, sin timers ni IPC.
 */
async function showPomodoroMiniWindow(
  state: PomodoroMiniWindowState,
  { focus }: { focus: boolean }
): Promise<void> {
  if (await windowExists(POMODORO_MINI_LABEL)) {
    if (focus) await focusReadyMiniWindow()
    return
  }

  const monitor = await currentLogicalMonitorRect()
  const diameter = POMODORO_ORB_DEFAULT_DIAMETER
  const hasSavedPosition = state.x !== null && state.y !== null
  let orb: OrbRect
  if (hasSavedPosition) {
    orb = { x: state.x as number, y: state.y as number, diameter }
    // Si la posición guardada es de este monitor, se corrige para que la
    // franja de la pastilla entre completa. Si es de otro monitor, se respeta.
    if (monitor && orbIntersectsMonitor(orb, monitor)) orb = containOrbInMonitor(orb, monitor)
  } else {
    orb = monitor ? defaultOrbRect(monitor, diameter) : { x: 0, y: 0, diameter }
  }

  const rect = orbWindowRect(orb)
  const position = hasSavedPosition || monitor ? { x: rect.x, y: rect.y } : {}

  // La instancia queda viva en Tauri: acá solo interesa crearla.
  void new WebviewWindow(POMODORO_MINI_LABEL, {
    url: `index.html?miniFocus=${focus ? '1' : '0'}`,
    title: POMODORO_MINI_TITLE,
    width: rect.width,
    height: rect.height,
    minWidth: rect.width,
    minHeight: rect.height,
    maxWidth: rect.width,
    maxHeight: rect.height,
    resizable: true,
    alwaysOnTop: true,
    decorations: false,
    transparent: false,
    visible: false,
    shadow: false,
    skipTaskbar: true,
    focus: false,
    ...position,
  })
}

/** Arrastre nativo de la ventana: el disco entero es el asidero. */
export function startDraggingPomodoroMiniWindow(): void {
  void getCurrentWebviewWindow().startDragging()
}

/** Espera tras el último movimiento: una sola escritura por arrastre. */
const LAYOUT_SAVE_DELAY_MS = 250

/** Ventanas ya seguidas: cada instancia se registra una sola vez. */
const trackedWindows = new WeakSet<WebviewWindow>()

/** Último movimiento pendiente del disco. */
let pendingPosition: {
  toLogical: (scale: number) => { x: number; y: number }
} | null = null
let layoutTimer: ReturnType<typeof setTimeout> | undefined

/**
 * La mascota persiste su propia disposición de pantalla (posición de la
 * ventana). Se registra sobre la ventana única; el tamaño es fijo y la pastilla
 * se mueve con la ventana, así que no hay nada más que seguir. El cierre lo
 * coordina el store.
 */
export async function trackPomodoroMiniWindow(): Promise<void> {
  const win = getCurrentWebviewWindow()
  if (trackedWindows.has(win)) return
  trackedWindows.add(win)

  function programarGuardado(): void {
    if (layoutTimer !== undefined) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => {
      layoutTimer = undefined
      return flushMiniWindowState(win, true)
    }, LAYOUT_SAVE_DELAY_MS)
  }

  void win.onMoved((event) => {
    pendingPosition = { toLogical: (scale) => event.payload.toLogical(scale) }
    programarGuardado()
  })
}

/**
 * Persiste el cierre de la mascota: deja el flag de apertura en false y guarda
 * la última disposición pendiente. La espera el handler de cierre del store
 * antes de que Tauri destruya la ventana.
 */
export async function flushPomodoroMiniWindowClosed(): Promise<void> {
  if (layoutTimer !== undefined) {
    clearTimeout(layoutTimer)
    layoutTimer = undefined
  }
  await flushMiniWindowState(getCurrentWebviewWindow(), false)
}

/** Cierra la mascota desde su pastilla: persiste el cierre y destruye la ventana. */
export async function closePomodoroMiniWindow(): Promise<void> {
  if (layoutTimer !== undefined) {
    clearTimeout(layoutTimer)
    layoutTimer = undefined
  }
  await flushMiniWindowState(getCurrentWebviewWindow(), false)
  await getCurrentWebviewWindow().close()
}

/** Persiste el flag indicado junto a la última posición pendiente (si hay). */
async function flushMiniWindowState(win: WebviewWindow, isOpen: boolean): Promise<void> {
  const state = await loadPomodoroMiniWindowState()
  let { x, y } = state
  if (pendingPosition) {
    const logical = pendingPosition.toLogical(await win.scaleFactor())
    x = logical.x + orbWindowOffsetX(POMODORO_ORB_DEFAULT_DIAMETER)
    y = logical.y
    pendingPosition = null
  }
  const diameter = POMODORO_ORB_DEFAULT_DIAMETER
  // El estado guarda el disco, no la franja: width/height son el diámetro.
  await savePomodoroMiniWindowState({
    isOpen,
    x,
    y,
    width: diameter,
    height: diameter,
  })
}
