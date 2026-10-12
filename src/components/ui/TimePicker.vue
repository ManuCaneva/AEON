<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Clock } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import TimeDrums from '@/components/ui/TimeDrums.vue'
import MiniClock from '@/components/ui/MiniClock.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string // "HH:MM"
    label?: string
    align?: 'left' | 'right'
  }>(),
  { label: '', align: 'left' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const pad = (n: number) => String(n).padStart(2, '0')
const clampNum = (n: number, max: number) => (isNaN(n) ? 0 : Math.max(0, Math.min(max, n)))
const fmt = (h: number, m: number) => `${pad(h)}:${pad(m)}`

function parseText(s: string): { h: number; m: number } {
  const clean = (s || '').replace(/[^0-9:]/g, '')
  let hs = ''
  let ms = ''
  if (clean.includes(':')) {
    const [a = '', b = ''] = clean.split(':')
    hs = a.replace(/\D/g, '')
    ms = b.replace(/\D/g, '')
  } else {
    const d = clean.replace(/\D/g, '')
    if (d.length <= 2) {
      hs = d
    } else {
      hs = d.slice(0, -2)
      ms = d.slice(-2)
    }
  }
  return { h: clampNum(parseInt(hs || '0', 10), 23), m: clampNum(parseInt(ms || '0', 10), 59) }
}

const hourInputEl = ref<HTMLInputElement | null>(null)
const minuteInputEl = ref<HTMLInputElement | null>(null)
const clockButtonEl = ref<HTMLElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)

const parsed = parseText(props.modelValue)
const hourText = ref(pad(parsed.h))
const minuteText = ref(pad(parsed.m))

function isFocused(): boolean {
  return (
    document.activeElement === hourInputEl.value || document.activeElement === minuteInputEl.value
  )
}

watch(
  () => props.modelValue,
  (val) => {
    if (isFocused()) return
    const { h, m } = parseText(val)
    hourText.value = pad(h)
    minuteText.value = pad(m)
  }
)

function normModel(): string {
  const { h, m } = parseText(props.modelValue)
  return fmt(h, m)
}

function currentText(): string {
  const h = clampNum(parseInt(hourText.value || '0', 10), 23)
  const m = clampNum(parseInt(minuteText.value || '0', 10), 59)
  return fmt(h, m)
}

function commitSegments() {
  const next = currentText()
  hourText.value = next.slice(0, 2)
  minuteText.value = next.slice(3, 5)
  if (next !== normModel()) {
    emit('update:modelValue', next)
  }
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '').slice(0, 2)
}

function onHourInput(e: Event) {
  const el = e.target as HTMLInputElement
  const filtered = digitsOnly(el.value)
  hourText.value = filtered
  el.value = filtered
  if (filtered.length === 2) {
    commitSegments()
    nextTick(() => {
      minuteInputEl.value?.focus()
      minuteInputEl.value?.select()
    })
  }
}

function onMinuteInput(e: Event) {
  const el = e.target as HTMLInputElement
  const filtered = digitsOnly(el.value)
  minuteText.value = filtered
  el.value = filtered
}

function selectAll(e: Event) {
  ;(e.target as HTMLInputElement).select()
}

function onMinuteBackspace(e: KeyboardEvent) {
  if (e.key === 'Backspace' && minuteText.value === '') {
    e.preventDefault()
    hourInputEl.value?.focus()
    hourInputEl.value?.select()
  }
}

function adjustHour(d: number) {
  const { h, m } = parseText(currentText())
  const next = fmt((((h + d) % 24) + 24) % 24, m)
  hourText.value = next.slice(0, 2)
  minuteText.value = next.slice(3, 5)
  if (next !== normModel()) {
    emit('update:modelValue', next)
  }
}

function adjustMinute(d: number) {
  const { h, m } = parseText(currentText())
  const next = fmt(h, (((m + d) % 60) + 60) % 60)
  hourText.value = next.slice(0, 2)
  minuteText.value = next.slice(3, 5)
  if (next !== normModel()) {
    emit('update:modelValue', next)
  }
}

function onHourKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitSegments()
    minuteInputEl.value?.focus()
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    adjustHour(e.key === 'ArrowUp' ? 1 : -1)
  }
}

function onMinuteKeydown(e: KeyboardEvent) {
  if (e.key === 'Backspace' && minuteText.value === '') {
    onMinuteBackspace(e)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    commitSegments()
    minuteInputEl.value?.blur()
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const d = e.key === 'ArrowUp' ? 1 : -1
    if (e.shiftKey) adjustHour(d)
    else adjustMinute(d)
  }
}

// ── Popup chico con drums ──

const POPUP_WIDTH = 248

const open = ref(false)
const view = ref<'hour' | 'minute'>('hour')
const draftH = ref(6)
const draftM = ref(0)
const pos = ref({ top: 0, left: 0 })

function computePos() {
  const rect = clockButtonEl.value?.getBoundingClientRect()
  const h = popupEl.value?.offsetHeight || 0
  const vw = window.innerWidth || 1024
  const vh = window.innerHeight || 768
  let top = (rect?.bottom ?? 0) + 8
  if (top + h > vh - 8) top = Math.max(8, (rect?.top ?? vh) - h - 8)
  let left = props.align === 'left' ? (rect?.left ?? 0) : (rect?.right ?? 0) - POPUP_WIDTH
  left = Math.max(8, Math.min(vw - POPUP_WIDTH - 8, left))
  pos.value = { top, left }
}

