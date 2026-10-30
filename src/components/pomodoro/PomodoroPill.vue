<script setup lang="ts">
import { ExternalLink, X } from 'lucide-vue-next'
import { POMODORO_PILL_HEIGHT } from '@/lib/pomodoroMiniLayout'

/**
 * Pastilla de opciones de la mascota del pomodoro: aparece bajo el disco al
 * hacer hover y lleva los controles de la ventana. Emite eventos puros; la
 * ventana que la hospeda resuelve qué hacer con ellos.
 */
const emit = defineEmits<{ go: []; close: [] }>()

function controlClass(extra: string): string {
  return `flex items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${extra}`
}
</script>

<template>
  <div
    data-testid="pomodoro-pill"
    class="flex items-center justify-center gap-0.5 rounded-full border border-hairline-strong bg-surface-2 px-1.5 shadow-md shadow-overlay/50 ring-1 ring-inset ring-hairline-strong/50"
    :style="{ height: `${POMODORO_PILL_HEIGHT}px` }"
  >
    <button
      data-testid="pomodoro-pill-go"
      type="button"
      aria-label="Ir a la página Pomodoro"
      :class="controlClass('h-6 w-6 cursor-pointer')"
      @click="emit('go')"
    >
      <ExternalLink :size="14" aria-hidden="true" />
    </button>
    <button
      data-testid="pomodoro-pill-close"
      type="button"
      aria-label="Cerrar Pomodoro"
      :class="controlClass('h-6 w-6 cursor-pointer')"
      @click="emit('close')"
    >
      <X :size="14" aria-hidden="true" />
    </button>
  </div>
</template>
