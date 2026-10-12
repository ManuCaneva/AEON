<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    hour: number
    minute: number
    active?: 'hour' | 'minute'
  }>(),
  { active: 'hour' }
)

const emit = defineEmits<{
  (e: 'select-hour', value: number): void
  (e: 'select-minute', value: number): void
}>()

const ITEM_H = 32
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
// Triplicamos para loop infinito: [copia0 | copia1 (visible) | copia2]
const HOUR_COPIES = [0, 1, 2]
const MINUTE_COPIES = [0, 1, 2]

const pad = (n: number) => String(n).padStart(2, '0')

const hourCol = ref<HTMLElement | null>(null)
const minuteCol = ref<HTMLElement | null>(null)
const wheelTicking = ref(false)
const tickingHour = ref(false)
const tickingMinute = ref(false)
// Vuelo programado en curso (mount, click, teclado): los scrolls intermedios
// se ignoran para no emitir horas de paso ni recentrar a mitad de la animación.
const settlingHour = ref(false)
const settlingMinute = ref(false)
let timerHour: ReturnType<typeof setTimeout> | undefined
let timerMinute: ReturnType<typeof setTimeout> | undefined
const FLIGHT_TIMEOUT = 500

function colTop(col: HTMLElement | null, index: number, count: number): number {
  const h = col?.clientHeight || ITEM_H * 5
  return (count + index) * ITEM_H - h / 2 + ITEM_H / 2
}

function placeInstantly(col: HTMLElement | null, index: number, count: number) {
  // Posicionado inicial al abrir: nace fijo en el horario, sin animar.
  // Ojo: con CSS scroll-smooth, asignar scrollTop también anima en Chromium,
  // por eso se pisa el behavior a 'auto' con reflow forzado y se restaura después.
  if (!col) return
  if (col === hourCol.value) settlingHour.value = true
  else settlingMinute.value = true
  col.style.scrollBehavior = 'auto'
  col.scrollTop = colTop(col, index, count)
  void col.offsetHeight
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      col.style.scrollBehavior = ''
      if (col === hourCol.value) settlingHour.value = false
      else settlingMinute.value = false
    })
  )
}

function endFlight(kind: 'hour' | 'minute') {
  const col = kind === 'hour' ? hourCol.value : minuteCol.value
  const count = kind === 'hour' ? 24 : 60
  const current = kind === 'hour' ? props.hour : props.minute
  if (kind === 'hour') {
    settlingHour.value = false
    clearTimeout(timerHour)
    timerHour = undefined
  } else {
    settlingMinute.value = false
    clearTimeout(timerMinute)
    timerMinute = undefined
  }
  // Sync final único: recentra y solo emite si el destino real difiere.
  if (!col || col.scrollHeight === 0) return
  recenterIfNeeded(col, count)
  const idx = centeredIndex(col, count)
  if (idx === current) return
  if (kind === 'hour') emit('select-hour', idx)
  else emit('select-minute', idx)
}

function scrollSmoothly(col: HTMLElement | null, index: number, count: number) {
  // Solo para movimiento iniciado por nosotros (click / teclado / cambio externo).
  // Lo que hace el usuario a mano (wheel / touch) sigue vivo por su propio handler.
  if (!col) return
  const kind: 'hour' | 'minute' = col === hourCol.value ? 'hour' : 'minute'
  if (kind === 'hour') {
    settlingHour.value = true
    clearTimeout(timerHour)
    timerHour = setTimeout(() => endFlight('hour'), FLIGHT_TIMEOUT)
  } else {
    settlingMinute.value = true
    clearTimeout(timerMinute)
    timerMinute = setTimeout(() => endFlight('minute'), FLIGHT_TIMEOUT)
  }
  col.scrollTo({ top: colTop(col, index, count), behavior: 'smooth' })
}

