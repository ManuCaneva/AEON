<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { ClipboardPaste, Copy, X } from 'lucide-vue-next'
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
  growthEdgeAt,
  pointerToScheduleMinutes,
  pointerToSchedulePosition,
  WINDOW_GROWTH_INTERVAL_MS,
  type ScheduleDragPoint,
  type WindowGrowthEdge,
} from '@/lib/scheduleDragGeometry'
import { MINUTES_PER_DAY, adaptiveLabelStepMinutes, clampMinutes } from '@/lib/scheduleTime'
import { findFreePlacement } from '@/lib/schedulePlacement'
import { blockColorTint } from '@/lib/scheduleColors'
import type {
  ScheduleBlockWithSlots,
  ScheduleClipboardPayload,
  ScheduleSlot,
} from '@/schemas/weeklySchedule'

const props = defineProps<{
  /** Fecha de referencia para el día de hoy y la hora actual (inyectable para tests). */
  now?: Date
  /** Ocurrencia elegida en el modo edición; `null` cuando no hay ninguna. */
  selectedSlotId?: string | null
  /** Ocurrencia copiada lista para pegar como bloque nuevo. */
  clipboard?: ScheduleClipboardPayload | null
  /** Pegado activo: el fantasma sigue al puntero hasta colocarse o cancelarse. */
  pasting?: boolean
}>()

const store = useWeeklyScheduleStore()
const ui = useUiStore()
const emit = defineEmits<{
  edit: [block: ScheduleBlockWithSlots]
  select: [slotId: string | null]
  remove: [slotId: string]
  copy: [slotId: string]
  'paste-start': []
  'paste-cancel': []
  paste: [day: number, startMinutes: number]
  'name-edit-state': [active: boolean]
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
  stopGrowthTimer()
  stopTransitionListener?.()
  stopTransitionListener = null
})

watch(() => [store.settings, store.visibleWindow], measure, { deep: true })

// Horas extra que se muestran mientras un gesto se acerca a un borde. La
// ventana base sigue siendo la derivada del store: al soltar, esto vuelve a 0.
const gestureWindowGrowth = ref({ above: 0, below: 0 })
// Banda de borde alcanzada por el puntero. Mientras siga dentro, la ventana
// crece una hora por tick; salir de la banda detiene el crecimiento.
const growthEdge = ref<WindowGrowthEdge | null>(null)
let growthTimer: ReturnType<typeof setInterval> | null = null
let lastPointerClient: { clientX: number; clientY: number } | null = null

const effectiveWindow = computed<VisibleWindow>(() => ({
  start_minutes: Math.max(0, store.visibleWindow.start_minutes - gestureWindowGrowth.value.above),
  end_minutes: Math.min(
    MINUTES_PER_DAY,
    store.visibleWindow.end_minutes + gestureWindowGrowth.value.below
  ),
}))

function resetGestureWindow() {
  stopGrowthTimer()
  lastPointerClient = null
  gestureWindowGrowth.value = { above: 0, below: 0 }
  growthEdge.value = null
}

