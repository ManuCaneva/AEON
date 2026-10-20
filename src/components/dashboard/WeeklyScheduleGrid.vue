<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { minutesToHHMM } from '@/stores/weeklySchedule'
import WeeklyScheduleBlock from './WeeklyScheduleBlock.vue'
import Toast from '@/components/ui/Toast.vue'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import { useScheduleDrag } from '@/composables/useScheduleDrag'
import { useUiStore } from '@/stores/ui'
import { dayIndexOfWeek } from '@/lib/calendarDates'
import { minutesSinceMidnight, nowLineTopPx } from '@/lib/nowLine'
import type { ScheduleDragPoint } from '@/lib/scheduleDragGeometry'
import type { ScheduleBlockWithSlots, ScheduleSlot } from '@/schemas/weeklySchedule'

const props = defineProps<{
  /** Fecha de referencia para el día de hoy y la hora actual (inyectable para tests). */
  now?: Date
}>()

const store = useWeeklyScheduleStore()
const ui = useUiStore()
const emit = defineEmits<{ edit: [block: ScheduleBlockWithSlots] }>()

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

interface DragState {
  slot: ScheduleSlot
  block: ScheduleBlockWithSlots
  day: number
  start: number
  duration: number
  pointerX: number | null
  pointerY: number | null
}

const daysGridRef = ref<HTMLElement | null>(null)
const dragCandidate = ref<VisibleSlot | null>(null)
const dragState = ref<DragState | null>(null)
const dragToast = ref<string | null>(null)

const dragEnabled = computed(() => ui.scheduleEditMode)

const { begin: beginDrag } = useScheduleDrag(
  daysGridRef,
  dragEnabled,
  () => ({
    enabledDays: enabledDays.value,
    windowStart: windowStart.value,
    minuteHeightPx: minuteHeightPx.value,
  }),
  {
    onStart() {
      const candidate = dragCandidate.value
      if (!candidate) return
      dragState.value = {
        slot: candidate.slot,
        block: candidate.block,
        day: candidate.slot.day_of_week,
        start: candidate.slot.start_minutes,
        duration: candidate.slot.end_minutes - candidate.slot.start_minutes,
        pointerX: null,
        pointerY: null,
      }
    },
    onMove(point) {
      moveDrag(point)
    },
    onEnd() {
      void finishDrag()
    },
    onCancel() {
      cancelDrag()
    },
  }
)

function onBlockPointerDown(vs: VisibleSlot, event: PointerEvent) {
  if (!ui.scheduleEditMode) return
  dragCandidate.value = vs
  beginDrag(event)
}

function moveDrag(point: ScheduleDragPoint) {
  const state = dragState.value
  if (!state) return
  // Los días deshabilitados no son destino de arrastre.
  if (!enabledDays.value.includes(point.day)) return
  const start = Math.max(0, Math.min(point.minutes, 1440 - state.duration))
  dragState.value = {
    ...state,
    day: point.day,
    start,
    pointerX: point.clientX,
    pointerY: point.clientY,
  }
}

function cancelDrag() {
  dragState.value = null
  dragCandidate.value = null
}

async function finishDrag() {
  const state = dragState.value
  dragState.value = null
  dragCandidate.value = null
  if (!state) return
  if (!enabledDays.value.includes(state.day)) return
  if (state.day === state.slot.day_of_week && state.start === state.slot.start_minutes) return

  const end = state.start + state.duration
  const validation = store.validateSlot(
    { day_of_week: state.day, start_minutes: state.start, end_minutes: end },
    state.slot.id
  )
  if (!validation.ok) {
    const blockTitle = validation.reason === 'overlapBlock' ? validation.blockTitle : 'otro bloque'
    dragToast.value = `Los horarios se superponen con «${blockTitle}»`
    return
  }

  try {
    await store.updateSlot(state.slot.id, {
      day_of_week: state.day,
      start_minutes: state.start,
      end_minutes: end,
    })
  } catch {
    dragToast.value = 'No se pudo mover el bloque'
  }
}

const dragGhostStyle = computed(() => {
  const state = dragState.value
  if (!state) return null
  const count = Math.max(1, enabledDays.value.length)
  const column = Math.max(0, enabledDays.value.indexOf(state.day))
  return {
    left: `${(column * 100) / count}%`,
    width: `${100 / count}%`,
    top: `${(state.start - windowStart.value) * minuteHeightPx.value}px`,
    height: `${state.duration * minuteHeightPx.value}px`,
  }
})

const dragBadgeStyle = computed(() => {
  const state = dragState.value
  if (!state || state.pointerX === null || state.pointerY === null) return null
  return {
    left: `${state.pointerX + 12}px`,
    top: `${state.pointerY + 16}px`,
  }
})

const dragRangeLabel = computed(() => {
  const state = dragState.value
  if (!state) return ''
  return `${minutesToHHMM(state.start)} → ${minutesToHHMM(state.start + state.duration)}`
})

watch(
  () => ui.scheduleEditMode,
  (on) => {
    if (!on) cancelDrag()
  }
)
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
          ref="daysGridRef"
          class="relative grid flex-1 select-none border-l border-hairline"
          :style="dayGridStyle"
        >
          <div
            v-for="dayIndex in enabledDays"
            :key="dayIndex"
            class="relative border-r border-hairline"
            :class="dayIndex === todayIndex ? 'bg-accent-purple-tint/40' : undefined"
            :data-testid="dayIndex === todayIndex ? 'schedule-today-column' : undefined"
          >
            <div
              v-for="hl in hourLabels"
              :key="hl.minute"
              :style="{ height: rowHeightStyle }"
              class="w-full border-b border-hairline/30"
            />

            <WeeklyScheduleBlock
              v-for="vs in slotsForDay(dayIndex)"
              :key="vs.slot.id"
              :title="vs.block.title"
              :color="vs.block.color"
              :today="dayIndex === todayIndex"
              class="absolute z-10 shadow-sm"
              :class="dragState?.slot.id === vs.slot.id ? 'opacity-30' : undefined"
              :style="{
                top: slotTopPx(vs) + 'px',
                height: slotHeightPx(vs) + 'px',
                left: '2%',
                width: '96%',
              }"
              @click="emit('edit', vs.block)"
              @pointerdown="onBlockPointerDown(vs, $event)"
            />
          </div>

          <!-- El bloque arrastrado sigue al puntero por posición, no por acumulación de píxeles -->
          <div
            v-if="dragState"
            class="pointer-events-none absolute z-30"
            :style="dragGhostStyle"
            data-testid="schedule-drag-ghost"
          >
            <WeeklyScheduleBlock
              :title="dragState.block.title"
              :color="dragState.block.color"
              :style="{
                top: '0px',
                left: '2%',
                width: '96%',
                height: '100%',
                transition: 'none',
              }"
            />
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

    <!-- Cartelito flotante con el rango exacto mientras se arrastra -->
    <Teleport to="body">
      <div
        v-if="dragState && dragBadgeStyle"
        data-testid="schedule-drag-badge"
        role="status"
        class="glass-overlay pointer-events-none fixed z-50 rounded-md px-2 py-1 text-caption text-ink shadow-lg"
        :style="dragBadgeStyle"
      >
        {{ dragRangeLabel }}
      </div>
    </Teleport>

    <Toast :open="dragToast !== null" :message="dragToast ?? ''" @update:open="dragToast = null" />
  </div>
</template>