function cancelSettling(kind: 'hour' | 'minute') {
  // El usuario toma el control (wheel / touch): se cancela el vuelo programado
  // para que sus scrolls vuelvan a emitir en vivo de inmediato.
  if (kind === 'hour') {
    settlingHour.value = false
    clearTimeout(timerHour)
    timerHour = undefined
  } else {
    settlingMinute.value = false
    clearTimeout(timerMinute)
    timerMinute = undefined
  }
}

function recenterIfNeeded(col: HTMLElement | null, count: number) {
  if (!col || col.scrollHeight === 0) return
  const block = count * ITEM_H
  // Salto a la copia equivalente: contenido idéntico, debe ser invisible,
  // así que también se blinda del CSS scroll-smooth.
  const jump = (top: number) => {
    col.style.scrollBehavior = 'auto'
    col.scrollTop = top
    void col.offsetHeight
    requestAnimationFrame(() => {
      col.style.scrollBehavior = ''
    })
  }
  if (col.scrollTop < block * 0.5) jump(col.scrollTop + block)
  else if (col.scrollTop > block * 2) jump(col.scrollTop - block)
}

function centeredIndex(col: HTMLElement | null, count: number): number {
  if (!col) return 0
  const center = col.scrollTop + (col.clientHeight || ITEM_H * 5) / 2
  const raw = Math.floor(center / ITEM_H) - count
  return ((raw % count) + count) % count
}

function onHourScroll() {
  if (settlingHour.value || tickingHour.value) return
  tickingHour.value = true
  requestAnimationFrame(() => {
    tickingHour.value = false
    if (settlingHour.value) return
    const col = hourCol.value
    if (!col || col.scrollHeight === 0) return
    recenterIfNeeded(col, 24)
    const idx = centeredIndex(col, 24)
    if (idx !== props.hour) emit('select-hour', idx)
  })
}

function onMinuteScroll() {
  if (settlingMinute.value || tickingMinute.value) return
  tickingMinute.value = true
  requestAnimationFrame(() => {
    tickingMinute.value = false
    if (settlingMinute.value) return
    const col = minuteCol.value
    if (!col || col.scrollHeight === 0) return
    recenterIfNeeded(col, 60)
    const idx = centeredIndex(col, 60)
    if (idx !== props.minute) emit('select-minute', idx)
  })
}

// Sensibilidad controlada: 1 item por frame, siempre smooth.
function onWheel(col: 'hour' | 'minute', e: WheelEvent) {
  if (Math.abs(e.deltaY) < 8) return
  e.preventDefault()
  cancelSettling(col)
  if (wheelTicking.value) return
  wheelTicking.value = true
  requestAnimationFrame(() => {
    wheelTicking.value = false
    const el = col === 'hour' ? hourCol.value : minuteCol.value
    const dir = e.deltaY > 0 ? 1 : -1
    el?.scrollBy({ top: dir * ITEM_H, behavior: 'smooth' })
  })
}

function onHourKey(e: KeyboardEvent) {
  const d =
    e.key === 'ArrowDown' || e.key === 'ArrowRight'
      ? 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
        ? -1
        : 0
  if (!d) return
  e.preventDefault()
  const next = (((props.hour + d) % 24) + 24) % 24
  emit('select-hour', next)
  nextTick(() => scrollSmoothly(hourCol.value, next, 24))
}

function onMinuteKey(e: KeyboardEvent) {
  const d =
    e.key === 'ArrowDown' || e.key === 'ArrowRight'
      ? 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
        ? -1
        : 0
  if (!d) return
  e.preventDefault()
  const next = (((props.minute + d) % 60) + 60) % 60
  emit('select-minute', next)
  nextTick(() => scrollSmoothly(minuteCol.value, next, 60))
}

function pickHour(h: number) {
  if (h !== props.hour) emit('select-hour', h)
  nextTick(() => scrollSmoothly(hourCol.value, h, 24))
}

