<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { DROP_ZONE_Z_INDEX } from '@/lib/grid'

const props = defineProps<{
  x: number
  y: number
  w: number
  h: number
  occupied: boolean
}>()

/**
 * La zona se coloca sobre la misma grilla nativa que los widgets: las celdas
 * enteras de destino se expresan como grid-column/grid-row, así el resalte
 * coincide exactamente con dónde caería el gesture sin hacer cuentas en px.
 */
const style = computed<CSSProperties>(() => ({
  gridColumn: `${props.x + 1} / span ${props.w}`,
  gridRow: `${props.y + 1} / span ${props.h}`,
  zIndex: DROP_ZONE_Z_INDEX,
}))
</script>

<template>
  <div
    data-testid="drop-zone-preview"
    aria-hidden="true"
    :data-occupied="occupied ? 'true' : 'false'"
    class="drop-zone-preview pointer-events-none rounded-sm border"
    :class="
      occupied ? 'border-accent-red/60 bg-accent-red-tint' : 'border-primary/50 bg-primary/10'
    "
    :style="style"
  />
</template>

<style scoped>
.drop-zone-preview {
  animation: drop-zone-in 150ms ease-out;
}

@keyframes drop-zone-in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
