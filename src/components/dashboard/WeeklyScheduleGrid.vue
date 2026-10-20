<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { minutesToHHMM } from '@/stores/weeklySchedule'
import { useUiStore } from '@/stores/ui'
import WeeklyScheduleBlock from './WeeklyScheduleBlock.vue'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import { dayIndexOfWeek } from '@/lib/calendarDates'
import { minutesSinceMidnight, nowLineTopPx } from '@/lib/nowLine'
import type { ScheduleBlockWithSlots, ScheduleSlot } from '@/schemas/weeklySchedule'

const props = defineProps<{
  /** Fecha de referencia para el día de hoy y la hora actual (inyectable para tests). */
  now?: Date
  /** Ocurrencia elegida en el modo edición; `null` cuando no hay ninguna. */
  selectedSlotId?: string | null
}>()

const store = useWeeklyScheduleStore()
const ui = useUiStore()
const emit = defineEmits<{
  edit: [block: ScheduleBlockWithSlots]
  select: [slotId: string | null]
  remove: [slotId: string]
}>()

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const enabledDays = computed(() => store.enabledDays)

const nowRef = ref(props.now ?? new Date())
const todayIndex = computed(() => dayIndexOfWeek(nowRef.value))

watch(
  () => props.now,
  (value) => {
    if (value) nowRef.value = value
  }
)

function refreshToday() {
  nowRef.value = new Date()
}

let todayTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // Refresca la hora y el día cada minuto: la línea de la hora actual avanza
  // sola y, al cruzar la medianoche, la marca se mueve de columna sin recargar.
  todayTimer = setInterval(refreshToday, 60_000)
  document.addEventListener('visibilitychange', refreshToday)
})
onUnmounted(() => {
  if (todayTimer !== null) clearInterval(todayTimer)
  todayTimer = null
  document.removeEventListener('visibilitychange', refreshToday)
})
const dayGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(1, enabledDays.value.length)}, minmax(0, 1fr))`,
}))

const containerRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const containerHeight = ref(400)
const containerWidth = ref(800)
const headerHeight = ref(0)

let rafId: number | null = null

const { transitioning, onEnd: onLayoutTransitionEnd } = useLayoutTransition()
let stopTransitionListener: (() => void) | null = null

function readRects() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerHeight.value = rect.height
    containerWidth.value = rect.width
  }
  headerHeight.value = headerRef.value?.getBoundingClientRect().height ?? 0
}

function measure() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (transitioning.value) {
      // Durante una transición de layout (ej. colapso de sidebar) no medimos
      // por frame: getBoundingClientRect fuerza reflow completo por frame.
      // Una única medición al terminar la transición.
      stopTransitionListener?.()
      stopTransitionListener = onLayoutTransitionEnd(() => {
        stopTransitionListener = null
        measure()
      })
      return
    }
    readRects()
  })
}

function flushMeasure() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  readRects()
}

const labelWidthPx = computed(() => {
  return Math.max(44, Math.min(72, containerWidth.value * 0.07))
})
const labelWidthStyle = computed(() => labelWidthPx.value + 'px')

let observer: ResizeObserver | null = null
onMounted(() => {
  flushMeasure()
  if (containerRef.value) {
    observer = new ResizeObserver(measure)
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  stopTransitionListener?.()
  stopTransitionListener = null
})

watch(() => [store.settings, store.visibleWindow], measure, { deep: true })

const visibleRows = computed(() => {
  const diff = store.visibleWindow.end_minutes - store.visibleWindow.start_minutes
  return Math.max(1, Math.floor(diff / store.settings.granularity_minutes))
})

const rowHeightPx = computed(() => {
  const avail = Math.max(0, containerHeight.value - headerHeight.value)
  return avail / visibleRows.value
})

const minuteHeightPx = computed(() => rowHeightPx.value / store.settings.granularity_minutes)
const windowStart = computed(() => store.visibleWindow.start_minutes)

// Línea de la hora actual: depende de nowRef (tick cada 60 s) y de la Ventana
// visible, así recalcula sola cuando cambia la ventana o pasa el minuto.
const nowLineTop = computed(() =>
  nowLineTopPx(minutesSinceMidnight(nowRef.value), store.visibleWindow, minuteHeightPx.value)
)

const hourLabels = computed(() => {
  const out: { minute: number; label: string }[] = []
  const start = store.visibleWindow.start_minutes
  const end = store.visibleWindow.end_minutes
  const step = store.settings.granularity_minutes
  for (let m = start; m < end; m += step) {
    out.push({ minute: m, label: minutesToHHMM(m) })
  }
  return out
})

const gridTotalHeightPx = computed(() => visibleRows.value * rowHeightPx.value)
const gridHeightStyle = computed(() => gridTotalHeightPx.value + 'px')
const rowHeightStyle = computed(() => rowHeightPx.value + 'px')

interface VisibleSlot {
  slot: ScheduleSlot
  block: ScheduleBlockWithSlots
  clipStart: number
  clipEnd: number
}

function slotTopPx(vs: VisibleSlot) {
  return (vs.clipStart - windowStart.value) * minuteHeightPx.value
}

function slotHeightPx(vs: VisibleSlot) {
  return (vs.clipEnd - vs.clipStart) * minuteHeightPx.value
}

const visibleSlots = computed((): VisibleSlot[] => {
  const start = store.visibleWindow.start_minutes
  const end = store.visibleWindow.end_minutes
  const result: VisibleSlot[] = []
  for (const bw of store.blocksWithSlots) {
    for (const slot of bw.slots) {
      const clipStart = Math.max(slot.start_minutes, start)
      const clipEnd = Math.min(slot.end_minutes, end)
      if (clipEnd <= clipStart) continue
      result.push({ slot, block: bw, clipStart, clipEnd })
    }
  }
  return result
})

function slotsForDay(day: number): VisibleSlot[] {
  return visibleSlots.value.filter((vs) => vs.slot.day_of_week === day)
}

// En el modo edición cada ocurrencia descubre su × al pasar el mouse. El
// puntero pasa del bloque a la × (que vive fuera del bloque para no anidar
// botones): si el mouse sale del bloque hacia su propia ×, se mantiene visible.
const hoveredSlotId = ref<string | null>(null)

watch(
  () => ui.scheduleEditMode,
  (active) => {
    if (!active) hoveredSlotId.value = null
  }
)

function onSlotEnter(slotId: string) {
  if (ui.scheduleEditMode) hoveredSlotId.value = slotId
}

function onSlotLeave(slotId: string, event: MouseEvent) {
  const next = event.relatedTarget as HTMLElement | null
  if (next?.closest?.('[data-testid="schedule-slot-delete"]')) return
  if (hoveredSlotId.value === slotId) hoveredSlotId.value = null
}

function isDeleteVisible(slotId: string): boolean {
  return ui.scheduleEditMode && hoveredSlotId.value === slotId
}

function onSlotClick(vs: VisibleSlot) {
  if (!ui.scheduleEditMode) {
    emit('edit', vs.block)
    return
  }
  emit('select', vs.slot.id)
}

/** Click en un hueco de la grilla: limpia la selección. */
function onGridClick(event: MouseEvent) {
  if (!ui.scheduleEditMode) return
  const target = event.target as HTMLElement | null
  if (target?.closest?.('.schedule-block')) return
  if (target?.closest?.('[data-testid="schedule-slot-delete"]')) return
  emit('select', null)
}
</script>

<template>
  <div ref="containerRef" class="relative flex h-full min-h-0 w-full select-none flex-col">
    <div class="relative min-h-0 flex-1 overflow-hidden bg-transparent">
      <div
        ref="headerRef"
        class="schedule-header flex flex-shrink-0 border-b border-hairline bg-transparent"
      >
        <div :style="{ width: labelWidthStyle }" class="flex-shrink-0 bg-transparent" />
        <div class="grid flex-1 border-l border-hairline bg-transparent" :style="dayGridStyle">
          <div
            v-for="dayIndex in enabledDays"
            :key="dayIndex"
            class="schedule-day-label border-r border-hairline py-2 text-center text-caption text-xs font-semibold"
            :class="
              dayIndex === todayIndex
                ? 'bg-accent-purple-tint text-accent-purple'
                : 'bg-transparent text-ink-muted'
            "
            :data-testid="dayIndex === todayIndex ? 'schedule-today-header' : undefined"
          >
            {{ DAYS[dayIndex] }}
          </div>
        </div>
      </div>

      <div class="flex" :style="{ height: gridHeightStyle }">
        <div :style="{ width: labelWidthStyle }" class="flex-shrink-0 select-none bg-transparent">
          <div
            v-for="hl in hourLabels"
            :key="hl.minute"
            :style="{ height: rowHeightStyle }"
            class="schedule-hour-label flex items-center justify-center border-b border-hairline/30 px-1 text-ink-subtle"
          >
            <span class="leading-3">{{ hl.label }}</span>
          </div>
        </div>

        <div
          class="relative grid flex-1 select-none border-l border-hairline"
          :style="dayGridStyle"
          @click="onGridClick"
        >
          <div
            v-for="dayIndex in enabledDays"
            :key="dayIndex"
            class="relative border-r border-hairline"
            :class="dayIndex === todayIndex ? 'bg-accent-purple-tint/40' : undefined"
            :data-day="dayIndex"
            :data-testid="dayIndex === todayIndex ? 'schedule-today-column' : undefined"
          >
            <div
              v-for="hl in hourLabels"
              :key="hl.minute"
              :style="{ height: rowHeightStyle }"
              class="w-full border-b border-hairline/30"
            />

            <template v-for="vs in slotsForDay(dayIndex)" :key="vs.slot.id">
              <WeeklyScheduleBlock
                :title="vs.block.title"
                :color="vs.block.color"
                :today="dayIndex === todayIndex"
                :selected="props.selectedSlotId === vs.slot.id"
                class="absolute z-10 shadow-sm"
                :style="{
                  top: slotTopPx(vs) + 'px',
                  height: slotHeightPx(vs) + 'px',
                  left: '2%',
                  width: '96%',
                }"
                @click="onSlotClick(vs)"
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
              />
              <button
                v-if="isDeleteVisible(vs.slot.id)"
                type="button"
                data-testid="schedule-slot-delete"
                :aria-label="`Borrar ${vs.block.title} del ${DAYS[vs.slot.day_of_week]}`"
                class="absolute z-20 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-2 text-ink-muted shadow-sm transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
                :style="{ top: slotTopPx(vs) + 'px', right: '2%' }"
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="hoveredSlotId = null"
                @click="emit('remove', vs.slot.id)"
              >
                <X :size="10" />
              </button>
            </template>
          </div>

          <!-- Línea fina de la hora actual: cruza toda la grilla de días -->
          <div
            v-if="nowLineTop !== null"
            class="pointer-events-none absolute inset-x-0 z-20 h-px bg-accent-purple/40"
            :style="{ top: nowLineTop + 'px' }"
            data-testid="schedule-now-line"
          />
        </div>
      </div>
    </div>
  </div>
</template>
