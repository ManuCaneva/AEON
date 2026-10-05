<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string // "HH:MM"
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const hoursContainer = ref<HTMLElement | null>(null)
const minutesContainer = ref<HTMLElement | null>(null)

const selectedHour = ref(12)
const selectedMinute = ref(0)

// Parse input modelValue
function parseTime(val: string) {
  const [hStr, mStr] = (val || '12:00').split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  return {
    h: isNaN(h) ? 12 : Math.max(0, Math.min(23, h)),
    m: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  }
}

function updateFromProps() {
  const { h, m } = parseTime(props.modelValue)
  selectedHour.value = h
  selectedMinute.value = m
  scrollToSelected()
}

let isScrolling = false
let hasDragged = false

function scrollToSelected() {
  nextTick(() => {
    isScrolling = true
    if (hoursContainer.value) {
      hoursContainer.value.scrollTop = selectedHour.value * 32
    }
    if (minutesContainer.value) {
      minutesContainer.value.scrollTop = selectedMinute.value * 32
    }
    setTimeout(() => {
      isScrolling = false
    }, 150)
  })
}

onMounted(() => {
  updateFromProps()
  if (hoursContainer.value) {
    makeGrabScrollable(hoursContainer.value, onHoursScroll, handleScrollEndHours)
  }
  if (minutesContainer.value) {
    makeGrabScrollable(minutesContainer.value, onMinutesScroll, handleScrollEndMinutes)
  }
})

watch(
  () => props.modelValue,
  () => {
    const { h, m } = parseTime(props.modelValue)
    if (h !== selectedHour.value || m !== selectedMinute.value) {
      selectedHour.value = h
      selectedMinute.value = m
      scrollToSelected()
    }
  }
)

function emitTime() {
  const hStr = String(selectedHour.value).padStart(2, '0')
  const mStr = String(selectedMinute.value).padStart(2, '0')
  emit('update:modelValue', `${hStr}:${mStr}`)
}

function selectHour(h: number) {
  if (hasDragged) return
  selectedHour.value = h
  scrollToSelected()
  emitTime()
}

function selectMinute(m: number) {
  if (hasDragged) return
  selectedMinute.value = m
  scrollToSelected()
  emitTime()
}

function onHoursScroll() {
  if (isScrolling || !hoursContainer.value) return
  const top = hoursContainer.value.scrollTop
  const idx = Math.round(top / 32)
  const clamped = Math.max(0, Math.min(23, idx))
  if (clamped !== selectedHour.value) {
    selectedHour.value = clamped
    emitTime()
  }
}

function onMinutesScroll() {
  if (isScrolling || !minutesContainer.value) return
  const top = minutesContainer.value.scrollTop
  const idx = Math.round(top / 32)
  const clamped = Math.max(0, Math.min(59, idx))
  if (clamped !== selectedMinute.value) {
    selectedMinute.value = clamped
    emitTime()
  }
}

// Ensure snapping after scroll ends
let scrollTimeoutHours: ReturnType<typeof setTimeout> | null = null
let scrollTimeoutMinutes: ReturnType<typeof setTimeout> | null = null

function clearScrollTimeout(timer: ReturnType<typeof setTimeout> | null) {
  if (timer !== null) clearTimeout(timer)
}

function handleHoursScroll() {
  onHoursScroll()
  handleScrollEndHours()
}

function handleMinutesScroll() {
  onMinutesScroll()
  handleScrollEndMinutes()
}

function handleScrollEndHours() {
  if (!hoursContainer.value) return
  clearScrollTimeout(scrollTimeoutHours)
  scrollTimeoutHours = setTimeout(() => {
    if (isScrolling || !hoursContainer.value) return
    const top = hoursContainer.value.scrollTop
    const idx = Math.round(top / 32)
    isScrolling = true
    hoursContainer.value.scrollTo({ top: idx * 32, behavior: 'smooth' })
    setTimeout(() => {
      isScrolling = false
    }, 150)
  }, 100)
}

