<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DAY_LABELS, formatYyyyMmDd } from '@/lib/calendarDates'
import { eventKey, type LinkedEventItem } from '@/lib/entityEventLink'
import { useDayTooltip } from '@/composables/useDayTooltip'
import type { DayTooltipItem } from '@/composables/useDayTooltip'
import DayTooltip from '@/components/calendar/DayTooltip.vue'
import {
  STRIP_CHROME,
  STRIP_LABEL_W,
  buildYearStrip,
  computeStripCellSize,
  monthDividers,
  stripGap,
  type MonthDivider,
} from '@/lib/calendarHeatmap'
import type { CalendarEvent, DayOverlayByDate, DayOverlayDot } from '@/schemas/calendar'

const props = withDefaults(
  defineProps<{
    year: number
    eventsByDate: Map<string, CalendarEvent[]>
    // Capa derivada (ej. exámenes): puntos extra idénticos a los de un evento,
    // sin entrar en el CRUD del calendario.
    overlayByDate?: DayOverlayByDate
    // Eventos ya representados por un examen vinculado del mismo día: no se
    // pintan como punto ni se listan en el tooltip (dedup). El examen los
    // representa una sola vez.
    linkedEventKeys?: ReadonlySet<string>
    // Cómo se pinta un evento que ya representa a una entidad (ej. una tarea):
    // con el título y el color de la entidad, igual que en «Agenda del Día».
    linkedEventItems?: ReadonlyMap<string, LinkedEventItem>
    monthNames?: string[]
    highlightMonth?: number | null
    today?: string
    cellSize?: number | null
  }>(),
  {
    overlayByDate: () => new Map(),
    linkedEventKeys: () => new Set<string>(),
    linkedEventItems: () => new Map(),
    monthNames: () => [
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
    ],
    highlightMonth: null,
    today: undefined,
    cellSize: null,
  }
)

const emit = defineEmits<{
  'select-day': [date: string]
  'month-click': [month: number]
}>()

const MAX_DOTS = 4
const LABEL_W = STRIP_LABEL_W

const rootRef = ref<HTMLElement | null>(null)
const autoCell = ref(computeStripCellSize(800, 400))

const cell = computed(() => props.cellSize ?? autoCell.value)
const gap = computed(() => stripGap(cell.value))
const headerH = STRIP_CHROME.header

const strip = computed(() => buildYearStrip(props.year))
const dividers = computed(() => monthDividers(strip.value.weeks, strip.value.spans))

const todayDate = computed(() => props.today ?? formatYyyyMmDd(new Date()))

const highlight = computed(() => {
  if (props.highlightMonth !== null && props.highlightMonth !== undefined) {
    return props.highlightMonth
  }
  const now = new Date()
  if (props.year !== now.getFullYear()) return -1
  return now.getMonth()
})

function isToday(date: string | null): boolean {
  return date !== null && date === todayDate.value
}

function getEvents(date: string | null): CalendarEvent[] {
  if (!date) return []
  return props.eventsByDate.get(date) ?? []
}

/** Eventos que se pintan como punto: excluye los ya representados por un examen. */
function dotEvents(date: string | null): CalendarEvent[] {
  return getEvents(date).filter((e) => !props.linkedEventKeys.has(eventKey(e.calendarId, e.id)))
}

/**
 * Lo que dice el tooltip de un día: eventos + exámenes (overlay). Usa los
 * mismos eventos y colores que los puntos: un evento ya representado por un
 * examen no se lista, y uno que representa a una tarea se pinta con el título
 * y el color de la tarea.
 */
function tooltipItems(date: string | null): DayTooltipItem[] {
  if (!date) return []
  const overlay = getOverlay(date).map((dot) => ({
    id: dot.id,
    title: dot.title,
    color: dot.color,
  }))
  return [...dotEvents(date).map(calendarItem), ...overlay]
}

const { hovered, hideTooltip, onDayEnter } = useDayTooltip(tooltipItems)
function onDaySelect(date: string | null) {
  if (!date) return
  hideTooltip()
  emit('select-day', date)
}

function visibleDots(date: string | null): LinkedEventItem[] {
  return dotEvents(date).slice(0, MAX_DOTS).map(calendarItem)
}

