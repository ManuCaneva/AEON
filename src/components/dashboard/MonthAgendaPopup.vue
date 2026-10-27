<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { monthGridFull, formatYyyyMmDd } from '@/lib/calendarDates'
import { colorWithAlpha } from '@/lib/scheduleColors'
import { fitScale } from '@/lib/fitScale'
import type { MonthAgendaByDate, MonthAgendaItem } from '@/lib/monthAgenda'

const props = defineProps<{
  open: boolean
  year: number
  month: number
  agendaByDate: MonthAgendaByDate
  today?: string
}>()

const emit = defineEmits<{
  close: []
  'select-day': [date: string]
}>()

const MONTHS_ES = [
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
const WEEKDAY_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MAX_ITEMS = 4

const viewYear = ref(props.year)
const viewMonth = ref(props.month)

// Al reabrir siempre se vuelve al mes de las props, sin importar la navegación previa.
watch(
  () => props.open,
  (open) => {
    if (open) {
      viewYear.value = props.year
      viewMonth.value = props.month
      void nextTick(() => measure())
    }
  }
)

// Escala uniforme para que el popup entre en pantallas bajas sin scroll.
const contentEl = ref<HTMLElement | null>(null)
const zoom = ref(1)
const zoomStyle = computed(() => ({ zoom: zoom.value }))

function measure(): void {
  const el = contentEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const current = zoom.value || 1
  // Margen 48 (vs los 32 del modal) para absorber el redondeo del zoom sin scroll.
  zoom.value = fitScale(
    rect.width / current,
    rect.height / current,
    window.innerWidth,
    window.innerHeight,
    48
  )
}

function onResize(): void {
  if (props.open) measure()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  if (props.open) void nextTick(() => measure())
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const title = computed(() => {
  const name = MONTHS_ES[viewMonth.value]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${viewYear.value}`
})

const todayDate = computed(() => props.today ?? formatYyyyMmDd(new Date()))

const grid = computed(() => monthGridFull(viewYear.value, viewMonth.value, 0))

function shiftMonth(delta: number): void {
  const next = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
}

function goToday(): void {
  const [year, month] = todayDate.value.split('-').map(Number)
  viewYear.value = year
  viewMonth.value = month - 1
}

function itemsFor(date: string): MonthAgendaItem[] {
  return props.agendaByDate.get(date) ?? []
}

function visibleItems(date: string): MonthAgendaItem[] {
  return itemsFor(date).slice(0, MAX_ITEMS)
}

function overflowCount(date: string): number {
  return Math.max(0, itemsFor(date).length - MAX_ITEMS)
}

function itemStyle(color: string): Record<string, string> {
  return {
    backgroundColor: colorWithAlpha(color, 0.26),
    borderLeft: `2px solid ${color}`,
  }
}
</script>

<template>
  <Modal :open="props.open" size="xl" @close="emit('close')">
    <div ref="contentEl" class="flex flex-col" :style="zoomStyle">
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-3"
      >
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-md p-1 text-ink-muted hover:bg-surface-3 hover:text-ink"
            aria-label="Mes anterior"
            data-testid="month-agenda-prev"
            @click="shiftMonth(-1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1 text-ink-muted hover:bg-surface-3 hover:text-ink"
            aria-label="Mes siguiente"
            data-testid="month-agenda-next"
            @click="shiftMonth(1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
          <span class="ml-1 text-lg font-semibold text-ink" data-testid="month-agenda-title">{{
            title
          }}</span>
        </div>
        <button
          type="button"
          class="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-3 hover:text-ink"
          data-testid="month-agenda-hoy"
          @click="goToday"
        >
          Hoy
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden p-4">
        <div class="grid grid-cols-7 border-b border-hairline pb-1.5">
          <span
            v-for="label in WEEKDAY_LABELS"
            :key="label"
            class="px-1 text-[10px] font-medium uppercase tracking-wider text-ink-tertiary"
            data-testid="month-agenda-weekday"
          >
            {{ label }}
          </span>
        </div>
        <div class="grid grid-cols-7">
          <template v-for="(week, wi) in grid" :key="wi">
            <div
              v-for="(cell, di) in week"
              :key="cell.date"
              class="flex h-[118px] min-w-0 cursor-pointer flex-col gap-[2px] border-b border-r border-hairline/60 p-1 transition-colors"
              :class="[
                di === 6 ? 'border-r-0' : '',
                wi === 5 ? 'border-b-0' : '',
                cell.date === todayDate ? 'bg-accent-purple-tint/60' : 'hover:bg-surface-3/40',
                cell.inMonth ? '' : 'opacity-40',
              ]"
              data-testid="month-agenda-cell"
              :data-date="cell.date"
              @click="emit('select-day', cell.date)"
            >
              <span
                class="px-0.5 text-[11px]"
                :class="
                  cell.date === todayDate ? 'font-semibold text-accent-purple' : 'text-ink-subtle'
                "
                data-testid="month-agenda-daynum"
              >
                {{ cell.dayOfMonth }}
              </span>
              <div
                v-for="item in visibleItems(cell.date)"
                :key="item.id"
                class="truncate rounded-[3px] px-1 py-[1px] text-[10px] leading-[14px] text-ink"
                :style="itemStyle(item.color)"
                data-testid="month-agenda-item"
              >
                {{ item.title }}
              </div>
              <span
                v-if="overflowCount(cell.date) > 0"
                class="px-1 text-[10px] text-ink-tertiary"
                data-testid="month-agenda-overflow"
              >
                +{{ overflowCount(cell.date) }} más
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Modal>
</template>
