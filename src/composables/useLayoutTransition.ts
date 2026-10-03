import { readonly, ref, type Ref } from 'vue'

// Cubre los 300ms de la transición de ancho de la sidebar más el asentado
// posterior (labels ocultos + filas centradas) por si el transitionend no llega.
export const LAYOUT_TRANSITION_FALLBACK_MS = 600

const active = ref(false)
let fallbackTimer: ReturnType<typeof setTimeout> | undefined
const subscribers = new Set<() => void>()

export interface LayoutTransition {
  /** true mientras dura la transición de layout (ej. colapso de sidebar) */
  readonly transitioning: Readonly<Ref<boolean>>
  /** Marca el inicio de la transición de layout. */
  start: () => void
  /** Marca el fin de la transición y notifica a los suscriptores. */
  end: () => void
  /**
   * Registra un callback que corre una única vez cuando la transición
   * termina (si está activa). Devuelve la función de desuscripción.
   */
  onEnd: (callback: () => void) => () => void
}

function clearFallback() {
  if (fallbackTimer !== undefined) {
    clearTimeout(fallbackTimer)
    fallbackTimer = undefined
  }
}

function fireEnd() {
  clearFallback()
  active.value = false
  const pending = [...subscribers]
  subscribers.clear()
  for (const cb of pending) cb()
}

export function useLayoutTransition(): LayoutTransition {
  function start() {
    // Re-entrante: un toggle rápido durante una transición activa reinicia
    // la ventana de fallback (nueva medición limpia) sin duplicar el flag.
    clearFallback()
    active.value = true
    fallbackTimer = setTimeout(() => {
      fallbackTimer = undefined
      fireEnd()
    }, LAYOUT_TRANSITION_FALLBACK_MS)
  }

  function end() {
    if (!active.value) return
    fireEnd()
  }

  function onEnd(callback: () => void) {
    subscribers.add(callback)
    return () => {
      subscribers.delete(callback)
    }
  }

  return { transitioning: readonly(active), start, end, onEnd }
}
