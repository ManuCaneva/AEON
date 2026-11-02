import { useEventListener } from '@vueuse/core'

const ZOOM_KEYS = new Set(['+', '=', '-', '_', '0'])
const ZOOM_CODES = new Set(['NumpadAdd', 'NumpadSubtract', 'Numpad0'])

/**
 * Mantiene la mini al 100%: cancela únicamente los gestos de zoom, sin timers,
 * observers ni IPC. Las escuchas se desmontan junto con la ventana.
 */
export function usePomodoroMiniZoomLock() {
  function preventModifiedZoom(event: WheelEvent | KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return
    if (event instanceof KeyboardEvent) {
      if (!ZOOM_KEYS.has(event.key) && !ZOOM_CODES.has(event.code)) return
    }
    event.preventDefault()
  }

  useEventListener(window, 'wheel', preventModifiedZoom, { passive: false })
  useEventListener(window, 'keydown', preventModifiedZoom)

  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    useEventListener(window, type, (event: Event) => event.preventDefault(), { passive: false })
  }
}
