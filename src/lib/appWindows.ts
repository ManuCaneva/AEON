import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/**
 * Helpers sobre la API de ventanas de Tauri, compartidos por las ventanas de
 * la app (principal y mini del pomodoro): una sola idea de «existe» y de
 * «traer al frente».
 */

/** true cuando la ventana existe: abierta aunque esté minimizada u oculta. */
export async function windowExists(label: string): Promise<boolean> {
  const target = await WebviewWindow.getByLabel(label)
  return target !== null && target !== undefined
}

/**
 * Trae la ventana al frente y la enfoca. Devuelve false si no existe, para que
 * quien la llama decida si la crea.
 */
export async function focusWindow(label: string): Promise<boolean> {
  const target = await WebviewWindow.getByLabel(label)
  if (target === null || target === undefined) return false
  await target.show()
  await target.setFocus()
  return true
}
