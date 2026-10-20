<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { minutesToHHMM } from '@/stores/weeklySchedule'
import type { ValidationResult, VisibleWindow } from '@/stores/weeklySchedule'
import { useUiStore } from '@/stores/ui'
import WeeklyScheduleBlock from './WeeklyScheduleBlock.vue'
import Toast from '@/components/ui/Toast.vue'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import { useScheduleDrag } from '@/composables/useScheduleDrag'
import { dayIndexOfWeek } from '@/lib/calendarDates'
import { minutesSinceMidnight, nowLineTopPx } from '@/lib/nowLine'
import {
  growWindowAtEdge,
  pointerToSchedulePosition,
  type ScheduleDragPoint,
} from '@/lib/scheduleDragGeometry'
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

// Horas extra que se muestran mientras un gesto se acerca a un borde. La
// ventana base sigue siendo la derivada del store: al soltar, esto vuelve a 0.
const gestureWindowGrowth = ref({ above: 0, below: 0 })

const effectiveWindow = computed<VisibleWindow>(() => ({
  start_minutes: Math.max(0, store.visibleWindow.start_minutes - gestureWindowGrowth.value.above),
  end_minutes: Math.min(1440, store.visibleWindow.end_minutes + gestureWindowGrowth.value.below),
}))

function resetGestureWindow() {
  gestureWindowGrowth.value = { above: 0, below: 0 }
}

const visibleRows = computed(() => {
  const diff = effectiveWindow.value.end_minutes - effectiveWindow.value.start_minutes
  return Math.max(1, Math.floor(diff / store.settings.granularity_minutes))
})

const rowHeightPx = computed(() => {
  const avail = Math.max(0, containerHeight.value - headerHeight.value)
  return avail / visibleRows.value
})

const minuteHeightPx = computed(() => rowHeightPx.value / store.settings.granularity_minutes)
const windowStart = computed(() => effectiveWindow.value.start_minutes)

// Línea de la hora actual: depende de nowRef (tick cada 60 s) y de la Ventana
// visible, así recalcula sola cuando cambia la ventana o pasa el minuto.
const nowLineTop = computed(() =>
  nowLineTopPx(minutesSinceMidnight(nowRef.value), effectiveWindow.value, minuteHeightPx.value)
)

