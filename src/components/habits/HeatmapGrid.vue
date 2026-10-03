<script setup lang="ts">
import { computed } from 'vue'
import type { HabitLog } from '@/schemas/habits'
import { buildHeatmapGrid, HISTORY_ROWS } from '@/lib/buildHeatmapGrid'
import { intensityFor, shadeFor } from '@/lib/habitColors'

const props = withDefaults(
  defineProps<{ logs: HabitLog[]; color: string; days?: number; target?: number }>(),
  {
    days: 364,
    target: 1,
  }
)

const CELL_SIZE = 10
const GAP = 2

// Cantidad de columnas del heatmap: constante para un `days` dado. El grid
// SIEMPRE renderiza todas estas columnas (DOM constante) para que un cambio de
// ancho no re-renderice las celdas: ese re-render era el costo dominante del
// freeze al animar la sidebar. La ventana visible se recorta con
// `overflow-hidden` y `ml-auto` deja siempre visibles las semanas más recientes.
const dataCols = computed(() => Math.ceil(props.days / HISTORY_ROWS))

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// Puro y sin dependencias reactivas: se memoiza dentro del computed de `cells`,
// de modo que un re-render no vuelve a calcular las 364 celdas.
function cellStyle(
  c: { completed: boolean; isEmpty: boolean; date: string; count: number; target: number },
  size: number,
  color: string,
  today: string
): Record<string, string> {
  const baseStyle: Record<string, string> = {
    width: `${size}px`,
    height: `${size}px`,
  }

  if (c.isEmpty) {
    baseStyle.background = 'transparent'
  } else {
    const intensity = intensityFor(c.count, c.target)
    const base = shadeFor(color, intensity)
    const full = c.count > 0 && c.count >= c.target
    if (c.date === today && full) {
      baseStyle.background = base
      baseStyle.boxShadow = `0 0 0 1px ${shadeFor(color, 1)}`
    } else {
      baseStyle.background = base
    }
  }

  return baseStyle
}

const cells = computed(() => {
  const built = buildHeatmapGrid({
    days: dataCols.value * HISTORY_ROWS,
    logs: props.logs,
    rows: HISTORY_ROWS,
    target: props.target,
  })
  const color = props.color
  const today = todayStr.value
  return built.map((c) => cellStyle(c, CELL_SIZE, color, today))
})
</script>

<template>
  <div data-testid="heat-grid" class="w-full overflow-hidden">
    <div
      data-testid="heat-grid-inner"
      class="ml-auto grid w-max"
      :style="{
        gridTemplateColumns: `repeat(${dataCols}, ${CELL_SIZE}px)`,
        gridTemplateRows: `repeat(${HISTORY_ROWS}, ${CELL_SIZE}px)`,
        gridAutoFlow: 'column',
        gap: `${GAP}px`,
      }"
    >
      <div
        v-for="(style, i) in cells"
        :key="i"
        data-testid="heat-cell"
        class="rounded-[2px] transition-colors duration-200"
        :style="style"
      />
    </div>
  </div>
</template>
