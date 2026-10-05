import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface HeatmapColsOptions {
  containerRef: Ref<HTMLElement | null>
  dataCols: number
  cellSize?: number
  gap?: number
}

export function useHeatmapCols({
  containerRef,
  dataCols,
  cellSize = 10,
  gap = 2,
}: HeatmapColsOptions) {
  const cols = ref(dataCols)
  const actualCellSize = ref(cellSize)

  function applyWidth(width: number) {
    const possible = Math.floor((width + gap) / (cellSize + gap))
    cols.value = Math.max(1, Math.min(possible, dataCols))
    actualCellSize.value = cellSize
  }

  function updateCols() {
    const el = containerRef.value
    if (!el) return
    applyWidth(el.clientWidth)
  }

  // Los avisos del observador se agrupan en un solo cuadro y aplican el ancho
  // leído del propio entry (sin forzar un layout sincrónico por cada aviso).
  let pendingFrame: number | null = null
  let pendingWidth: number | null = null

  function scheduleApply(width: number) {
    pendingWidth = width
    if (pendingFrame !== null) return
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      if (pendingWidth === null) return
      applyWidth(pendingWidth)
      pendingWidth = null
    })
  }

  let observer: ResizeObserver | null = null

  onMounted(() => {
    updateCols()
    if (containerRef.value) {
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        scheduleApply(entry.contentRect.width)
      })
      observer.observe(containerRef.value)
    }
  })

  onUnmounted(() => {
    observer?.disconnect()
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame)
      pendingFrame = null
      pendingWidth = null
    }
  })

  return { cols, actualCellSize }
}
