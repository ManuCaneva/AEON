<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  hour: number
  minute: number
}>()

const minuteDeg = computed(() => (props.minute / 60) * 360)
const hourDeg = computed(() => (((props.hour % 12) + props.minute / 60) / 12) * 360)
</script>

<template>
  <svg
    data-miniclock
    aria-hidden="true"
    viewBox="0 0 64 64"
    class="h-16 w-16 shrink-0 rounded-full bg-surface-3/60"
  >
    <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-opacity="0.15" />
    <g stroke="currentColor" stroke-opacity="0.5">
      <line x1="32" y1="5" x2="32" y2="9" />
      <line x1="32" y1="55" x2="32" y2="59" />
      <line x1="5" y1="32" x2="9" y2="32" />
      <line x1="55" y1="32" x2="59" y2="32" />
    </g>
    <line
      data-minute-hand
      x1="32"
      y1="32"
      x2="32"
      y2="12"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      class="transition-transform duration-200 ease-out"
      :style="{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '32px 32px' }"
    />
    <line
      data-hour-hand
      x1="32"
      y1="32"
      x2="32"
      y2="20"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      class="transition-transform duration-200 ease-out"
      :style="{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '32px 32px' }"
    />
    <circle cx="32" cy="32" r="2.5" fill="currentColor" />
  </svg>
</template>
