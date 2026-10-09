<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import MonthMini from '@/components/calendar/MonthMini.vue'
import Container from '@/components/ui/Container.vue'
import DayDetailsModal from '@/components/dashboard/DayDetailsModal.vue'
import Text from '@/components/ui/Text.vue'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2 } from 'lucide-vue-next'
import { computeLayout, type LayoutResult } from '@/lib/calendarLayout'
import { significantChange, layoutVars, quantizeLayout } from '@/lib/calendarResize'
import { DAY_LABELS } from '@/lib/calendarDates'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import type { LayoutItem } from '@/stores/dashboard'

const props = defineProps<{
  item?: LayoutItem
}>()

const store = useCalendarStore()

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const bodyRef = ref<HTMLElement | null>(null)
const layout = ref<LayoutResult | null>(null)
const offset = ref(0)
const selectedDate = ref('')
const showDayModal = ref(false)

function openDayModal(date: string) {
  selectedDate.value = date
  showDayModal.value = true
}

let resizeObserver: ResizeObserver | null = null

const targetCols = computed(() => {
  if (!props.item) return undefined
  return props.item.w
})

// El tamaño viene del contentRect del ResizeObserver, NO de leer el DOM
// (clientWidth/clientHeight) que fuerza un layout síncrono por frame.
let pendingSize: { w: number; h: number } | null = null

let rafId: number | null = null

const { transitioning, onEnd: onLayoutTransitionEnd } = useLayoutTransition()
let stopTransitionListener: (() => void) | null = null

function scheduleRecompute(size?: { w: number; h: number }) {
  if (size) pendingSize = size
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    runRecompute()
  })
}

function runRecompute() {
  // Durante una transición de layout (ej. colapso de sidebar) el panel se
  // anima por width: cada frame dispara ResizeObserver y re-flow completo.
  // El recompute se pospone y corre una única vez al terminar la transición;
  // mientras tanto el contenido se estira por CSS y se acomoda al final.
  if (transitioning.value) {
    stopTransitionListener?.()
    stopTransitionListener = onLayoutTransitionEnd(() => {
      stopTransitionListener = null
      flushRecompute()
    })
    return
  }
  recomputeNow()
}

function recomputeNow() {
  const el = bodyRef.value
  if (!el) return

  const availW = pendingSize?.w ?? el.clientWidth
  const availH = pendingSize?.h ?? el.clientHeight
  pendingSize = null

  const raw = computeLayout(availW, availH)
  if (!raw) return

  const candidate = quantizeLayout(raw)
  const change = significantChange(layout.value, candidate)

  if (change === 'none') return

  // 'layout' siempre es la fuente de verdad: se actualiza con cualquier cambio
  // significativo (estructura o tamaño en un paso discreto). Los 12 MonthMini
  // reciben props estables, así que Vue no los re-renderiza: solo el shell del
  // widget se actualiza (variables CSS + footer), que es barato.
  layout.value = candidate

  const maxOffset = Math.max(0, 12 - candidate.visibleSlots)
  offset.value = Math.min(offset.value, maxOffset)
  offset.value = Math.floor(offset.value / candidate.cols) * candidate.cols
}

function flushRecompute() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  runRecompute()
}

watch(targetCols, () => {
  flushRecompute()
})

onMounted(() => {
  store.syncYear(store.currentYear)
  if (bodyRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries?.[0]
      if (entry) {
        scheduleRecompute({ w: entry.contentRect.width, h: entry.contentRect.height })
      } else {
        scheduleRecompute()
      }
    })
    resizeObserver.observe(bodyRef.value)
  }
  flushRecompute()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  stopTransitionListener?.()
  stopTransitionListener = null
})

const viewportRef = ref<HTMLElement | null>(null)

const layoutStyle = computed(() => (layout.value ? layoutVars(layout.value) : {}))

const showArrows = computed(() => (layout.value ? !layout.value.showsAll : false))
const canGoUp = computed(() => offset.value > 0)
const canGoDown = computed(() => {
  if (!layout.value) return false
  return offset.value + layout.value.visibleSlots < 12
})

function goUp() {
  if (!canGoUp.value || !layout.value) return
  offset.value = Math.max(0, offset.value - layout.value.visibleSlots)
}

function goDown() {
  if (!canGoDown.value || !layout.value) return
  offset.value = Math.min(12 - layout.value.visibleSlots, offset.value + layout.value.visibleSlots)
}

function goPrev() {
  store.goPrevYear()
}

function goNext() {
  store.goNextYear()
}

watch(
  () => store.currentYear,
  (newYear, oldYear) => {
    if (newYear !== oldYear) {
      store.syncYear(newYear)
    }
  }
)
</script>

