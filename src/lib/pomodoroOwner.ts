import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { POMODORO_MAIN_LABEL } from '@/lib/pomodoroMainWindow'
import { POMODORO_MINI_LABEL } from '@/lib/pomodoroMiniWindow'

/** true cuando la ventana está abierta: existe y no está oculta. */
async function isWindowOpen(label: string): Promise<boolean> {
  const target = await WebviewWindow.getByLabel(label)
  return target !== null && (await target.isVisible())
}

/**
 * ¿Es la ventana actual la dueña del pomodoro? La dueña resuelve los fines de
 * fase naturales y suena el aviso, de modo que con dos ventanas el fin de fase
 * suena exactamente una vez. La dueña es la mini solo si está abierta y la
 * principal no; en cualquier otro caso manda la principal, para que el aviso
 * no se pierda. Si la API de ventanas no responde, la ventana se comporta como
 * única: mejor un aviso de más que un temporizador congelado.
 */
export async function isPomodoroOwnerWindow(): Promise<boolean> {
  try {
    const actual = getCurrentWebviewWindow().label
    const mainAbierta = await isWindowOpen(POMODORO_MAIN_LABEL)
    const miniAbierta = await isWindowOpen(POMODORO_MINI_LABEL)
    const duena = miniAbierta && !mainAbierta ? POMODORO_MINI_LABEL : POMODORO_MAIN_LABEL
    return actual === duena
  } catch (error) {
    console.warn('[pomodoro] ventanas no consultables; se asume ventana única:', error)
    return true
  }
}