/** Cómo se pinta un evento: con los datos de su entidad si la representa. */
function calendarItem(evt: CalendarEvent): LinkedEventItem {
  return props.linkedEventItems.get(eventKey(evt.calendarId, evt.id)) ?? evt
}

function overflowCount(date: string | null): number {
  return Math.max(0, dotEvents(date).length - MAX_DOTS)
}

/** Puntos derivados (exámenes) del día: se pintan como un evento más. */
function getOverlay(date: string | null): DayOverlayDot[] {
  if (!date) return []
  return props.overlayByDate.get(date) ?? []
}

function shortMonthLabel(name: string): string {
  const short = name.slice(0, 3)
  return short.charAt(0).toUpperCase() + short.slice(1)
}

function isHighlightDivider(d: MonthDivider): boolean {
  return d.fromMonth === highlight.value - 1 || d.fromMonth === highlight.value
}

const colCount = computed(() => strip.value.weeks.length)

const gridCols = computed(() => `${LABEL_W}px repeat(${colCount.value}, ${cell.value}px)`)

const contentW = computed(
  () => LABEL_W + gap.value + colCount.value * cell.value + (colCount.value - 1) * gap.value
)
const contentH = computed(() => headerH + gap.value + 7 * cell.value + 6 * gap.value)

function toPxX(x: number): number {
  return LABEL_W + gap.value + x * (cell.value + gap.value) - gap.value / 2
}

function toPxY(y: number): number {
  return headerH + gap.value + y * (cell.value + gap.value) - gap.value / 2
}

function dividerPointsAttr(d: MonthDivider): string {
  return d.points.map((p) => `${toPxX(p.x)},${toPxY(p.y)}`).join(' ')
}

let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null

function recompute() {
  const el = rootRef.value
  if (!el || props.cellSize) return
  autoCell.value = computeStripCellSize(
    el.clientWidth || 800,
    el.clientHeight || 400,
    strip.value.weeks.length
  )
}

function scheduleRecompute() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    recompute()
  })
}

onMounted(() => {
  recompute()
  if (rootRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleRecompute())
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})
</script>

<template>
  <div ref="rootRef" class="ys" data-testid="year-strip">
    <div class="ys__scroller" data-testid="tira-scroller" @scroll="hideTooltip">
      <div class="ys__content" :style="{ width: `${contentW}px`, height: `${contentH}px` }">
        <div
          class="ys__months"
          :style="{
            gridTemplateColumns: gridCols,
            height: `${headerH}px`,
            columnGap: `${gap}px`,
            marginBottom: `${gap}px`,
          }"
        >
          <div class="ys__corner" />
          <div
            v-for="span in strip.spans"
            :key="span.month"
            class="ys__month cursor-pointer"
            data-testid="strip-month"
            :style="{ gridColumn: `${span.startCol + 2} / span ${span.span}` }"
            @click="emit('month-click', span.month)"
          >
            {{ shortMonthLabel(monthNames[span.month]) }}
          </div>
        </div>

        <div class="ys__body" :style="{ gridTemplateColumns: gridCols, gap: `${gap}px` }">
          <span
            v-for="r in 7"
            :key="`label-${r}`"
            class="ys__row-label"
            data-testid="strip-day-label"
            :style="{ gridRow: r, gridColumn: 1, width: `${LABEL_W}px`, height: `${cell}px` }"
            >{{ DAY_LABELS[r - 1] }}</span
          >
          <template v-for="(week, c) in strip.weeks" :key="`w-${c}`">
            <div
              v-for="(cellData, r) in week.cells"
              :key="`c-${c}-${r}`"
              :data-testid="cellData.date ? 'strip-cell' : 'strip-cell-empty'"
              :data-date="cellData.date ?? undefined"
              :class="[
                'ys__cell',
                {
                  'ys__cell--empty': !cellData.date,
                  'ys__cell--today': isToday(cellData.date),
                },
              ]"
              :style="{
                gridRow: r + 1,
                gridColumn: c + 2,
                width: `${cell}px`,
                height: `${cell}px`,
              }"
              @click="onDaySelect(cellData.date)"
              @mouseenter="onDayEnter(cellData.date, $event)"
              @mouseleave="hideTooltip"
              @focus="onDayEnter(cellData.date, $event)"
              @blur="hideTooltip"
            >
              <template v-if="cellData.date">
                <span
                  v-for="evt in visibleDots(cellData.date)"
                  :key="evt.id"
                  class="ys__dot"
                  :style="{ backgroundColor: evt.color }"
                  data-testid="event-dot"
                />
                <span v-if="overflowCount(cellData.date) > 0" class="ys__overflow"
                  >+{{ overflowCount(cellData.date) }}</span
                >
                <span
                  v-for="dot in getOverlay(cellData.date)"
                  :key="dot.id"
                  class="ys__dot"
                  :style="{ backgroundColor: dot.color }"
                  data-testid="event-dot"
                />
              </template>
            </div>
          </template>
        </div>

        <svg
          class="ys__dividers"
          :width="contentW"
          :height="contentH"
          :viewBox="`0 0 ${contentW} ${contentH}`"
        >
          <polyline
            v-for="d in dividers"
            :key="`d-${d.fromMonth}`"
            data-testid="strip-divider"
            :data-highlight="isHighlightDivider(d) ? 'true' : 'false'"
            :points="dividerPointsAttr(d)"
            :class="['ys__divider', { 'ys__divider--hl': isHighlightDivider(d) }]"
          />
        </svg>
      </div>
    </div>
    <DayTooltip
      v-if="hovered"
      :date-label="hovered.label"
      :events="hovered.events"
      :overflow-count="hovered.overflow"
      :position="hovered.position"
    />
  </div>