const hourLabels = computed(() => {
  const out: { minute: number; label: string }[] = []
  const start = effectiveWindow.value.start_minutes
  const end = effectiveWindow.value.end_minutes
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
  const start = effectiveWindow.value.start_minutes
  const end = effectiveWindow.value.end_minutes
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

/** Duración mínima de una ocurrencia: no se puede achicar más allá. */
const MIN_SLOT_DURATION_MINUTES = 5

type GestureKind = 'move' | 'resize-top' | 'resize-bottom'

// En el modo edición cada ocurrencia descubre su × al pasar el mouse. El
// puntero pasa del bloque a la × (que vive fuera del bloque para no anidar
// botones): si el mouse sale del bloque hacia su propia ×, se mantiene visible.
const hoveredSlotId = ref<string | null>(null)

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

interface GestureState {
  kind: GestureKind
  slot: ScheduleSlot
  block: ScheduleBlockWithSlots
  day: number
  start: number
  end: number
  pointerX: number | null
  pointerY: number | null
}

interface GestureCandidate {
  vs: VisibleSlot
  kind: GestureKind
}

const daysGridRef = ref<HTMLElement | null>(null)
const gestureCandidate = ref<GestureCandidate | null>(null)
const gestureState = ref<GestureState | null>(null)
const gestureToast = ref<string | null>(null)

const gestureEnabled = computed(() => ui.scheduleEditMode)

const { begin: beginGesture } = useScheduleDrag(
  daysGridRef,
  gestureEnabled,
  () => ({
    enabledDays: enabledDays.value,
    windowStart: windowStart.value,
    minuteHeightPx: minuteHeightPx.value,
  }),
  {
    onStart() {
      const candidate = gestureCandidate.value
      if (!candidate) return
      resetGestureWindow()
      gestureState.value = {
        kind: candidate.kind,
        slot: candidate.vs.slot,
        block: candidate.vs.block,
        day: candidate.vs.slot.day_of_week,
        start: candidate.vs.slot.start_minutes,
        end: candidate.vs.slot.end_minutes,
        pointerX: null,
        pointerY: null,
      }
    },
    onMove(point) {
      moveGesture(point)
    },
    onEnd() {
      void finishGesture()
    },
    onCancel() {
      cancelGesture()
    },
  }
)

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function onBlockPointerDown(vs: VisibleSlot, event: PointerEvent) {
  if (!ui.scheduleEditMode) return
  gestureCandidate.value = { vs, kind: 'move' }
  beginGesture(event)
}

function onResizePointerDown(vs: VisibleSlot, edge: 'top' | 'bottom', event: PointerEvent) {
  if (!ui.scheduleEditMode) return
  gestureCandidate.value = { vs, kind: edge === 'top' ? 'resize-top' : 'resize-bottom' }
  beginGesture(event)
}

function growWindowAtPointer(point: ScheduleDragPoint): ScheduleDragPoint {
  const grid = daysGridRef.value
  if (!grid) return point
  const rect = grid.getBoundingClientRect()
  const grown = growWindowAtEdge(effectiveWindow.value, point.clientY, rect)
  if (
    grown.start_minutes === effectiveWindow.value.start_minutes &&
    grown.end_minutes === effectiveWindow.value.end_minutes
  ) {
    return point
  }
  const base = store.visibleWindow
  gestureWindowGrowth.value = {
    above: base.start_minutes - grown.start_minutes,
    below: grown.end_minutes - base.end_minutes,
  }
  // El crecimiento cambia el mapeo píxeles → minutos: el mismo puntero se
  // traduce con la ventana vigente para que el bloque no se despegue.
  return pointerToSchedulePosition(point.clientX, point.clientY, rect, {
    enabledDays: enabledDays.value,
    windowStart: effectiveWindow.value.start_minutes,
    minuteHeightPx: minuteHeightPx.value,
  })
}

function moveGesture(point: ScheduleDragPoint) {
  const state = gestureState.value
  if (!state) return

  point = growWindowAtPointer(point)

  if (state.kind === 'move') {
    // Los días deshabilitados no son destino de arrastre.
    if (!enabledDays.value.includes(point.day)) return
    const duration = state.end - state.start
    const start = clamp(point.minutes, 0, 1440 - duration)
    gestureState.value = {
      ...state,
      day: point.day,
      start,
      end: start + duration,
      pointerX: point.clientX,
      pointerY: point.clientY,
    }
    return
  }

  // La arista opuesta queda anclada: estirar desde arriba mueve el inicio con
  // el fin fijo; estirar desde abajo mueve el fin con el inicio fijo.
  const start =
    state.kind === 'resize-top'
      ? clamp(point.minutes, 0, state.end - MIN_SLOT_DURATION_MINUTES)
      : state.start
  const end =
    state.kind === 'resize-bottom'
      ? clamp(point.minutes, state.start + MIN_SLOT_DURATION_MINUTES, 1440)
      : state.end
  gestureState.value = { ...state, start, end, pointerX: point.clientX, pointerY: point.clientY }
}

function cancelGesture() {
  gestureState.value = null
  gestureCandidate.value = null
  resetGestureWindow()
}

function overlapBlockTitle(validation: ValidationResult): string {
  return validation.ok || validation.reason !== 'overlapBlock'
    ? 'otro bloque'
    : validation.blockTitle
}

async function finishGesture() {
  const state = gestureState.value
  gestureState.value = null
  gestureCandidate.value = null
  try {
    if (!state) return
    if (!enabledDays.value.includes(state.day)) return
    if (
      state.day === state.slot.day_of_week &&
      state.start === state.slot.start_minutes &&
      state.end === state.slot.end_minutes
    ) {
      return
    }

    const validation = store.validateSlot(
      { day_of_week: state.day, start_minutes: state.start, end_minutes: state.end },
      state.slot.id
    )
    if (!validation.ok) {
      gestureToast.value = `Los horarios se superponen con «${overlapBlockTitle(validation)}»`
      return
    }

    try {
      await store.updateSlot(
        state.slot.id,
        state.kind === 'move'
          ? { day_of_week: state.day, start_minutes: state.start, end_minutes: state.end }
          : { start_minutes: state.start, end_minutes: state.end }
      )
    } catch {
      gestureToast.value = 'No se pudo actualizar el bloque'
    }
  } finally {
    // Al soltar, la ventana visible vuelve a derivarse del rango de los
    // horarios. Se hace después de persistir para que el horario nuevo ya
    // esté en el rango y la grilla no se achique en el medio.
    resetGestureWindow()
  }
}

const gestureGhostStyle = computed(() => {
  const state = gestureState.value
  if (!state) return null
  const count = Math.max(1, enabledDays.value.length)
  const column = Math.max(0, enabledDays.value.indexOf(state.day))
  return {
    left: `${(column * 100) / count}%`,
    width: `${100 / count}%`,
    top: `${(state.start - windowStart.value) * minuteHeightPx.value}px`,
    height: `${(state.end - state.start) * minuteHeightPx.value}px`,
  }
})

const gestureBadgeStyle = computed(() => {
  const state = gestureState.value
  if (!state || state.pointerX === null || state.pointerY === null) return null
  return {
    left: `${state.pointerX + 12}px`,
    top: `${state.pointerY + 16}px`,
  }
})

const gestureRangeLabel = computed(() => {
  const state = gestureState.value
  if (!state) return ''
  return `${minutesToHHMM(state.start)} → ${minutesToHHMM(state.end)}`
})

watch(
  () => ui.scheduleEditMode,
  (active) => {
    if (active) return
    hoveredSlotId.value = null
    cancelGesture()
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
            class="schedule-hour-label flex items-center justify-center border-b border-hairline/30 px-1 text-ink-subtle transition-[height] duration-200 ease-out"
          >
            <span class="leading-3">{{ hl.label }}</span>
          </div>
        </div>

        <div
          ref="daysGridRef"
          data-testid="schedule-days-grid"
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
              class="w-full border-b border-hairline/30 transition-[height] duration-200 ease-out"
            />

            <template v-for="vs in slotsForDay(dayIndex)" :key="vs.slot.id">
              <WeeklyScheduleBlock
                :title="vs.block.title"
                :color="vs.block.color"
                :today="dayIndex === todayIndex"
                :selected="props.selectedSlotId === vs.slot.id"
                class="absolute z-10 shadow-sm"
                :class="gestureState?.slot.id === vs.slot.id ? 'opacity-30' : undefined"
                :style="{
                  top: slotTopPx(vs) + 'px',
                  height: slotHeightPx(vs) + 'px',
                  left: '2%',
                  width: '96%',
                }"
                @click="onSlotClick(vs)"
                @pointerdown="onBlockPointerDown(vs, $event)"
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
              />

              <!-- Manijas de resize: solo los bordes superior e inferior -->
              <template v-if="ui.scheduleEditMode">
                <div
                  class="group absolute z-20 flex cursor-ns-resize items-center justify-center"
                  :style="{
                    top: slotTopPx(vs) - 4 + 'px',
                    height: '8px',
                    left: '2%',
                    width: '96%',
                  }"
                  data-testid="schedule-resize-handle-top"
                  :data-slot-id="vs.slot.id"
                  @pointerdown.stop="onResizePointerDown(vs, 'top', $event)"
                >
                  <span
                    class="h-0.5 w-8 rounded-full bg-accent-purple/60 opacity-40 transition-opacity group-hover:opacity-100"
                  />
                </div>
                <div
                  class="group absolute z-20 flex cursor-ns-resize items-center justify-center"
                  :style="{
                    top: slotTopPx(vs) + slotHeightPx(vs) - 4 + 'px',
                    height: '8px',
                    left: '2%',
                    width: '96%',
                  }"
                  data-testid="schedule-resize-handle-bottom"
                  :data-slot-id="vs.slot.id"
                  @pointerdown.stop="onResizePointerDown(vs, 'bottom', $event)"
                >
                  <span
                    class="h-0.5 w-8 rounded-full bg-accent-purple/60 opacity-40 transition-opacity group-hover:opacity-100"
                  />
                </div>
              </template>

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

          <!-- El bloque en gesto sigue al puntero por posición, no por acumulación de píxeles -->
          <div
            v-if="gestureState"
            class="pointer-events-none absolute z-30"
            :style="gestureGhostStyle"
            data-testid="schedule-drag-ghost"
          >
            <WeeklyScheduleBlock
              :title="gestureState.block.title"
              :color="gestureState.block.color"
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

    <!-- Cartelito flotante con el rango exacto durante el gesto -->
    <Teleport to="body">
      <div
        v-if="gestureState && gestureBadgeStyle"
        data-testid="schedule-drag-badge"
        role="status"
        class="glass-overlay pointer-events-none fixed z-50 rounded-md px-2 py-1 text-caption text-ink shadow-lg"
        :style="gestureBadgeStyle"
      >
        {{ gestureRangeLabel }}
      </div>
    </Teleport>

    <Toast
      :open="gestureToast !== null"
      :message="gestureToast ?? ''"
      @update:open="gestureToast = null"
    />
  </div>
</template>
