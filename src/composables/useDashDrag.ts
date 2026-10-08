import { watch, type Ref } from 'vue'
import interact from 'interactjs'

export interface DragCallbacks {
  onDragStart: () => void
  onDragMove: (dx: number, dy: number) => void
  onDragEnd: () => void
  onResizeStart: () => void
  onResizeMove: (dw: number, dh: number, dl: number, dt: number) => void
  onResizeEnd: () => void
}

export function useDashDrag(
  elRef: Ref<HTMLElement | null>,
  editMode: Ref<boolean>,
  callbacks: DragCallbacks
) {
  let interactable: ReturnType<typeof interact> | null = null

  function setup() {
    const el = elRef.value
    if (!el) return

    interactable = interact(el)

    interactable
      .draggable({
        enabled: editMode.value,
        ignoreFrom: 'button, input, select, textarea, .no-widget-drag, .pointer-events-auto',
        inertia: false,
        modifiers: [],
        listeners: {
          start() {
            callbacks.onDragStart()
          },
          move(event) {
            callbacks.onDragMove(event.dx, event.dy)
          },
          end() {
            callbacks.onDragEnd()
          },
        },
      })
      .resizable({
        enabled: editMode.value,
        // Las cuatro aristas habilitan además las cuatro esquinas en diagonal.
        edges: { left: true, right: true, top: true, bottom: true },
        modifiers: [],
        listeners: {
          start() {
            callbacks.onResizeStart()
          },
          move(event) {
            // deltaRect es el delta del evento actual. left/top son el
            // desplazamiento del borde opuesto cuando se tira de arriba/izquierda.
            callbacks.onResizeMove(
              event.deltaRect?.width ?? 0,
              event.deltaRect?.height ?? 0,
              event.deltaRect?.left ?? 0,
              event.deltaRect?.top ?? 0
            )
          },
          end() {
            callbacks.onResizeEnd()
          },
        },
      })
  }

  watch(editMode, (enabled) => {
    if (interactable) {
      interactable.draggable(enabled)
      interactable.resizable(enabled)
    }
  })

  watch(elRef, (el) => {
    if (el) {
      setup()
    } else {
      interactable?.unset()
      interactable = null
    }
  })

  if (elRef.value) {
    setup()
  }

  return () => {
    interactable?.unset()
    interactable = null
  }
}