</template>

<style scoped>
.ys {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  display: flex;
}

.ys__scroller {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--color-hairline-strong)) transparent;
}

.ys__scroller::-webkit-scrollbar {
  height: 4px;
}

.ys__scroller::-webkit-scrollbar-thumb {
  background: rgb(var(--color-hairline-strong));
  border-radius: 2px;
}

.ys__scroller::-webkit-scrollbar-track {
  background: transparent;
}

.ys__content {
  position: relative;
  margin: auto;
  flex: none;
}

.ys__months {
  display: grid;
  /* El margen real lo pone el inline style (= gap dinámico); esto es fallback. */
  column-gap: 2px;
  margin-bottom: 2px;
}

.ys__corner {
  grid-column: 1;
}

.ys__month {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: rgb(var(--color-ink-muted));
  text-transform: capitalize;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
}

.ys__body {
  display: grid;
  position: relative;
}

.ys__row-label {
  grid-column: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: rgb(var(--color-ink-tertiary));
  line-height: 1;
}

.ys__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: calc(v-bind(cell) * 1px * 0.06);
  overflow: hidden;
  background: rgb(var(--color-surface-3));
  border-radius: 2px;
  box-sizing: border-box;
  padding: calc(v-bind(cell) * 1px * 0.06);
}

.ys__cell--empty {
  background: transparent;
}

.ys__body .ys__cell:not(.ys__cell--empty) {
  cursor: pointer;
}

.ys__body .ys__cell:not(.ys__cell--empty):not(.ys__cell--today):hover {
  background: rgb(var(--color-surface-4));
}

.ys__cell--today {
  background: rgb(var(--color-accent-purple-tint));
  box-shadow: inset 0 0 0 2px rgb(var(--color-accent-purple));
}

.ys__dot {
  width: calc(v-bind(cell) * 1px * 0.3);
  height: calc(v-bind(cell) * 1px * 0.3);
  border-radius: 9999px;
  flex-shrink: 0;
}

.ys__overflow {
  font-size: calc(v-bind(cell) * 1px * 0.44);
  line-height: 1;
  color: rgb(var(--color-ink-tertiary));
}

.ys__dividers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ys__divider {
  fill: none;
  stroke: rgb(var(--color-hairline-tertiary));
  stroke-width: 1;
  opacity: 1;
}

.ys__divider--hl {
  stroke: rgb(var(--color-accent-purple));
  stroke-width: 1.5;
  opacity: 1;
}
</style>