<template>
  <Container
    variant="default"
    glass
    padding="none"
    class="container-widget h-full overflow-hidden"
    data-testid="year-calendar-widget"
  >
    <div class="ycw" :class="layout ? `cols-${layout.cols}` : ''" :style="layoutStyle">
      <header class="ycw__header justify-start">
        <Text variant="card-title" weight="600" class="ycw__title text-left">Calendario Anual</Text>
        <Loader2
          v-if="store.syncing"
          :size="12"
          class="ycw__spinner animate-spin text-ink-tertiary"
          data-testid="sync-spinner"
        />
      </header>

      <div v-if="store.syncError" class="ycw__error" data-testid="sync-error">
        {{ store.syncError }}
      </div>

      <div ref="bodyRef" class="ycw__body">
        <div v-if="layout" class="ycw__grid-header">
          <div v-for="c in layout.cols" :key="c" class="ycw__col-header">
            <span v-for="day in DAY_LABELS" :key="day" class="ycw__day-label">{{ day }}</span>
          </div>
        </div>

        <div
          v-if="layout"
          ref="viewportRef"
          class="ycw__grid-viewport"
          :style="
            !layout.showsAll
              ? {
                  height: `var(--viewport-h)`,
                  flex: 'none',
                }
              : {}
          "
        >
          <div
            class="ycw__grid"
            :style="{
              transform: `translateY(calc(-1 * (var(--month-step) * ${Math.floor(offset / layout.cols)})))`,
            }"
          >
            <MonthMini
              v-for="m in 12"
              :key="m - 1"
              :year="store.currentYear"
              :month="m - 1"
              :month-name="MONTH_NAMES[m - 1]"
              :events-by-date="store.eventsByDate"
              :show-header="false"
              @select-day="openDayModal"
            />
          </div>
        </div>
      </div>

      <footer class="ycw__footer">
        <div class="ycw__nav-container">
          <button
            class="ycw__btn"
            data-testid="year-prev"
            :style="{
              width: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
              height: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
            }"
            @click="goPrev"
          >
            <ChevronLeft />
          </button>
          <span
            class="ycw__year"
            :style="{
              fontSize: `${Math.max(9, Math.min(16, (layout?.cellSize || 9) * 1.05))}px`,
            }"
            >{{ store.currentYear }}</span
          >
          <button
            class="ycw__btn"
            data-testid="year-next"
            :style="{
              width: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
              height: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
            }"
            @click="goNext"
          >
            <ChevronRight />
          </button>

          <template v-if="showArrows">
            <button
              class="ycw__btn"
              :disabled="!canGoUp"
              data-testid="month-up"
              :style="{
                width: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
                height: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
              }"
              @click="goUp"
            >
              <ChevronUp />
            </button>
            <button
              class="ycw__btn"
              :disabled="!canGoDown"
              data-testid="month-down"
              :style="{
                width: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
                height: `${Math.max(11, Math.min(28, (layout?.cellSize || 9) * 1.5))}px`,
              }"
              @click="goDown"
            >
              <ChevronDown />
            </button>
          </template>
        </div>
      </footer>
    </div>
    <DayDetailsModal :open="showDayModal" :date="selectedDate" @close="showDayModal = false" />
  </Container>
</template>

<style scoped>
.ycw {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ycw__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid rgb(var(--color-hairline));
  background: rgb(var(--color-surface-2));
  flex-shrink: 0;
}

.ycw__title {
  color: rgb(var(--color-ink));
  line-height: 1.2;
  word-wrap: break-word;
}

.ycw__spinner {
  flex-shrink: 0;
}

.ycw__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  border-top: 1px solid rgb(var(--color-hairline));
  background: rgb(var(--color-surface-2));
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
}

.ycw__nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
}

.ycw__nav-container:not(.has-arrows) {
  justify-content: center;
}

.ycw__year-group {
  display: flex;
  align-items: center;
  gap: calc(var(--cell-size, 9px) * 0.4);
}

.ycw__year {
  color: rgb(var(--color-ink));
  text-align: center;
  font-weight: 700;
  padding: 0 2px;
  flex-shrink: 0;
  white-space: nowrap;
}

.ycw__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid rgb(var(--color-hairline));
  background: rgb(var(--color-surface-1));
  color: rgb(var(--color-ink-muted));
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.ycw__btn :deep(svg) {
  width: 55%;
  height: 55%;
}

.ycw__btn:hover:not(:disabled) {
  background: rgb(var(--color-surface-2));
  color: rgb(var(--color-ink));
}

.ycw__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ycw__error {
  font-size: 0.75rem;
  color: rgb(var(--color-accent-red));
  padding: 4px 8px;
  line-height: 1.2;
}

.ycw__body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px;
  position: relative;
  overflow: hidden;
}

.ycw__grid-header {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: var(--grid-gap, 12px);
  flex-shrink: 0;
  margin-bottom: 6px;
}

.ycw__col-header {
  display: grid;
  grid-template-columns: repeat(7, var(--cell-size, auto));
  column-gap: var(--cell-gap-x, 2px);
  justify-content: center;
  width: 100%;
}

.ycw__day-label {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: rgb(var(--color-ink-tertiary));
  line-height: 1;
  width: var(--cell-size, auto);
}

.ycw__grid-viewport {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.ycw__grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: var(--grid-gap, 12px);
  align-content: start;
  justify-content: center;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}
</style>
