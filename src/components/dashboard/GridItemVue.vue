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
import { COLS, ROWS, itemZIndex } from '@/lib/grid'

const props = defineProps<{
  item: LayoutItem
  editMode: boolean
}>()

const emit = defineEmits<{
  moved: [id: string, x: number, y: number]
  resized: [id: string, w: number, h: number]
}>()

const elRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isFlipping = ref(false)

const gridStyle = computed(() => ({
  gridColumn: `${props.item.x + 1} / span ${props.item.w}`,
  gridRow: `${props.item.y + 1} / span ${props.item.h}`,
}))

const DRAGGING_Z_INDEX = COLS * ROWS + 1

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

function containerSize() {
  const container = elRef.value?.parentElement
  return {
    containerWidth: container?.clientWidth ?? 0,
    containerHeight: container?.clientHeight ?? 0,
  }
}

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
let resizeBaseW = 0
let resizeBaseH = 0

function applyResizeOffset() {
  const el = elRef.value
  if (!el) return
  el.style.width = `${resizeBaseW + resizeAccumW}px`
  el.style.height = `${resizeBaseH + resizeAccumH}px`
}

useDashDrag(elRef, editModeRef, {
  onDragStart() {
    isDragging.value = true
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
  },
  onDragMove(dx, dy) {
    dragAccumX += dx
    dragAccumY += dy
    const el = elRef.value
    if (el) {
      el.style.transform = `translate(${dragAccumX}px, ${dragAccumY}px)`
    }
  },
  onDragEnd() {
    const el = elRef.value
    const first = el ? elementRect(el) : ZERO_RECT
    if (el) {
      el.style.transform = ''
    }
    const { containerWidth, containerHeight } = containerSize()
    const colWidth = containerWidth / COLS
    const rowHeight = containerHeight / ROWS
    const startLeft = props.item.x * colWidth
    const startTop = props.item.y * rowHeight
    const snapped = pxToCells(
      startLeft + dragAccumX,
      startTop + dragAccumY,
      props.item.w * colWidth,
      props.item.h * rowHeight,
      containerWidth,
      containerHeight,
      { minW: props.item.minW, minH: props.item.minH }
    )
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    isDragging.value = false
    emit('moved', props.item.i, snapped.x, snapped.y)
    if (el) {
      nextTick(() => applyFlip(first))
    }
  },
  onResizeStart() {
    isDragging.value = true
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    const el = elRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      // getBoundingClientRect puede devolver 0 en happy-dom; fallback a la geometría de grilla
      if (rect.width > 0 && rect.height > 0) {
        resizeBaseW = rect.width
        resizeBaseH = rect.height
      } else {
        const { containerWidth, containerHeight } = containerSize()
        resizeBaseW = (props.item.w / COLS) * containerWidth
        resizeBaseH = (props.item.h / ROWS) * containerHeight
      }
    }
    applyResizeOffset()
  },
  onResizeMove(dw, dh) {
    resizeAccumW += dw
    resizeAccumH += dh
    applyResizeOffset()
  },
  onResizeEnd() {
    const el = elRef.value
    const first = el ? elementRect(el) : ZERO_RECT
    if (el) {
      el.style.width = ''
      el.style.height = ''
    }
    const { containerWidth, containerHeight } = containerSize()
    const colWidth = containerWidth / COLS
    const rowHeight = containerHeight / ROWS
    const snapped = pxToCells(
      props.item.x * colWidth,
      props.item.y * rowHeight,
      props.item.w * colWidth + resizeAccumW,
      props.item.h * rowHeight + resizeAccumH,
      containerWidth,
      containerHeight,
      { minW: props.item.minW, minH: props.item.minH }
    )
    dragAccumX = 0
    dragAccumY = 0
    resizeAccumW = 0
    resizeAccumH = 0
    isDragging.value = false
    emit('resized', props.item.i, snapped.w, snapped.h)
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
  >
    <div
      data-testid="widget-content"
      class="h-full min-h-0 min-w-0"
      :style="contentStyle"
      :aria-disabled="editMode ? 'true' : undefined"
    >
      <slot />
    </div>
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
  transition: none !important;
}

.grid-item--flip {
  will-change: transform;
}
</style>
