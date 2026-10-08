<script setup lang="ts">
import { ref, computed, nextTick, type CSSProperties } from 'vue'
import type { LayoutItem } from '@/stores/dashboard'
import { pxToCells } from '@/composables/gridSnap'
import {
  flipTransform,
  flipNeedsAnimation,
  FLIP_DURATION_MS,
  FLIP_EASING,
  type FlipRect,
} from '@/composables/flip'
import { useDashDrag } from '@/composables/useDashDrag'
import { COLS, ROWS, GRID_GAP, itemZIndex, DRAGGING_Z_INDEX } from '@/lib/grid'

const props = defineProps<{
  item: LayoutItem
  editMode: boolean
}>()

const emit = defineEmits<{
  moved: [id: string, x: number, y: number]
  resized: [id: string, x: number, y: number, w: number, h: number]
  preview: [id: string, x: number, y: number, w: number, h: number]
  'preview-end': []
}>()

const elRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isFlipping = ref(false)
const isHovered = ref(false)

/**
 * Handles invisibles que marcan el cursor de redimensionado en cada arista y
 * esquina. interactjs detecta el borde por proximidad del puntero; estos
 * elementos solo aportan la affordance visual (cursor) y aíslan la lógica de
 * estilos. Las clases van como literales para que el escáner de Tailwind las
 * encuentre.
 */
const RESIZE_HANDLES: Array<{ position: string; classes: string }> = [
  { position: 'n', classes: 'top-0 left-1/4 right-1/4 h-1.5 cursor-ns-resize' },
  { position: 's', classes: 'bottom-0 left-1/4 right-1/4 h-1.5 cursor-ns-resize' },
  { position: 'w', classes: 'left-0 top-1/4 bottom-1/4 w-1.5 cursor-ew-resize' },
  { position: 'e', classes: 'right-0 top-1/4 bottom-1/4 w-1.5 cursor-ew-resize' },
  { position: 'nw', classes: 'left-0 top-0 h-2.5 w-2.5 cursor-nwse-resize' },
  { position: 'ne', classes: 'right-0 top-0 h-2.5 w-2.5 cursor-nesw-resize' },
  { position: 'sw', classes: 'left-0 bottom-0 h-2.5 w-2.5 cursor-nesw-resize' },
  { position: 'se', classes: 'right-0 bottom-0 h-2.5 w-2.5 cursor-nwse-resize' },
]

/**
 * Grips de esquina: dos líneas en forma de L que aparecen al hacer hover en
 * modo edición. El ancla define en qué vértice del widget se dibujan.
 */
const CORNER_GRIPS: Array<{ corner: string; anchor: string }> = [
  { corner: 'nw', anchor: 'left-0 top-0' },
  { corner: 'ne', anchor: 'right-0 top-0' },
  { corner: 'sw', anchor: 'left-0 bottom-0' },
  { corner: 'se', anchor: 'right-0 bottom-0' },
]

const gridStyle = computed(() => ({
  gridColumn: `${props.item.x + 1} / span ${props.item.w}`,
  gridRow: `${props.item.y + 1} / span ${props.item.h}`,
}))

const itemStyle = computed(() => {
  if (!props.editMode) return gridStyle.value
  return {
    ...gridStyle.value,
    zIndex: isDragging.value ? DRAGGING_Z_INDEX : itemZIndex(props.item.x, props.item.y),
  }
})

const editModeRef = computed(() => props.editMode)

/**
 * Capa de contenido del widget. En modo edición se desatura, se atenúa y deja
 * de recibir punteros para evitar disparar acciones por accidente; el arrastre,
 * el redimensionado y el control de quitar viven fuera de esta capa.
 */
const contentStyle = computed<CSSProperties | undefined>(() =>
  props.editMode ? { filter: 'grayscale(1)', opacity: '0.6', pointerEvents: 'none' } : undefined
)

/**
 * Métricas del contenedor cacheadas por gesto. Se miden una sola vez al
 * iniciar el drag/resize (`measureContainer`) y todos los `move` reutilizan
 * estos valores, evitando un reflow sincrónico por cada movimiento del puntero.
 */
let containerWidth = 0
let containerHeight = 0

function measureContainer() {
  const container = elRef.value?.parentElement
  containerWidth = container?.clientWidth ?? 0
  containerHeight = container?.clientHeight ?? 0
}

type Cells = { x: number; y: number; w: number; h: number }

/** Última zona emitida en el gesto; evita re-renderizar si el snap no cambió. */
let lastPreviewCells: Cells | null = null