function pickMinute(m: number) {
  if (m !== props.minute) emit('select-minute', m)
  nextTick(() => scrollSmoothly(minuteCol.value, m, 60))
}

function onHourFlightEnd() {
  endFlight('hour')
}

function onMinuteFlightEnd() {
  endFlight('minute')
}

onMounted(() => {
  hourCol.value?.addEventListener('scrollend', onHourFlightEnd)
  minuteCol.value?.addEventListener('scrollend', onMinuteFlightEnd)
  nextTick(() => {
    placeInstantly(hourCol.value, props.hour, 24)
    placeInstantly(minuteCol.value, props.minute, 60)
  })
})

onUnmounted(() => {
  hourCol.value?.removeEventListener('scrollend', onHourFlightEnd)
  minuteCol.value?.removeEventListener('scrollend', onMinuteFlightEnd)
  clearTimeout(timerHour)
  clearTimeout(timerMinute)
})

watch(
  () => props.hour,
  (h) => {
    // Evita re-animar cuando la columna ya muestra ese valor
    // (el cambio vino de su propio scroll/click).
    if (centeredIndex(hourCol.value, 24) !== h) scrollSmoothly(hourCol.value, h, 24)
  }
)
watch(
  () => props.minute,
  (m) => {
    if (centeredIndex(minuteCol.value, 60) !== m) scrollSmoothly(minuteCol.value, m, 60)
  }
)
</script>

<template>
  <div data-drums class="flex gap-1">
    <div
      ref="hourCol"
      data-hour-column
      tabindex="0"
      role="spinbutton"
      aria-label="Elegir hora"
      :aria-valuemin="0"
      aria-valuemax="23"
      :aria-valuenow="hour"
      class="h-40 w-14 snap-y snap-mandatory overflow-y-auto scroll-smooth rounded-lg bg-surface-3/40 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      @scroll="onHourScroll"
      @pointerdown="cancelSettling('hour')"
      @wheel.prevent="onWheel('hour', $event)"
      @keydown="onHourKey"
    >
      <template v-for="copy in HOUR_COPIES" :key="`h${copy}`">
        <button
          v-for="h in HOURS"
          :key="`h${copy}-${h}`"
          type="button"
          :data-hour="pad(h)"
          :aria-pressed="h === hour"
          tabindex="-1"
          :class="[
            'flex h-8 w-full snap-center items-center justify-center text-body-sm font-semibold tabular-nums transition-colors duration-200 ease-out',
            h === hour ? 'bg-primary/15 text-primary' : 'text-ink-subtle hover:text-ink',
          ]"
          @click="pickHour(h)"
        >
          {{ pad(h) }}
        </button>
      </template>
    </div>

    <div
      ref="minuteCol"
      data-minute-column
      tabindex="0"
      role="spinbutton"
      aria-label="Elegir minutos"
      :aria-valuemin="0"
      aria-valuemax="59"
      :aria-valuenow="minute"
      class="h-40 w-14 snap-y snap-mandatory overflow-y-auto scroll-smooth rounded-lg bg-surface-3/40 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      @scroll="onMinuteScroll"
      @pointerdown="cancelSettling('minute')"
      @wheel.prevent="onWheel('minute', $event)"
      @keydown="onMinuteKey"
    >
      <template v-for="copy in MINUTE_COPIES" :key="`m${copy}`">
        <button
          v-for="m in MINUTES"
          :key="`m${copy}-${m}`"
          type="button"
          :data-minute="pad(m)"
          :aria-pressed="m === minute"
          tabindex="-1"
          :class="[
            'flex h-8 w-full snap-center items-center justify-center text-body-sm font-semibold tabular-nums transition-colors duration-200 ease-out',
            m === minute ? 'bg-primary/15 text-primary' : 'text-ink-subtle hover:text-ink',
          ]"
          @click="pickMinute(m)"
        >
          {{ pad(m) }}
        </button>
      </template>
    </div>
  </div>
</template>
