<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useExamsStore } from '@/stores/exams'
import { useTasksStore } from '@/stores/tasks'
import MonthMini from '@/components/calendar/MonthMini.vue'
import YearStrip from '@/components/dashboard/YearStrip.vue'
import YearCalendarSettingsModal from '@/components/dashboard/YearCalendarSettingsModal.vue'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import DayDetailsModal from '@/components/dashboard/DayDetailsModal.vue'
import Text from '@/components/ui/Text.vue'
import { ChevronLeft, ChevronRight, Loader2, Settings } from 'lucide-vue-next'
import { computeScrollableLayout, colsForItemWidth, type LayoutResult } from '@/lib/calendarLayout'
import { significantChange, layoutVars } from '@/lib/calendarResize'
import {
  loadStripPreference,
  resolveStripMode,
  saveStripPreference,
  type ResolvedStripMode,
  type StripModePreference,
} from '@/lib/calendarHeatmap'
import { DAY_LABELS } from '@/lib/calendarDates'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import type { LayoutItem } from '@/stores/dashboard'

const props = defineProps<{
  item?: LayoutItem
}>()

const store = useCalendarStore()
const exams = useExamsStore()
const tasks = useTasksStore()

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
const viewportRef = ref<HTMLElement | null>(null)

/** Ancho reservado para la scrollbar del viewport: la grilla se calcula sin esos px. */
const SCROLLBAR_RESERVE = 8
const layout = ref<LayoutResult | null>(null)
const selectedDate = ref('')
const showDayModal = ref(false)
const showSettings = ref(false)

// Preferencia de vista meses/tira (persistida) y modo resuelto con histéresis:
// arranca en meses hasta la primera medición.
const pref = ref<StripModePreference>(loadStripPreference())
const resolvedMode = ref<ResolvedStripMode>('meses')
const lastMeasured = ref<{ w: number; h: number } | null>(null)

function openDayModal(date: string) {
  selectedDate.value = date
  showDayModal.value = true
}

let resizeObserver: ResizeObserver | null = null

const targetCols = computed(() => {
  if (!props.item) return undefined
  return props.item.w
})

function resolveMode(w: number, h: number): ResolvedStripMode {
  const next = resolveStripMode(pref.value, w, h, props.item?.w, props.item?.h, resolvedMode.value)
  resolvedMode.value = next
  return next
}

function savePref(mode: StripModePreference) {
  pref.value = mode
  saveStripPreference(mode)
  showSettings.value = false
  if (lastMeasured.value) {
    resolveMode(lastMeasured.value.w, lastMeasured.value.h)
  }
  if (resolvedMode.value === 'meses') {
    flushRecompute()
  }
}

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
  lastMeasured.value = { w: availW, h: availH }

  // La tira no usa el layout de meses: se resuelve el modo y, si toca tira,
  // se deja el layout de meses intacto (el footer usa fallbacks).
  if (resolveMode(availW, availH) === 'tira') return

  // Modo meses scrolleable: columnas por el ancho del item del dashboard
  // (w=1 -> 1, w=2 -> 2) y celda solo por ancho con mínimo legible 10px.
  // El alto no achica celdas: el viewport scrollea en vertical.
  // Se reserva el ancho de la scrollbar para que la grilla nunca quede
  // debajo de ella (sin celdas recortadas a la derecha).
  const cols = colsForItemWidth(props.item?.w, availW)
  const candidate = computeScrollableLayout(Math.max(0, availW - SCROLLBAR_RESERVE), cols)
  if (!candidate) return

  const change = significantChange(layout.value, candidate)

  if (change === 'none') return

  // 'layout' siempre es la fuente de verdad: se actualiza con cualquier cambio
  // significativo (estructura o tamaño en un paso discreto). Los 12 MonthMini
  // reciben props estables, así que Vue no los re-renderiza: solo el shell del
  // widget se actualiza (variables CSS + footer), que es barato.
  const isFirstLayout = layout.value === null
  layout.value = candidate

  if (isFirstLayout) {
    // Al abrir, scrollear al mes actual para que quede visible (ej. octubre).
    scrollToCurrentMonth()
    return
  }
}

function scrollToMonth(monthIndex: number) {
  const el = viewportRef.value
  const l = layout.value
  if (!el || !l) return
  const row = Math.floor(monthIndex / l.cols)
  el.scrollTop = row * (l.monthHeight + l.gridGap)
}