const ZERO_RECT: FlipRect = { left: 0, top: 0, width: 0, height: 0 }

function elementRect(el: HTMLElement): FlipRect {
  const rect = el.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function applyFlip(first: FlipRect) {
  const el = elRef.value
  if (!el) return
  const last = elementRect(el)
  if (!flipNeedsAnimation(first, last)) return
  const invert = flipTransform(first, last)
  el.style.transition = 'none'
  el.style.transform = invert
  // Force reflow: el pintado en la posición invertida antes de animar a cero.
  void el.offsetWidth
  el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
  el.style.transform = ''
  isFlipping.value = true
  setTimeout(() => {
    el.style.transition = ''
    isFlipping.value = false
  }, FLIP_DURATION_MS)
}

let dragAccumX = 0
let dragAccumY = 0
let resizeAccumW = 0
let resizeAccumH = 0
let resizeAccumLeft = 0
let resizeAccumTop = 0
let resizeBaseW = 0
let resizeBaseH = 0

/**
 * Aristas ancladas del gesto de resize. Al tirar de la izquierda/arriba se ancla
 * la arista opuesta (derecha/abajo) para que el widget se encoja de verdad en
 * lugar de deslizarse al llegar al mínimo. Se detecta por el delta del borde que
 * interactjs mueve (dl/dt distintos de cero).
 */
let resizeAnchorX: 'start' | 'end' = 'start'
let resizeAnchorY: 'start' | 'end' = 'start'

/** Paso de la grilla (celda útil + gap), el que mapea píxeles a bordes de celda. */
function gridStep(containerPx: number, count: number) {
  return (containerPx + GRID_GAP) / count
}

function applyResizeOffset() {
  const el = elRef.value
  if (!el) return
  el.style.width = `${resizeBaseW + resizeAccumW}px`
  el.style.height = `${resizeBaseH + resizeAccumH}px`
  // Al tirar de arriba/izquierda el borde opuesto queda anclado: crecer hacia
  // ese lado se compensa desplazando el item con transform (solo preview).
  el.style.transform = `translate(${resizeAccumLeft}px, ${resizeAccumTop}px)`
}

/**
 * Celdas enteras que ocuparía el ítem si se soltara ahora mismo. Es la única
 * fuente del snap: la usan tanto la previsualización en vivo como el evento de
 * fin de gesto, así el widget cae exactamente donde se previsualizó.
 */
function dragCells() {
  const stepW = gridStep(containerWidth, COLS)
  const stepH = gridStep(containerHeight, ROWS)
  return pxToCells(
    props.item.x * stepW + dragAccumX,
    props.item.y * stepH + dragAccumY,
    props.item.w * stepW,
    props.item.h * stepH,
    containerWidth,
    containerHeight,
    { minW: props.item.minW, minH: props.item.minH, gap: GRID_GAP }
  )
}

function resizeCells() {
  const stepW = gridStep(containerWidth, COLS)
  const stepH = gridStep(containerHeight, ROWS)
  return pxToCells(
    props.item.x * stepW + resizeAccumLeft,
    props.item.y * stepH + resizeAccumTop,
    props.item.w * stepW + resizeAccumW,
    props.item.h * stepH + resizeAccumH,
    containerWidth,
    containerHeight,
    {
      minW: props.item.minW,
      minH: props.item.minH,
      gap: GRID_GAP,
      anchorX: resizeAnchorX,
      anchorY: resizeAnchorY,
    }
  )
}

/** Previsualización inicial: la geometría actual del ítem en celdas. */
function emitItemPreview() {
  lastPreviewCells = { x: props.item.x, y: props.item.y, w: props.item.w, h: props.item.h }
  emit('preview', props.item.i, props.item.x, props.item.y, props.item.w, props.item.h)
}

/** Emite la zona de destino sólo si sus celdas cambiaron respecto de la última. */
function emitPreviewCells(cells: Cells) {
  const last = lastPreviewCells
  if (
    last &&
    last.x === cells.x &&
    last.y === cells.y &&
    last.w === cells.w &&
    last.h === cells.h
  ) {
    return
  }
  lastPreviewCells = { x: cells.x, y: cells.y, w: cells.w, h: cells.h }
  emit('preview', props.item.i, cells.x, cells.y, cells.w, cells.h)
}

/** Previsualización del destino en vivo; se omite sin contenedor medible. */
function emitDragPreview() {
  if (containerWidth <= 0 || containerHeight <= 0) return
  emitPreviewCells(dragCells())
}

function emitResizePreview() {
  if (containerWidth <= 0 || containerHeight <= 0) return
  emitPreviewCells(resizeCells())
}

useDashDrag(elRef, editModeRef, {
  onDragStart() {
    measureContainer()
    isDragging.value = true
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    resizeAccumLeft = 0
    resizeAccumTop = 0
    emitItemPreview()
  },
  onDragMove(dx, dy) {
    dragAccumX += dx
    dragAccumY += dy
    const el = elRef.value
    if (el) {
      el.style.transform = `translate(${dragAccumX}px, ${dragAccumY}px)`
    }
    emitDragPreview()
  },
  onDragEnd() {
    const el = elRef.value
    const first = el ? elementRect(el) : ZERO_RECT
    if (el) {
      el.style.transform = ''
    }
    const snapped = dragCells()
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    resizeAccumLeft = 0
    resizeAccumTop = 0
    isDragging.value = false
    emit('moved', props.item.i, snapped.x, snapped.y)
    emit('preview-end')
    if (el) {
      nextTick(() => applyFlip(first))
    }
  },
  onResizeStart() {
    measureContainer()
    isDragging.value = true
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    resizeAccumLeft = 0
    resizeAccumTop = 0
    resizeAnchorX = 'start'
    resizeAnchorY = 'start'
    const el = elRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      // getBoundingClientRect puede devolver 0 en happy-dom; fallback a la geometría de grilla
      if (rect.width > 0 && rect.height > 0) {
        resizeBaseW = rect.width
        resizeBaseH = rect.height
      } else {
        resizeBaseW = (props.item.w / COLS) * containerWidth
        resizeBaseH = (props.item.h / ROWS) * containerHeight
      }
    }
    applyResizeOffset()
    emitItemPreview()
  },
  onResizeMove(dw, dh, dl = 0, dt = 0) {
    resizeAccumW += dw
    resizeAccumH += dh
    resizeAccumLeft += dl
    resizeAccumTop += dt
    // El borde que interactjs mueve marca qué arista opuesta queda anclada.
    if (dl !== 0) resizeAnchorX = 'end'
    if (dt !== 0) resizeAnchorY = 'end'
    applyResizeOffset()
    emitResizePreview()
  },
  onResizeEnd() {
    const el = elRef.value
    const first = el ? elementRect(el) : ZERO_RECT
    if (el) {
      el.style.width = ''
      el.style.height = ''
      el.style.transform = ''
    }
    const snapped = resizeCells()
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    resizeAccumLeft = 0
    resizeAccumTop = 0
    isDragging.value = false
    emit('resized', props.item.i, snapped.x, snapped.y, snapped.w, snapped.h)
    emit('preview-end')
    if (el) {
      nextTick(() => applyFlip(first))
    }
  },
})
</script>

