<script setup lang="ts">
import { computed } from 'vue'
import { blockColorTint } from '@/lib/scheduleColors'
import type { BlockColorToken } from '@/schemas/weeklySchedule'

const props = withDefaults(
  defineProps<{
    title: string
    color: BlockColorToken
    today?: boolean
    /**
     * Ocurrencia elegida: sobre ella actúan la × y `Supr` en el modo edición.
     * Solo se anuncia (`aria-pressed`) cuando `selectable` está activo.
     */
    selected?: boolean
    /** Modo edición del cronograma: el bloque se puede seleccionar. */
    selectable?: boolean
    startTime?: string
    endTime?: string
    showTimes?: boolean
  }>(),
  { today: false, selected: false, selectable: false }
)

const emit = defineEmits<{
  click: []
}>()

const blockStyle = computed(() => ({
  backgroundColor: blockColorTint(props.color, props.today ? 0.26 : 0.16),
  borderColor: blockColorTint(props.color, props.today ? 1 : 0.8),
  color: 'var(--color-ink)',
}))
</script>

<template>
  <button
    :class="[
      'absolute flex cursor-pointer items-center justify-center overflow-hidden rounded-sm border px-1 py-3 text-center transition-all duration-150',
      'schedule-block',
      props.selected && 'ring-1 ring-accent-purple',
    ]"
    :style="blockStyle"
    :aria-pressed="props.selectable ? props.selected : undefined"
    @click="emit('click')"
  >
    <span
      v-if="showTimes && startTime"
      class="absolute left-1 top-0.5 text-caption font-medium leading-none opacity-70"
      data-testid="schedule-block-start"
    >
      {{ startTime }}
    </span>
    <div class="schedule-block-title break-words font-medium leading-tight">{{ title }}</div>
    <span
      v-if="showTimes && endTime"
      class="absolute bottom-0.5 left-1 text-caption font-medium leading-none opacity-70"
      data-testid="schedule-block-end"
    >
      {{ endTime }}
    </span>
  </button>
</template>
