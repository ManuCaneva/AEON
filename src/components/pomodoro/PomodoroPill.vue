<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { ExternalLink, Scaling, X } from 'lucide-vue-next'
import { POMODORO_PILL_HEIGHT } from '@/lib/pomodoroMiniLayout'

/**
 * Pastilla de opciones de la mascota del pomodoro: aparece bajo el disco al
 * hacer hover y lleva los tres controles de la ventana. El handle de resize es
 * un gesto de mantener apretado y mover el mouse: los deltas se acumulan desde
 * el inicio del gesto y los escucha el documento, así el gesto sigue aunque el
 * cursor se vaya del botón. Emiten eventos puros; la geometría la resuelve la
 * ventana que hospeda la pastilla.
 */
const emit = defineEmits<{
  'resize-start': []
  resize: [delta: { x: number; y: number }]
  'resize-end': []
  go: []
  close: []
}>()

let gesto: { x: number; y: number } | null = null

function onMouseDown(event: MouseEvent): void {
  if (event.button !== 0 || gesto !== null) return
  event.preventDefault()
  gesto = { x: event.clientX, y: event.clientY }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  window.addEventListener('blur', onMouseUp)
  emit('resize-start')
}

function onMouseMove(event: MouseEvent): void {
  if (gesto === null) return
  // El mouseup puede perderse (el puntero sale de la ventana con el botón
  // apretado): un move sin botón apretado cierra el gesto en vez de dejarlo
  // estirando la ventana para siempre.
  if (event.buttons === 0) {
    onMouseUp()
    return
  }
  emit('resize', { x: event.clientX - gesto.x, y: event.clientY - gesto.y })
}

function onMouseUp(): void {
  if (gesto === null) return
  gesto = null
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('blur', onMouseUp)
  emit('resize-end')
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('blur', onMouseUp)
})

function controlClass(extra: string): string {
  return `flex items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${extra}`
}
</script>

<template>
  <div
    data-testid="pomodoro-pill"
    class="flex items-center gap-1 rounded-full border border-hairline-strong bg-surface-2 px-1.5 shadow-md"
    :style="{ height: `${POMODORO_PILL_HEIGHT}px` }"
  >
    <button
      data-testid="pomodoro-pill-resize"
      type="button"
      aria-label="Redimensionar Pomodoro"
      :class="controlClass('cursor-ns-resize')"
      @mousedown="onMouseDown"
    >
      <Scaling :size="16" aria-hidden="true" />
    </button>
    <button
      data-testid="pomodoro-pill-go"
      type="button"
      aria-label="Ir a la página Pomodoro"
      :class="controlClass('cursor-pointer')"
      @click="emit('go')"
    >
      <ExternalLink :size="16" aria-hidden="true" />
    </button>
    <button
      data-testid="pomodoro-pill-close"
      type="button"
      aria-label="Cerrar Pomodoro"
      :class="controlClass('cursor-pointer')"
      @click="emit('close')"
    >
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
