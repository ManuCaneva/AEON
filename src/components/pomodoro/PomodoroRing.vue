<script setup lang="ts">
import { computed } from 'vue'
import type { PomodoroPhase } from '@/schemas/pomodoro'

const props = defineProps<{
  phase: Exclude<PomodoroPhase, 'idle'>
  /** Fracción de la fase transcurrida (0..1), continua: no se redondea. */
  progress: number
  /** Grosor del anillo en unidades del viewBox (0..100). */
  ringWidth?: number
}>()

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

const DEFAULT_RING_WIDTH = 3.45
/**
 * Medio píxel de aire entre el borde exterior del trazo y el viewBox. Sin ese
 * margen el antialias del SVG se recorta justo en el límite y el círculo se ve
 * dentado, sobre todo contra fondos claros.
 */
const ANTIALIAS_MARGIN = 0.5
const ringToken = computed(() => (props.phase === 'focus' ? 'primary' : 'success'))
const progressPercent = computed(() => Math.round(clamp01(props.progress) * 100))
/**
 * El radio se corre hacia adentro la mitad del grosor para que el trazo entre
 * completo, más el margen de antialias. El diámetro exterior no cambia: el
 * grosor extra crece hacia el centro del disco.
 */
const ringRadius = computed(
  () => 50 - (props.ringWidth ?? DEFAULT_RING_WIDTH) / 2 - ANTIALIAS_MARGIN
)
/**
 * El avance se dibuja como `stroke-dashoffset` sobre un anillo de pathLength
 * 100: valores continuos que la transición de CSS interpola, sin rAF. Va como
 * cadena para que Vue no le agregue unidades.
 */
const dashOffset = computed(() =>
  String(Math.round(100 * (1 - clamp01(props.progress)) * 1000) / 1000)
)
</script>

<template>
  <div
    class="pomodoro-ring-root relative flex items-center justify-center rounded-full"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="progressPercent"
    :style="{
      '--pomodoro-ring': `rgb(var(--color-${ringToken}))`,
      '--pomodoro-ring-width': ringWidth ?? DEFAULT_RING_WIDTH,
    }"
  >
    <svg class="pomodoro-ring" viewBox="0 0 100 100" aria-hidden="true">
      <!-- La rotación vive en el SVG, no en una capa CSS: WebKitGTK puede
           rasterizar el borde antes de rotarlo y dejar el círculo dentado. -->
      <g transform="rotate(-90 50 50)">
        <circle
          class="pomodoro-ring-track"
          cx="50"
          cy="50"
          :r="ringRadius"
          pathLength="100"
          :style="{ stroke: 'rgb(var(--color-surface-3))' }"
        />
        <circle
          class="pomodoro-ring-progress"
          cx="50"
          cy="50"
          :r="ringRadius"
          pathLength="100"
          :style="{ strokeDashoffset: dashOffset }"
        />
      </g>
    </svg>
    <slot />
  </div>
</template>
