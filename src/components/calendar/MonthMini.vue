<script setup lang="ts">
import { computed } from 'vue'
import { monthGrid, DAY_LABELS, formatYyyyMmDd } from '@/lib/calendarDates'
import { eventKey } from '@/lib/entityEventLink'
import { useDayTooltip } from '@/composables/useDayTooltip'
import type { DayTooltipItem } from '@/composables/useDayTooltip'
import type { CalendarEvent, DayOverlayByDate, DayOverlayDot } from '@/schemas/calendar'
import DayTooltip from './DayTooltip.vue'

const props = withDefaults(
  defineProps<{
    year: number
    month: number
    eventsByDate: Map<string, CalendarEvent[]>
    // Capa derivada (ej. exámenes): puntos extra idénticos a los de un evento,
    // sin entrar en el CRUD del calendario.
    overlayByDate?: DayOverlayByDate
    // Eventos ya representados por un examen vinculado del mismo día: no se
    // pintan como punto (dedup), pero el tooltip los sigue mostrando.
    linkedEventKeys?: ReadonlySet<string>
    monthName?: string
    showHeader?: boolean
    today?: string
  }>(),
  {
    overlayByDate: () => new Map(),
    linkedEventKeys: () => new Set<string>(),
    monthName: '',
    showHeader: false,
  }
)

const emit = defineEmits<{
  'select-day': [date: string]
}>()

const MAX_DOTS = 4

const grid = computed(() => monthGrid(props.year, props.month, 0))

// Marca de hoy por fecha exacta: la fecha se inyecta vía prop (tests) o,
// por defecto, se toma del sistema.
const todayDate = computed(() => props.today ?? formatYyyyMmDd(new Date()))

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

function visibleDots(date: string | null): CalendarEvent[] {
  return dotEvents(date).slice(0, MAX_DOTS)
}

function overflowCount(date: string | null): number {
  return Math.max(0, dotEvents(date).length - MAX_DOTS)
}

/** Puntos derivados (exámenes) del día: se pintan como un evento más. */
function getOverlay(date: string | null): DayOverlayDot[] {
  if (!date) return []
  return props.overlayByDate.get(date) ?? []
}

/** Lo que dice el tooltip de un día: eventos + exámenes (overlay). */
function tooltipItems(date: string | null): DayTooltipItem[] {
  if (!date) return []
  const overlay = getOverlay(date).map((dot) => ({
    id: dot.id,
    title: dot.title,
    color: dot.color,
  }))
  return [...getEvents(date), ...overlay]
}

const { hovered, hideTooltip, onDayEnter } = useDayTooltip(tooltipItems)

function onDaySelect(date: string | null) {
  if (!date) return
  hideTooltip()
  emit('select-day', date)
}
</script>

<template>
  <div class="month-mini" data-testid="month-mini">
    <div v-if="monthName" class="month-mini__name">
      {{ monthName }}
    </div>
    <div v-if="showHeader" class="month-mini__headers">
      <span
        v-for="day in DAY_LABELS"
        :key="day"
        class="month-mini__header-label"
        data-testid="day-header"
        >{{ day }}</span
      >
    </div>

    <div class="month-mini__grid">
      <template v-for="(week, wi) in grid" :key="`w-${wi}`">
        <div
          v-for="(cell, di) in week"
          :key="`c-${wi}-${di}`"
          :data-testid="cell.date ? 'day-cell' : undefined"
          :class="[
            'day-cell',
            {
              'day-cell--empty': !cell.date,
              'cursor-pointer transition-colors duration-150': cell.date,
              'day-cell--today bg-accent-purple-tint ring-2 ring-inset ring-accent-purple': isToday(
                cell.date
              ),
            },
          ]"
          @click="onDaySelect(cell.date)"
          @mouseenter="onDayEnter(cell.date, $event)"
          @mouseleave="hideTooltip"
          @focus="onDayEnter(cell.date, $event)"
          @blur="hideTooltip"
        >
          <template v-if="cell.date">
            <span
              v-for="evt in visibleDots(cell.date)"
              :key="evt.id"
              class="event-dot"
              :style="{ backgroundColor: evt.color }"
              data-testid="event-dot"
            />
            <span v-if="overflowCount(cell.date) > 0" class="overflow"
              >+{{ overflowCount(cell.date) }}</span
            >
            <span
              v-for="dot in getOverlay(cell.date)"
              :key="dot.id"
              class="event-dot"
              :style="{ backgroundColor: dot.color }"
              data-testid="event-dot"
            />
          </template>
        </div>
      </template>
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
.month-mini {
  display: flex;
  flex-direction: column;
  height: var(--month-h, auto);
  box-sizing: border-box;
  width: 100%;
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto var(--month-h, auto);
}

.month-mini__name {
  text-align: center;
  font-size: calc(var(--font-size, 0.576rem) * var(--text-scale, 1));
  font-weight: 600;
  color: rgb(var(--color-ink-muted));
  text-transform: capitalize;
  line-height: 1.2;
  height: var(--month-header, auto);
  margin-bottom: var(--name-gap, 4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-mini__headers {
  display: grid;
  grid-template-columns: repeat(7, var(--cell-size, auto));
  column-gap: var(--cell-gap-x, 2px);
  row-gap: var(--cell-gap-y, 2px);
  justify-content: center;
}

.month-mini__header-label {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1;
  color: rgb(var(--color-ink-tertiary));
  width: var(--cell-size, auto);
}

.month-mini__grid {
  display: grid;
  grid-template-columns: repeat(7, var(--cell-size, auto));
  column-gap: var(--cell-gap-x, 2px);
  row-gap: var(--cell-gap-y, 2px);
  justify-content: center;
}

.day-cell {
  width: var(--cell-size, auto);
  height: var(--cell-size, auto);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: calc(var(--cell-size) * 0.06);
  overflow: hidden;
  background: rgb(var(--color-surface-3));
  border-radius: 2px;
  padding: calc(var(--cell-size) * 0.06);
  box-sizing: border-box;
}

.day-cell--empty {
  background: transparent;
}

.month-mini__grid .day-cell:not(.day-cell--empty):not(.day-cell--today):hover {
  background: rgb(var(--color-surface-4));
}

.event-dot {
  width: calc(var(--cell-size) * 0.3);
  height: calc(var(--cell-size) * 0.3);
  border-radius: 9999px;
  flex-shrink: 0;
}

.overflow {
  font-size: calc(var(--cell-size) * 0.44);
  line-height: 1;
  color: rgb(var(--color-ink-tertiary));
}
</style>
