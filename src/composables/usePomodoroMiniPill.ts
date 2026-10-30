import { onScopeDispose, ref, watch } from 'vue'
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import {
  applyPomodoroMiniWindowShape,
  listenPomodoroMiniPointer,
  listenPomodoroMiniScaleChanged,
} from '@/lib/pomodoroMiniWindow'

const HIDE_DELAY_MS = 1000
const REVEAL_DURATION_MS = 180

/** Hover y foco de la ventana única. En reposo no hay animaciones ni IPC. */
export function usePomodoroMiniPill() {
  const visible = ref(false)
  const reducedMotion = usePreferredReducedMotion()
  const scaleVersion = ref(0)
  let hovered = false
  let focused = false
  let focusRoot: HTMLElement | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let frame: number | undefined
  let disposed = false
  let running = false
  let progress = 0
  let from = 0
  let target = 0
  let startedAt = 0
  let unlistenPointer: (() => void) | undefined
  let unlistenScale: (() => void) | undefined

  function cancelHide(): void {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  function updateVisibility(): void {
    cancelHide()
    if (hovered || focused) visible.value = true
    else
      hideTimer = setTimeout(() => {
        visible.value = false
      }, HIDE_DELAY_MS)
  }

  useEventListener(window, 'blur', () => {
    focused = false
    updateVisibility()
  })
  useEventListener(window, 'focus', () => {
    focused = focusRoot?.contains(document.activeElement) ?? false
    updateVisibility()
  })

  void listenPomodoroMiniPointer((inside) => {
    hovered = inside
    updateVisibility()
  })
    .then((unlisten) => {
      if (disposed) unlisten()
      else unlistenPointer = unlisten
    })
    .catch((error) => console.error('No se pudo observar el puntero del pomodoro', error))

  void listenPomodoroMiniScaleChanged(() => {
    scaleVersion.value++
  })
    .then((unlisten) => {
      if (disposed) unlisten()
      else unlistenScale = unlisten
    })
    .catch((error) => console.error('No se pudo observar el DPI del pomodoro', error))

  // La máscara anima la revelación, no la opacidad: un fade de CSS dejaría
  // visible el fondo opaco de GTK y no liberaría los clicks bajo la pastilla.
  async function animate(): Promise<void> {
    frame = undefined
    const elapsed = Math.min(1, (performance.now() - startedAt) / REVEAL_DURATION_MS)
    const eased = 1 - (1 - elapsed) ** 3
    progress = reducedMotion.value === 'reduce' ? target : from + (target - from) * eased
    try {
      // Una sola llamada en vuelo; nunca acumular trabajo si el IPC tarda.
      await applyPomodoroMiniWindowShape(progress)
      if (!disposed && progress !== target) {
        frame = requestAnimationFrame(() => {
          void animate()
        })
        return
      }
    } catch (error) {
      console.error('No se pudo actualizar la pastilla del pomodoro', error)
    }
    running = false
  }

  watch([visible, reducedMotion, scaleVersion], () => {
    from = progress
    target = visible.value ? 1 : 0
    startedAt = performance.now()
    if (!running) {
      running = true
      void animate()
    }
  })

  onScopeDispose(() => {
    disposed = true
    cancelHide()
    unlistenPointer?.()
    unlistenScale?.()
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return {
    visible,
    onEnter() {
      hovered = true
      updateVisibility()
    },
    onLeave() {
      hovered = false
      updateVisibility()
    },
    onFocusIn(event: FocusEvent) {
      focusRoot = event.currentTarget as HTMLElement
      focused = true
      updateVisibility()
    },
    onFocusOut(event: FocusEvent) {
      const root = event.currentTarget as HTMLElement
      if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return
      focused = false
      updateVisibility()
    },
  }
}