function scrollToCurrentMonth() {
  const now = new Date()
  const target = store.currentYear === now.getFullYear() ? now.getMonth() : 0
  void nextTick(() => scrollToMonth(target))
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
  // El store restaura los tokens de forma asíncrona al crearse. Esperar a
  // configReady evita sincronizar con connected=false en cold start (lo que
  // dejaba solo eventos locales hasta revisitar Configuración).
  void (async () => {
    try {
      await store.configReady
    } catch {
      // Si falla la restauración igual se intenta el sync (carga locales).
    }
    void store.syncYear(store.currentYear)
  })()
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

const layoutStyle = computed(() => (layout.value ? layoutVars(layout.value) : {}))

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
      scrollToCurrentMonth()
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
        <Text variant="card-title" weight="600" class="ycw__title min-w-0 flex-1 truncate text-left"
          >Calendario Anual</Text
        >
        <Loader2
          v-if="store.syncing"
          :size="12"
          class="ycw__spinner animate-spin text-ink-tertiary"
          data-testid="sync-spinner"
        />
        <div v-if="resolvedMode === 'tira'" class="ycw__head-year shrink-0">
          <button class="ycw__btn ycw__btn--sm" data-testid="year-prev" @click="goPrev">
            <ChevronLeft />
          </button>
          <span class="ycw__year ycw__year--sm">{{ store.currentYear }}</span>
          <button class="ycw__btn ycw__btn--sm" data-testid="year-next" @click="goNext">
            <ChevronRight />
          </button>
        </div>
        <IconButton
          label="Ajustes del calendario"
          size="sm"
          :class="resolvedMode === 'tira' ? 'shrink-0' : 'ml-auto shrink-0'"
          data-testid="yearcal-settings"
          @click="showSettings = true"
        >
          <Settings class="h-3.5 w-3.5 text-ink-muted" />
        </IconButton>
      </header>

      <div v-if="store.syncError" class="ycw__error" data-testid="sync-error">
        {{ store.syncError }}
      </div>

      <div ref="bodyRef" class="ycw__body">
        <YearStrip
          v-if="resolvedMode === 'tira'"
          :year="store.currentYear"
          :events-by-date="store.eventsByDate"
          :linked-event-keys="exams.linkedEventKeys"
          :linked-event-items="tasks.linkedEventItems"
          :overlay-by-date="exams.overlayByDate"
          :month-names="MONTH_NAMES"
          @select-day="openDayModal"
        />
        <template v-else>
          <div v-if="layout" class="ycw__grid-header">
            <div v-for="c in layout.cols" :key="c" class="ycw__col-header">
              <span v-for="day in DAY_LABELS" :key="day" class="ycw__day-label">{{ day }}</span>
            </div>
          </div>

          <div
            v-if="layout"
            ref="viewportRef"
            class="ycw__grid-viewport"
            data-testid="year-grid-viewport"
          >
            <div class="ycw__grid">
              <MonthMini
                v-for="m in 12"
                :key="m - 1"
                :year="store.currentYear"
                :month="m - 1"
                :month-name="MONTH_NAMES[m - 1]"
                :events-by-date="store.eventsByDate"
                :linked-event-keys="exams.linkedEventKeys"
                :linked-event-items="tasks.linkedEventItems"
                :overlay-by-date="exams.overlayByDate"
                :show-header="false"
                @select-day="openDayModal"
              />
            </div>
          </div>
        </template>
      </div>

      <footer v-if="resolvedMode === 'meses'" class="ycw__footer">
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
        </div>
      </footer>
    </div>
    <DayDetailsModal :open="showDayModal" :date="selectedDate" @close="showDayModal = false" />
    <YearCalendarSettingsModal
      :open="showSettings"
      :value="pref"
      @close="showSettings = false"
      @save="savePref"
    />
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
  min-width: 0;
}

.ycw__header > button {
  flex-shrink: 0;
}

.ycw__title {
  color: rgb(var(--color-ink));
  line-height: 1.2;
  word-wrap: break-word;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ycw__spinner {
  flex-shrink: 0;
}

.ycw__head-year {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
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

.ycw__year--sm {
  font-size: 0.75rem;
  min-width: 3em;
}

.ycw__btn--sm {
  width: 22px;
  height: 22px;
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
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  width: 100%;
  padding-right: 2px;
  scrollbar-gutter: stable;
  /* Solo ::-webkit-scrollbar a propósito (sin scrollbar-width/color): esas
     props activan la barra nativa (~10px, con su propio hover) e ignoran el
     ancho webkit. Así el ancho queda fijo en 4px en Chromium y WebKitGTK. */
  scrollbar-width: auto;
  scrollbar-color: auto;
}

.ycw__grid-viewport::-webkit-scrollbar {
  width: 4px;
}

.ycw__grid-viewport::-webkit-scrollbar-track {
  background: transparent;
}

.ycw__grid-viewport::-webkit-scrollbar-thumb {
  background: transparent;
  border: 0;
  background-clip: border-box;
  border-radius: 999px;
  transition: background 0.2s;
}

.ycw:hover .ycw__grid-viewport::-webkit-scrollbar-thumb {
  background: rgb(var(--color-surface-4));
}

/* Hover directo sobre la barra: mismo color y ancho, no crece ni cambia. */
.ycw__grid-viewport::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--color-surface-4));
}

/* Firefox ignora ::-webkit-scrollbar: ahí se usa la nativa fina, que no
   cambia de tamaño en hover. */
@-moz-document url-prefix() {
  .ycw__grid-viewport {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  .ycw:hover .ycw__grid-viewport {
    scrollbar-color: rgb(var(--color-surface-4)) transparent;
  }
}

.ycw__grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: var(--grid-gap, 12px);
  align-content: start;
  justify-content: center;
}
</style>
