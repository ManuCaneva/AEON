<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HabitLog } from '@/schemas/habits'
import { buildHeatmapGrid, HISTORY_ROWS } from '@/lib/buildHeatmapGrid'
import { intensityFor, shadeFor } from '@/lib/habitColors'
import { useHeatmapCols } from '@/composables/useHeatmapCols'

const props = withDefaults(
  defineProps<{ logs: HabitLog[]; color: string; days?: number; target?: number }>(),
  {
    days: 364,
    target: 1,
  }
)

const containerRef = ref<HTMLElement | null>(null)
const dataCols = computed(() => Math.ceil(props.days / HISTORY_ROWS))
const { cols, actualCellSize } = useHeatmapCols({
  containerRef,
  dataCols: dataCols.value,
  cellSize: 10,
  gap: 2,
})

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
    days: cols.value * HISTORY_ROWS,
    logs: props.logs,
    rows: HISTORY_ROWS,
    target: props.target,
  })
  const size = actualCellSize.value
  const color = props.color
  const today = todayStr.value
  return built.map((c) => cellStyle(c, size, color, today))
})
</script>

<template>
  <div
    ref="containerRef"
    data-testid="heat-grid"
    class="grid overflow-hidden"
    :style="{
      gridTemplateColumns: `repeat(${cols}, ${actualCellSize}px)`,
      gridTemplateRows: `repeat(${HISTORY_ROWS}, ${actualCellSize}px)`,
      gridAutoFlow: 'column',
      gap: '2px',
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
</template>
