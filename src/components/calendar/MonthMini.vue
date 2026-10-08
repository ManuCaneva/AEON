<script setup lang="ts">
import { computed } from 'vue'
import { monthGrid, DAY_LABELS, formatYyyyMmDd } from '@/lib/calendarDates'
import type { CalendarEvent } from '@/schemas/calendar'

const props = withDefaults(
  defineProps<{
    year: number
    month: number
    eventsByDate: Map<string, CalendarEvent[]>
    monthName?: string
    showHeader?: boolean
    today?: string
  }>(),
  {
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

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatTooltipDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [, monthStr, dayStr] = dateStr.split('-')
  const day = parseInt(dayStr, 10)
  const monthIndex = parseInt(monthStr, 10) - 1
  return `${day} de ${MONTHS[monthIndex]}`
}

function getEvents(date: string | null): CalendarEvent[] {
  if (!date) return []
  return props.eventsByDate.get(date) ?? []
}

function visibleDots(date: string | null): CalendarEvent[] {
  return getEvents(date).slice(0, MAX_DOTS)
}

function overflowCount(date: string | null): number {
  return Math.max(0, getEvents(date).length - MAX_DOTS)
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
          :title="cell.date ? formatTooltipDate(cell.date) : undefined"
          @click="cell.date && emit('select-day', cell.date)"
        >
          <template v-if="cell.date">
            <span
              v-if="isToday(cell.date)"
              class="day-cell__today-number font-bold text-accent-purple"
              data-testid="today-number"
              >{{ cell.dayOfMonth }}</span
            >
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
          </template>
        </div>
      </template>
    </div>
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
  font-size: var(--font-size, 0.72rem);
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

.day-cell__today-number {
  font-size: calc(var(--cell-size, 14px) * 0.5);
  line-height: 1;
}
</style>
