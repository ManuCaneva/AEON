import { onScopeDispose, watch, type Ref } from 'vue'
import {
  pointerToSchedulePosition,
  type ScheduleDragGeometry,
  type ScheduleDragPoint,
} from '@/lib/scheduleDragGeometry'

const DRAG_THRESHOLD_PX = 4

export interface ScheduleDragCallbacks {
  onStart: () => void
  onMove: (point: ScheduleDragPoint) => void
  onEnd: () => void
  onCancel: () => void
}

/**
 * Arrastre de ocurrencias dentro de la grilla del cronograma. El gesto se
 * resuelve por la posición del puntero sobre la grilla (no por acumulación de
 * píxeles), así el bloque sigue al mouse aunque la Ventana visible cambie
 * durante el arrastre.
 */
export function useScheduleDrag(
  gridRef: Ref<HTMLElement | null>,
  enabled: Ref<boolean>,
  geometry: () => ScheduleDragGeometry,
  callbacks: ScheduleDragCallbacks
) {
  let startX = 0
  let startY = 0
  let dragging = false
  let listening = false

  function resolvePoint(event: PointerEvent): ScheduleDragPoint | null {
    const el = gridRef.value
    if (!el) return null
    return pointerToSchedulePosition(
      event.clientX,
      event.clientY,
      el.getBoundingClientRect(),
      geometry()
    )
  }

  function onPointerMove(event: PointerEvent) {
    if (!enabled.value) {
      stop()
      return
    }
    if (!dragging) {
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY)
      if (distance < DRAG_THRESHOLD_PX) return
      dragging = true
      callbacks.onStart()
    }
    const point = resolvePoint(event)
    if (point) callbacks.onMove(point)
  }

  function onPointerUp() {
    const wasDragging = dragging
    stop()
    if (wasDragging) callbacks.onEnd()
  }

  function onPointerCancel() {
    const wasDragging = dragging
    stop()
    if (wasDragging) callbacks.onCancel()
  }

  function stop() {
    if (listening) {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      listening = false
    }
    dragging = false
  }

  function begin(event: PointerEvent) {
    if (!enabled.value) return
    if (event.button !== undefined && event.button !== 0) return
    startX = event.clientX
    startY = event.clientY
    dragging = false
    if (!listening) {
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerCancel)
      listening = true
    }
  }

  watch(enabled, (on) => {
    if (on) return
    const wasDragging = dragging
    stop()
    if (wasDragging) callbacks.onCancel()
  })

  onScopeDispose(stop)

  return { begin }
}
