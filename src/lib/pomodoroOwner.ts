import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { windowExists } from '@/lib/appWindows'
import { POMODORO_MAIN_LABEL } from '@/lib/pomodoroMainWindow'

/**
 * ¿Es la ventana actual la dueña del pomodoro? La dueña resuelve los fines de
 * fase naturales y suena el aviso, de modo que con dos ventanas el fin de fase
 * suena exactamente una vez.
 *
 * La decisión es determinista y con preferencia canónica por la ventana
 * principal: si la pregunta la hace la principal, el aviso es suyo sin
 * consultar nada (no hay decisión que pueda fallar). La mini solo suena con la
 * principal ausente y positivamente observada. «Abierta» es existir: una
 * ventana minimizada u oculta sigue siendo la del aviso.
 *
 * Trade-off del «nunca doble»: la duda se resuelve a favor de no sonar. Si la
 * API de ventanas no responde, manda la principal y la mini se queda callada
 * (puede perderse un aviso, nunca sonar dos). Y una ventana que se está
 * cerrando tampoco suena: el fin de fase lo retoma la mini cuando la principal
 * desaparezca, así que la ventana que se cierra entrega el aviso en vez de
 * arriesgar el doble.
 */
export async function isPomodoroOwnerWindow(): Promise<boolean> {
  const actual = getCurrentWebviewWindow().label
  if (actual === POMODORO_MAIN_LABEL) return true

  try {
    return !(await windowExists(POMODORO_MAIN_LABEL))
  } catch (error) {
    console.warn('[pomodoro] ventanas no consultables; manda la principal:', error)
    return false
  }
}