function stopGrowthTimer() {
  if (growthTimer !== null) {
    clearInterval(growthTimer)
    growthTimer = null
  }
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

/** Cada cuánto se rotula: las filas siguen la granularidad, las etiquetas no. */
const labelStepMinutes = computed(() =>
  adaptiveLabelStepMinutes(store.settings.granularity_minutes, rowHeightPx.value)
)

const hourLabels = computed(() => {
  const out: { minute: number; label: string; heightPx: number; labelHeightPx: number }[] = []
  const start = effectiveWindow.value.start_minutes
  const end = effectiveWindow.value.end_minutes
  const step = labelStepMinutes.value
  for (let m = start; m < end; m += step) {
    // La última etiqueta no se extiende más allá de la ventana visible.
    const coverMinutes = Math.min(step, end - m)
    out.push({
      minute: m,
      label: minutesToHHMM(m),
      heightPx: coverMinutes * minuteHeightPx.value,
      // El rótulo se centra en la primera hora de su tramo: en un tramo de 2 h
      // sigue marcando las 10:00 dentro de la franja 10:00–11:00.
      labelHeightPx: Math.min(60, coverMinutes) * minuteHeightPx.value,
    })
  }
  return out
})

/** Filas reales de edición: siempre una por granularidad, independientes del rótulo. */
const gridRows = computed(() => {
  const out: { minute: number }[] = []
  const start = effectiveWindow.value.start_minutes
  const end = effectiveWindow.value.end_minutes
  const step = store.settings.granularity_minutes
  for (let m = start; m < end; m += step) out.push({ minute: m })
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
  const control = next?.closest?.('[data-schedule-slot-control]') as HTMLElement | null
  if (control?.dataset.slotId === slotId) return
  if (hoveredSlotId.value === slotId) hoveredSlotId.value = null
}

function isHoverVisible(slotId: string): boolean {
  return ui.scheduleEditMode && !props.pasting && hoveredSlotId.value === slotId
}

function onSlotClick(vs: VisibleSlot) {
  if (props.pasting) {
    // Click sobre otro bloque mientras se pega: cancela el pegado y lo elige,
    // para poder copiarlo sin salir del modo edición.
    emit('paste-cancel')
    emit('select', vs.slot.id)
    return
  }
  if (!ui.scheduleEditMode) {
    emit('edit', vs.block)
    return
  }
  emit('select', vs.slot.id)
}

/** Click en un hueco de la grilla: limpia la selección o coloca el pegado. */
function onGridClick(event: MouseEvent) {
  if (!ui.scheduleEditMode) return
  const target = event.target as HTMLElement | null
  // Un click sobre un bloque o sus controles nunca coloca la copia: o la
  // cancela (onSlotClick) o pertenece al bloque. Se resuelve antes del pegado.
  if (target?.closest?.('.schedule-block')) return
  if (target?.closest?.('[data-schedule-slot-control]')) return
  if (pasteActive.value) {
    placePaste(event)
    return
  }
  emit('select', null)
}

// ── Crear y renombrar inline (solo en el modo edición del cronograma) ──
const renamingSlotId = ref<string | null>(null)
const creatingBlockId = ref<string | null>(null)
const nameDraft = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const isEditingName = computed(() => renamingSlotId.value !== null)

// El widget escucha este estado para no cerrar el modo con el Esc que
// cancela el nombre.
watch(isEditingName, (active) => emit('name-edit-state', active), { flush: 'sync' })

function setNameInput(el: unknown) {
  nameInputRef.value = el instanceof HTMLInputElement ? el : null
}

function focusNameInput() {
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

function beginNameEdit(slotId: string, title: string, creatingId: string | null) {
  renamingSlotId.value = slotId
  creatingBlockId.value = creatingId
  nameDraft.value = title
  nextTick(focusNameInput)
}

async function onBlockDoubleClick(vs: VisibleSlot) {
  if (!ui.scheduleEditMode || props.pasting) return
  await confirmName()
  beginNameEdit(vs.slot.id, vs.block.title, null)
}

async function onDayDoubleClick(day: number, event: MouseEvent) {
  if (props.pasting) return
  const rowHeight = rowHeightPx.value
  if (rowHeight <= 0) return

  const column = event.currentTarget as HTMLElement | null
  if (!column) return
  const offsetY = event.clientY - column.getBoundingClientRect().top
  const rowIndex = Math.max(0, Math.min(visibleRows.value - 1, Math.floor(offsetY / rowHeight)))
  const granularity = store.settings.granularity_minutes
  const start = windowStart.value + rowIndex * granularity
  const end = Math.min(MINUTES_PER_DAY, start + granularity)
  if (end <= start) return
  if (store.wouldOverlapOnDay(day, start, end)) return

  // Doble click sobre un hueco vacío: entra al modo edición y crea el bloque
  // con el nombre inline, sin pasar por el modal de creación.
  if (!ui.scheduleEditMode) {
    ui.toggleScheduleEditMode()
    if (!ui.scheduleEditMode) return
  }

  await confirmName()
  try {
    const block = await store.createBlock(
      { title: 'Sin título', color: 'lavender', sort_order: 0 },
      [{ day_of_week: day, start_minutes: start, end_minutes: end }]
    )
    const slot = block.slots[0]
    if (slot) beginNameEdit(slot.id, block.title, block.id)
  } catch (e) {
    console.error('No se pudo crear el bloque en la grilla:', e)
  }
}

async function confirmName() {
  const slotId = renamingSlotId.value
  if (slotId === null) return
  const block = store.blockForSlot(slotId)
  const title = nameDraft.value.trim() || 'Sin título'
  renamingSlotId.value = null
  creatingBlockId.value = null
  if (!block || block.title === title) return
  try {
    // Un nombre distinto separa solo esta ocurrencia en un bloque nuevo; las
    // demás conservan el nombre original. Con una única ocurrencia, renombra
    // el bloque entero.
    await store.renameOccurrence(slotId, title)
  } catch (e) {
    console.error('No se pudo renombrar el bloque:', e)
  }
}

async function cancelName() {
  const creatingId = creatingBlockId.value
  renamingSlotId.value = null
  creatingBlockId.value = null
  if (creatingId === null) return
  try {
    await store.deleteBlock(creatingId)
  } catch (e) {
    console.error('No se pudo deshacer el bloque recién creado:', e)
  }
}

interface GestureState {
  kind: GestureKind
  slot: ScheduleSlot
  block: ScheduleBlockWithSlots
  day: number
  start: number
  end: number
  /** Minutos entre el borde agarrado y el puntero al iniciar el gesto. */
  grabOffsetMinutes: number
  pointerX: number | null
  pointerY: number | null
}

interface GestureCandidate {
  vs: VisibleSlot
  kind: GestureKind
  grabOffsetMinutes: number
}

const daysGridRef = ref<HTMLElement | null>(null)
const gestureCandidate = ref<GestureCandidate | null>(null)
const gestureState = ref<GestureState | null>(null)
const scheduleToast = ref<string | null>(null)

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
        grabOffsetMinutes: candidate.grabOffsetMinutes,
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

/**
 * Minuto del puntero sobre la grilla al iniciar el gesto. Se descuenta del
 * borde agarrado al mover: el bloque no salta para enganchar su inicio al
 * mouse, conserva el punto donde el usuario lo tomó.
 */
function pointerMinutesOnGrid(event: PointerEvent): number | null {
  const grid = daysGridRef.value
  if (!grid || minuteHeightPx.value <= 0) return null
  return pointerToScheduleMinutes(event.clientY, grid.getBoundingClientRect(), {
    windowStart: windowStart.value,
    minuteHeightPx: minuteHeightPx.value,
  })
}

function grabOffsetMinutes(vs: VisibleSlot, kind: GestureKind, event: PointerEvent): number {
  const minutes = pointerMinutesOnGrid(event)
  if (minutes === null) return 0
  // El borde agarrado es el inicio salvo en la manija inferior.
  const edge = kind === 'resize-bottom' ? vs.slot.end_minutes : vs.slot.start_minutes
  return minutes - edge
}

function onBlockPointerDown(vs: VisibleSlot, event: PointerEvent) {
  if (!ui.scheduleEditMode || props.pasting) return
  gestureCandidate.value = {
    vs,
    kind: 'move',
    grabOffsetMinutes: grabOffsetMinutes(vs, 'move', event),
  }
  beginGesture(event)
}

function onResizePointerDown(vs: VisibleSlot, edge: 'top' | 'bottom', event: PointerEvent) {
  if (!ui.scheduleEditMode || props.pasting) return
  const kind = edge === 'top' ? 'resize-top' : 'resize-bottom'
  gestureCandidate.value = { vs, kind, grabOffsetMinutes: grabOffsetMinutes(vs, kind, event) }
  beginGesture(event)
}

function applyWindowGrowth(edge: WindowGrowthEdge): boolean {
  const before = effectiveWindow.value
  const grown = growWindowAtEdge(before, edge)
  if (grown.start_minutes === before.start_minutes && grown.end_minutes === before.end_minutes) {
    // Llegó a 00:00 o 24:00: no hay más horas para mostrar.
    stopGrowthTimer()
    return false
  }
  const base = store.visibleWindow
  gestureWindowGrowth.value = {
    above: base.start_minutes - grown.start_minutes,
    below: grown.end_minutes - base.end_minutes,
  }
  return true
}

function startGrowthTimer(edge: WindowGrowthEdge) {
  if (growthTimer !== null) return
  growthTimer = setInterval(() => tickGrowth(edge), WINDOW_GROWTH_INTERVAL_MS)
}

/**
 * Mientras el puntero siga en la banda, la ventana suma una hora por tick. El
 * gesto se reevalúa con la ventana nueva para que el bloque siga bajo el mouse.
 */
function tickGrowth(edge: WindowGrowthEdge) {
  if (!gestureState.value) {
    stopGrowthTimer()
    return
  }
  const grid = daysGridRef.value
  const pointer = lastPointerClient
  if (!grid || !pointer) {
    stopGrowthTimer()
    return
  }
  const rect = grid.getBoundingClientRect()
  if (growthEdgeAt(pointer.clientY, rect) !== edge) {
    growthEdge.value = null
    stopGrowthTimer()
    return
  }
  if (!applyWindowGrowth(edge)) return
  applyGesturePoint(
    pointerToSchedulePosition(pointer.clientX, pointer.clientY, rect, {
      enabledDays: enabledDays.value,
      windowStart: effectiveWindow.value.start_minutes,
      minuteHeightPx: minuteHeightPx.value,
    })
  )
}

function growWindowAtPointer(point: ScheduleDragPoint): ScheduleDragPoint {
  const grid = daysGridRef.value
  if (!grid) return point
  const rect = grid.getBoundingClientRect()
  const edge = growthEdgeAt(point.clientY, rect)
  if (edge === null) {
    growthEdge.value = null
    stopGrowthTimer()
    return point
  }
  lastPointerClient = { clientX: point.clientX, clientY: point.clientY }
  // Ya estábamos en esta banda: el intervalo sigue sumando horas. Cada
  // pointermove llega mapeado con la ventana vigente, así que no hay que
  // volver a crecer ni a reproyectar.
  if (edge === growthEdge.value) return point
  growthEdge.value = edge
  if (!applyWindowGrowth(edge)) return point
  stopGrowthTimer()
  startGrowthTimer(edge)
  // El crecimiento cambia el mapeo píxeles → minutos: el mismo puntero se
  // traduce con la ventana vigente para que el bloque no se despegue.
  return pointerToSchedulePosition(point.clientX, point.clientY, rect, {
    enabledDays: enabledDays.value,
    windowStart: effectiveWindow.value.start_minutes,
    minuteHeightPx: minuteHeightPx.value,
  })
}

function applyGesturePoint(point: ScheduleDragPoint) {
  const state = gestureState.value
  if (!state) return

  if (state.kind === 'move') {
    // Los días deshabilitados no son destino de arrastre.
    if (!enabledDays.value.includes(point.day)) return
    const duration = state.end - state.start
    const start = clampMinutes(
      point.minutes - state.grabOffsetMinutes,
      0,
      MINUTES_PER_DAY - duration
    )
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
  // el fin fijo; estirar desde abajo mueve el fin con el inicio fijo. El borde
  // conserva su distancia al puntero, igual que al mover.
  const edgeMinutes = point.minutes - state.grabOffsetMinutes
  const start =
    state.kind === 'resize-top'
      ? clampMinutes(edgeMinutes, 0, state.end - MIN_SLOT_DURATION_MINUTES)
      : state.start
  const end =
    state.kind === 'resize-bottom'
      ? clampMinutes(edgeMinutes, state.start + MIN_SLOT_DURATION_MINUTES, MINUTES_PER_DAY)
      : state.end
  gestureState.value = { ...state, start, end, pointerX: point.clientX, pointerY: point.clientY }
}

function moveGesture(point: ScheduleDragPoint) {
  if (!gestureState.value) return
  applyGesturePoint(growWindowAtPointer(point))
}

function cancelGesture() {
  gestureState.value = null
  gestureCandidate.value = null
  resetGestureWindow()
}

function overlapBlockTitle(validation: ValidationResult): string {
  return validation.ok ? 'otro bloque' : validation.blockTitle
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
      scheduleToast.value = `Los horarios se superponen con «${overlapBlockTitle(validation)}»`
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
      scheduleToast.value = 'No se pudo actualizar el bloque'
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

// ── Copiar y pegar (solo en el modo edición del cronograma) ──
interface PastePoint {
  day: number
  minutes: number
  clientX: number
  clientY: number
}

const PASTE_GHOST_OFFSET_X = 14
const PASTE_GHOST_OFFSET_Y = 18
const pastePoint = ref<PastePoint | null>(null)
// Última posición del puntero sobre una columna: al iniciar el pegado el
// fantasma aparece ya enganchado, sin esperar a que el mouse se mueva.
const lastPointer = ref<PastePoint | null>(null)

const pasteActive = computed(() => props.pasting === true && props.clipboard != null)

/** Una copia mide una fila de la grilla: así entra en cualquier hueco. */
const pasteUnitMinutes = computed(() => store.settings.granularity_minutes)

/** Horarios del día donde la copia no puede caer. */
function occupiedRangesForDay(day: number) {
  return store.blocksWithSlots
    .flatMap((bw) => bw.slots)
    .filter((slot) => slot.day_of_week === day)
    .map((slot) => ({ start_minutes: slot.start_minutes, end_minutes: slot.end_minutes }))
}

/** Fila de la grilla bajo el puntero, alineada a la granularidad. */
function rowStartAt(minutes: number) {
  const step = pasteUnitMinutes.value
  const start = windowStart.value
  const clamped = clampMinutes(minutes, start, effectiveWindow.value.end_minutes)
  return start + Math.floor((clamped - start) / step) * step
}

watch(
  () => props.pasting,
  (active) => {
    pastePoint.value = active ? lastPointer.value : null
  }
)

/** El fantasma sigue al puntero sobre la columna de un día habilitado. */
function onDayPointerMove(event: PointerEvent) {
  if (minuteHeightPx.value <= 0) return
  const column = event.currentTarget as HTMLElement | null
  if (!column) return
  const day = Number(column.dataset.day)
  if (!enabledDays.value.includes(day)) return
  const minutes = pointerToScheduleMinutes(event.clientY, column.getBoundingClientRect(), {
    windowStart: windowStart.value,
    minuteHeightPx: minuteHeightPx.value,
  })
  const point = {
    day,
    minutes: clampMinutes(minutes),
    clientX: event.clientX,
    clientY: event.clientY,
  }
  lastPointer.value = point
  if (pasteActive.value) pastePoint.value = point
}

/**
 * Dónde caería la copia: el hueco libre más cercano a la fila del puntero.
 * Mientras haya lugar el fantasma ya muestra el destino exacto; si el día no
 * tiene hueco no hay fantasma y el click avisa.
 */
const pasteRange = computed(() => {
  const point = pastePoint.value
  if (!pasteActive.value || !point) return null
  const start = findFreePlacement(
    rowStartAt(point.minutes),
    pasteUnitMinutes.value,
    occupiedRangesForDay(point.day),
    {
      start_minutes: effectiveWindow.value.start_minutes,
      end_minutes: effectiveWindow.value.end_minutes,
    }
  )
  if (start === null) return null
  return { day: point.day, start, end: start + pasteUnitMinutes.value }
})

const pasteGhostStyle = computed(() => {
  const range = pasteRange.value
  if (!range) return null
  const count = Math.max(1, enabledDays.value.length)
  const column = Math.max(0, enabledDays.value.indexOf(range.day))
  return {
    left: `${(column * 100) / count}%`,
    width: `${100 / count}%`,
    top: `${(range.start - windowStart.value) * minuteHeightPx.value}px`,
    height: `${(range.end - range.start) * minuteHeightPx.value}px`,
  }
})

const pasteBadgeStyle = computed(() => {
  const point = pastePoint.value
  if (!pasteActive.value || !point || !pasteRange.value) return null
  return {
    left: `${point.clientX + PASTE_GHOST_OFFSET_X}px`,
    top: `${point.clientY + PASTE_GHOST_OFFSET_Y}px`,
  }
})

const pasteRangeLabel = computed(() => {
  const range = pasteRange.value
  return range ? `${minutesToHHMM(range.start)} → ${minutesToHHMM(range.end)}` : ''
})

const floatingBadgeStyle = computed(() => gestureBadgeStyle.value ?? pasteBadgeStyle.value)
const floatingBadgeLabel = computed(() =>
  gestureState.value ? gestureRangeLabel.value : pasteRangeLabel.value
)

/**
 * Un click sobre una columna coloca la copia en el hueco libre más cercano a
 * la fila clickeada: un solape puntual no rechaza el pegado, lo reubica.
 */
function placePaste(event: MouseEvent) {
  if (!props.clipboard || minuteHeightPx.value <= 0) return
  const target = event.target as HTMLElement | null
  const column = target?.closest?.('[data-day]') as HTMLElement | null
  if (!column) return
  const day = Number(column.dataset.day)
  if (!enabledDays.value.includes(day)) return
  const minutes = clampMinutes(
    pointerToScheduleMinutes(event.clientY, column.getBoundingClientRect(), {
      windowStart: windowStart.value,
      minuteHeightPx: minuteHeightPx.value,
    })
  )
  const start = findFreePlacement(
    rowStartAt(minutes),
    pasteUnitMinutes.value,
    occupiedRangesForDay(day),
    {
      start_minutes: effectiveWindow.value.start_minutes,
      end_minutes: effectiveWindow.value.end_minutes,
    }
  )
  if (start === null) {
    scheduleToast.value = 'No hay espacio libre en este día'
    return
  }
  emit('paste', day, start)
}

// Si el modo se apaga mientras se edita el nombre, se confirma lo escrito
// para no dejar el editor colgado; un arrastre en curso se cancela.
watch(
  () => ui.scheduleEditMode,
  (active) => {
    if (active) return
    hoveredSlotId.value = null
    cancelGesture()
    lastPointer.value = null
    void confirmName()
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
            :style="{ height: hl.heightPx + 'px' }"
            class="schedule-hour-label relative flex items-center justify-center border-b border-hairline/30 px-1 text-ink-subtle transition-[height] duration-200 ease-out"
          >
            <span
              class="absolute inset-x-0 top-0 flex items-center justify-center"
              :style="{ height: hl.labelHeightPx + 'px' }"
            >
              <span class="leading-3">{{ hl.label }}</span>
            </span>
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
            :data-day="dayIndex"
            :data-testid="dayIndex === todayIndex ? 'schedule-today-column' : undefined"
            @dblclick="onDayDoubleClick(dayIndex, $event)"
            @pointermove="onDayPointerMove($event)"
          >
            <!-- Capa desaturada: solo los días y sus bloques. Los controles
                 del modo (×, copiar/pegar, manijas, nombre) viven fuera. -->
            <div
              class="relative"
              :class="[
                dayIndex === todayIndex ? 'bg-accent-purple-tint/40' : undefined,
                ui.scheduleEditMode && 'grayscale',
              ]"
              data-testid="schedule-day-content"
            >
              <div
                v-for="row in gridRows"
                :key="row.minute"
                :style="{ height: rowHeightStyle }"
                class="schedule-grid-row w-full border-b border-hairline/30 transition-[height] duration-200 ease-out"
              />

              <WeeklyScheduleBlock
                v-for="vs in slotsForDay(dayIndex)"
                :key="vs.slot.id"
                :title="vs.block.title"
                :color="vs.block.color"
                :today="dayIndex === todayIndex"
                :start-time="minutesToHHMM(vs.slot.start_minutes)"
                :end-time="minutesToHHMM(vs.slot.end_minutes)"
                :show-times="store.settings.show_block_times"
                :selected="props.selectedSlotId === vs.slot.id"
                :selectable="ui.scheduleEditMode"
                :data-slot-id="vs.slot.id"
                class="absolute z-10 shadow-sm"
                :class="gestureState?.slot.id === vs.slot.id ? 'opacity-30' : undefined"
                :style="{
                  top: slotTopPx(vs) + 'px',
                  height: slotHeightPx(vs) + 'px',
                  left: '2%',
                  width: '96%',
                }"
                @click="onSlotClick(vs)"
                @dblclick.stop="onBlockDoubleClick(vs)"
                @pointerdown="onBlockPointerDown(vs, $event)"
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
              />
            </div>

            <template v-for="vs in slotsForDay(dayIndex)" :key="vs.slot.id">
              <!-- Manijas de resize: solo los bordes superior e inferior, y
                   solo mientras el puntero está sobre la ocurrencia. -->
              <template v-if="isHoverVisible(vs.slot.id)">
                <div
                  class="absolute z-20 flex cursor-ns-resize items-center justify-center"
                  data-schedule-slot-control
                  :data-slot-id="vs.slot.id"
                  :style="{
                    top: slotTopPx(vs) - 4 + 'px',
                    height: '8px',
                    left: '2%',
                    width: '96%',
                  }"
                  data-testid="schedule-resize-handle-top"
                  @pointerdown.stop="onResizePointerDown(vs, 'top', $event)"
                  @dblclick.stop
                  @mouseenter="onSlotEnter(vs.slot.id)"
                  @mouseleave="onSlotLeave(vs.slot.id, $event)"
                >
                  <span class="h-0.5 w-8 rounded-full bg-accent-purple/60" />
                </div>
                <div
                  class="absolute z-20 flex cursor-ns-resize items-center justify-center"
                  data-schedule-slot-control
                  :data-slot-id="vs.slot.id"
                  :style="{
                    top: slotTopPx(vs) + slotHeightPx(vs) - 4 + 'px',
                    height: '8px',
                    left: '2%',
                    width: '96%',
                  }"
                  data-testid="schedule-resize-handle-bottom"
                  @pointerdown.stop="onResizePointerDown(vs, 'bottom', $event)"
                  @dblclick.stop
                  @mouseenter="onSlotEnter(vs.slot.id)"
                  @mouseleave="onSlotLeave(vs.slot.id, $event)"
                >
                  <span class="h-0.5 w-8 rounded-full bg-accent-purple/60" />
                </div>
              </template>

              <button
                v-if="isHoverVisible(vs.slot.id)"
                type="button"
                data-testid="schedule-slot-delete"
                data-schedule-slot-control
                :data-slot-id="vs.slot.id"
                :aria-label="`Borrar ${vs.block.title} del ${DAYS[vs.slot.day_of_week]}`"
                class="absolute z-20 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-2 text-ink-muted shadow-sm transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
                :style="{ top: slotTopPx(vs) + 'px', right: '2%' }"
                @dblclick.stop
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
                @click.stop="emit('remove', vs.slot.id)"
              >
                <X :size="14" />
              </button>

              <button
                v-if="isHoverVisible(vs.slot.id)"
                type="button"
                data-testid="schedule-slot-copy"
                data-schedule-slot-control
                :data-slot-id="vs.slot.id"
                :aria-label="`Copiar ${vs.block.title} del ${DAYS[vs.slot.day_of_week]}`"
                class="absolute z-20 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-2 text-ink-muted shadow-sm transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
                :style="{ top: slotTopPx(vs) + 'px', right: 'calc(2% + 18px)' }"
                @dblclick.stop
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
                @click.stop="emit('copy', vs.slot.id)"
              >
                <Copy :size="14" />
              </button>

              <button
                v-if="isHoverVisible(vs.slot.id)"
                type="button"
                data-testid="schedule-slot-paste"
                data-schedule-slot-control
                :data-slot-id="vs.slot.id"
                aria-label="Pegar bloque"
                :disabled="!clipboard"
                class="absolute z-20 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-2 text-ink-muted shadow-sm transition-colors duration-150 hover:bg-surface-3 hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface-2 disabled:hover:text-ink-muted"
                :style="{ top: slotTopPx(vs) + 'px', right: 'calc(2% + 36px)' }"
                @dblclick.stop
                @mouseenter="onSlotEnter(vs.slot.id)"
                @mouseleave="onSlotLeave(vs.slot.id, $event)"
                @click.stop="emit('paste-start')"
              >
                <ClipboardPaste :size="14" />
              </button>

              <input
                v-if="renamingSlotId === vs.slot.id"
                :ref="setNameInput"
                v-model="nameDraft"
                type="text"
                maxlength="80"
                aria-label="Nombre del bloque"
                data-testid="schedule-name-input"
                class="schedule-name-input absolute z-30 min-w-0 rounded-sm border-2 bg-surface-1 px-1 text-center text-xs font-medium text-ink shadow-sm outline-none focus:ring-2 focus:ring-accent-purple/40"
                :style="{
                  top: slotTopPx(vs) + 'px',
                  height: slotHeightPx(vs) + 'px',
                  left: '2%',
                  width: '96%',
                  borderColor: blockColorTint(vs.block.color, 1),
                }"
                @click.stop
                @dblclick.stop
                @keydown.enter.prevent.stop="confirmName"
                @keydown.esc.prevent.stop="cancelName"
                @blur="confirmName"
              />
            </template>
          </div>

          <!-- El bloque en gesto sigue al puntero por posición, no por acumulación de píxeles -->
          <div
            v-if="gestureState"
            class="pointer-events-none absolute z-30 grayscale"
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

          <!-- Fantasma del pegado: bloque translúcido en el hueco libre resuelto -->
          <div
            v-if="pasteGhostStyle && clipboard"
            data-testid="schedule-paste-ghost"
            aria-hidden="true"
            class="pointer-events-none absolute z-30 opacity-50 grayscale"
            :style="pasteGhostStyle"
          >
            <WeeklyScheduleBlock
              :title="clipboard.title"
              :color="clipboard.color"
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
            :class="ui.scheduleEditMode && 'grayscale'"
            :style="{ top: nowLineTop + 'px' }"
            data-testid="schedule-now-line"
          />
        </div>
      </div>
    </div>

    <!-- Cartelito flotante con el rango exacto durante el gesto o el pegado -->
    <Teleport to="body">
      <div
        v-if="floatingBadgeStyle"
        data-testid="schedule-drag-badge"
        role="status"
        class="glass-overlay pointer-events-none fixed z-50 rounded-md px-2 py-1 text-caption text-ink shadow-lg"
        :style="floatingBadgeStyle"
      >
        {{ floatingBadgeLabel }}
      </div>
    </Teleport>

    <Toast
      :open="scheduleToast !== null"
      :message="scheduleToast ?? ''"
      @update:open="scheduleToast = null"
    />
  </div>
</template>