function openClock() {
  const { h, m } = parseText(props.modelValue)
  draftH.value = h
  draftM.value = m
  view.value = 'hour'
  open.value = true
  nextTick(() => {
    computePos()
    popupEl.value?.querySelector<HTMLElement>('[data-hour-column]')?.focus({ preventScroll: true })
  })
}

function closeClock(commit: boolean) {
  if (commit) emit('update:modelValue', fmt(draftH.value, draftM.value))
  open.value = false
  nextTick(() => clockButtonEl.value?.focus())
}

function onSelectHour(h: number) {
  draftH.value = h
  view.value = 'minute'
}

function toggleClock() {
  if (open.value) closeClock(false)
  else openClock()
}

function onDocumentPointerDown(e: Event) {
  if (!open.value) return
  const t = e.target as Node | null
  if (t && popupEl.value?.contains(t)) return
  if (t && clockButtonEl.value?.contains(t)) return
  closeClock(false)
}

function onWindowChange(e: Event) {
  if (!open.value) return
  // El scroll interno de los drums no debe cerrar el popup, solo el de fuera.
  if (e.type === 'scroll' && e.target instanceof Node && popupEl.value?.contains(e.target)) return
  closeClock(false)
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  window.addEventListener('scroll', onWindowChange, true)
  window.addEventListener('resize', onWindowChange)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('scroll', onWindowChange, true)
  window.removeEventListener('resize', onWindowChange)
})
</script>

<template>
  <div
    class="flex h-10 w-full items-center gap-0.5 rounded-lg border border-hairline bg-surface-2 pl-3 pr-1.5 transition-colors duration-150 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
  >
    <input
      ref="hourInputEl"
      v-model="hourText"
      data-hour-input
      :aria-label="label ? `Hora de ${label.toLowerCase()}` : 'Hora'"
      inputmode="numeric"
      autocomplete="off"
      maxlength="2"
      placeholder="HH"
      spellcheck="false"
      class="w-8 bg-transparent text-center text-body-sm font-semibold tabular-nums text-ink outline-none placeholder:text-ink-tertiary"
      @input="onHourInput"
      @focus="selectAll"
      @blur="commitSegments"
      @keydown="onHourKeydown"
    />
    <span class="font-semibold text-ink-subtle" aria-hidden="true">:</span>
    <input
      ref="minuteInputEl"
      v-model="minuteText"
      data-minute-input
      :aria-label="label ? `Minutos de ${label.toLowerCase()}` : 'Minutos'"
      inputmode="numeric"
      autocomplete="off"
      maxlength="2"
      placeholder="MM"
      spellcheck="false"
      class="w-8 bg-transparent text-center text-body-sm font-semibold tabular-nums text-ink outline-none placeholder:text-ink-tertiary"
      @input="onMinuteInput"
      @focus="selectAll"
      @blur="commitSegments"
      @keydown="onMinuteKeydown"
    />
    <span class="flex-1" />
    <button
      ref="clockButtonEl"
      type="button"
      data-clock-button
      :aria-label="`Elegir hora${label ? ' de ' + label.toLowerCase() : ''}`"
      aria-haspopup="dialog"
      :aria-expanded="open"
      class="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      @click="toggleClock"
    >
      <Clock :size="16" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      ref="popupEl"
      data-clock-popup
      role="dialog"
      :aria-label="`Elegir hora${label ? ' de ' + label.toLowerCase() : ''}`"
      class="fixed z-[80] rounded-xl border border-hairline bg-surface-1 p-3 shadow-2xl"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${POPUP_WIDTH}px` }"
      @keydown.escape.stop="closeClock(false)"
    >
      <div
        class="mb-2 flex items-center justify-center gap-1 text-card-title font-bold tabular-nums"
      >
        <button
          type="button"
          :class="[
            'rounded-md px-2 py-1 transition-colors',
            view === 'hour' ? 'bg-primary/15 text-primary' : 'text-ink-subtle hover:text-ink',
          ]"
          @click="view = 'hour'"
        >
          {{ pad(draftH) }}
        </button>
        <span class="text-ink-subtle">:</span>
        <button
          type="button"
          :class="[
            'rounded-md px-2 py-1 transition-colors',
            view === 'minute' ? 'bg-primary/15 text-primary' : 'text-ink-subtle hover:text-ink',
          ]"
          @click="view = 'minute'"
        >
          {{ pad(draftM) }}
        </button>
      </div>

      <div class="flex items-center justify-center gap-2">
        <TimeDrums
          :hour="draftH"
          :minute="draftM"
          :active="view"
          @select-hour="onSelectHour"
          @select-minute="draftM = $event"
        />
        <MiniClock :hour="draftH" :minute="draftM" class="text-ink-subtle" />
      </div>

      <div class="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" @click="closeClock(false)">Cancelar</Button>
        <Button size="sm" @click="closeClock(true)">Aceptar</Button>
      </div>
    </div>
  </Teleport>
</template>