<template>
  <div
    ref="elRef"
    :style="itemStyle"
    :class="[
      'grid-item',
      'min-h-0 min-w-0',
      editMode && 'grid-item--editable',
      isDragging && 'grid-item--dragging',
      isFlipping && 'grid-item--flip',
    ]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      data-testid="widget-content"
      class="h-full min-h-0 min-w-0"
      :style="contentStyle"
      :aria-disabled="editMode ? 'true' : undefined"
    >
      <slot />
    </div>
    <template v-if="editMode">
      <div
        v-for="handle in RESIZE_HANDLES"
        :key="handle.position"
        :data-testid="`resize-handle-${handle.position}`"
        class="absolute"
        :class="handle.classes"
      />
      <template v-if="isHovered">
        <div
          v-for="grip in CORNER_GRIPS"
          :key="grip.corner"
          :data-testid="`corner-grip-${grip.corner}`"
          class="pointer-events-none absolute z-10 h-3 w-3"
          :class="grip.anchor"
        >
          <span
            data-testid="corner-grip-line"
            class="absolute h-px w-3 bg-hairline-strong"
            :class="grip.anchor"
          />
          <span
            data-testid="corner-grip-line"
            class="absolute h-3 w-px bg-hairline-strong"
            :class="grip.anchor"
          />
        </div>
      </template>
    </template>
    <slot name="controls" />
  </div>
</template>

<style scoped>
.grid-item {
  border-radius: 2px;
  contain: layout;
}

.grid-item--editable {
  cursor: grab;
}

.grid-item--editable:active {
  cursor: grabbing;
}

.grid-item--dragging {
  opacity: 0.5;
  transition: none !important;
}

.grid-item--flip {
  will-change: transform;
}
</style>