function handleScrollEndMinutes() {
  if (!minutesContainer.value) return
  clearScrollTimeout(scrollTimeoutMinutes)
  scrollTimeoutMinutes = setTimeout(() => {
    if (isScrolling || !minutesContainer.value) return
    const top = minutesContainer.value.scrollTop
    const idx = Math.round(top / 32)
    isScrolling = true
    minutesContainer.value.scrollTo({ top: idx * 32, behavior: 'smooth' })
    setTimeout(() => {
      isScrolling = false
    }, 150)
  }, 100)
}

function makeGrabScrollable(el: HTMLElement, onScrollFn: () => void, onScrollEndFn: () => void) {
  let isDown = false
  let startY = 0
  let scrollTop = 0

  el.style.cursor = 'grab'

  el.addEventListener('mousedown', (e) => {
    isDown = true
    hasDragged = false
    el.style.cursor = 'grabbing'
    startY = e.pageY - el.offsetTop
    scrollTop = el.scrollTop

    // Disable scroll snapping and smooth behavior during active drag
    el.style.scrollSnapType = 'none'
    el.style.scrollBehavior = 'auto'
  })

  const handleDragEnd = () => {
    if (!isDown) return
    isDown = false
    el.style.cursor = 'grab'

    // Restore snap and smooth behavior, then snap
    el.style.scrollSnapType = 'y mandatory'
    el.style.scrollBehavior = 'smooth'
    onScrollEndFn()

    setTimeout(() => {
      hasDragged = false
    }, 50)
  }

  el.addEventListener('mouseleave', handleDragEnd)
  el.addEventListener('mouseup', handleDragEnd)

  el.addEventListener('mousemove', (e) => {
    if (!isDown) return
    e.preventDefault()
    const y = e.pageY - el.offsetTop
    const walk = (y - startY) * 1.5
    if (Math.abs(walk) > 5) {
      hasDragged = true
    }
    el.scrollTop = scrollTop - walk
    onScrollFn()
  })
}
</script>

<template>
  <div
    class="relative mx-auto flex h-40 w-full max-w-[140px] select-none items-center justify-center gap-2 overflow-hidden rounded-lg border border-hairline bg-surface-2 px-4 py-2"
  >
    <!-- Highlight overlay in the middle -->
    <div
      class="pointer-events-none absolute left-0 right-0 top-[64px] z-0 h-8 rounded-sm border-y border-primary/20 bg-primary/5"
    />

    <!-- Hours Column -->
    <div
      ref="hoursContainer"
      class="scrollbar-none z-10 h-full flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth"
      @scroll="handleHoursScroll"
    >
      <div class="h-16" />
      <!-- padding top -->
      <button
        v-for="h in 24"
        :key="h"
        type="button"
        :class="[
          'flex h-8 w-full snap-center items-center justify-center rounded-sm text-body-sm font-semibold transition-colors duration-150 focus-visible:bg-surface-3 focus-visible:outline-none active:bg-surface-3',
          selectedHour === h - 1
            ? 'scale-110 font-bold text-primary'
            : 'text-ink-subtle hover:bg-surface-3 hover:text-ink',
        ]"
        @click="selectHour(h - 1)"
      >
        {{ String(h - 1).padStart(2, '0') }}
      </button>
      <div class="h-16" />
      <!-- padding bottom -->
    </div>

    <!-- Separator -->
    <div class="z-10 select-none pb-0.5 text-card-title font-semibold text-ink-subtle">:</div>

    <!-- Minutes Column -->
    <div
      ref="minutesContainer"
      class="scrollbar-none z-10 h-full flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth"
      @scroll="handleMinutesScroll"
    >
      <div class="h-16" />
      <!-- padding top -->
      <button
        v-for="m in 60"
        :key="m"
        type="button"
        :class="[
          'flex h-8 w-full snap-center items-center justify-center rounded-sm text-body-sm font-semibold transition-colors duration-150 focus-visible:bg-surface-3 focus-visible:outline-none active:bg-surface-3',
          selectedMinute === m - 1
            ? 'scale-110 font-bold text-primary'
            : 'text-ink-subtle hover:bg-surface-3 hover:text-ink',
        ]"
        @click="selectMinute(m - 1)"
      >
        {{ String(m - 1).padStart(2, '0') }}
      </button>
      <div class="h-16" />
      <!-- padding bottom -->
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
