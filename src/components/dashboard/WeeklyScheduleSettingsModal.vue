<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Switch from '@/components/ui/Switch.vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useWeeklyScheduleStore()

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const granularity = ref(30)
const enabledDays = ref<number[]>([0, 1, 2, 3, 4, 5, 6])
const showBlockTimes = ref(true)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    error.value = null
    granularity.value = store.settings.granularity_minutes
    enabledDays.value = [...store.settings.enabled_days]
    showBlockTimes.value = store.settings.show_block_times
  }
)

function toggleDay(day: number) {
  if (enabledDays.value.includes(day)) {
    if (enabledDays.value.length === 1) {
      error.value = 'Seleccioná al menos un día'
      return
    }
    enabledDays.value = enabledDays.value.filter((value) => value !== day)
  } else {
    enabledDays.value = [...enabledDays.value, day].sort((a, b) => a - b)
  }
  error.value = null
}

async function save() {
  error.value = null
  if (enabledDays.value.length === 0) {
    error.value = 'Seleccioná al menos un día'
    return
  }
  try {
    await store.saveSettings({
      granularity_minutes: granularity.value as 15 | 30 | 60,
      enabled_days: enabledDays.value,
      show_block_times: showBlockTimes.value,
    })
    emit('close')
  } catch (err) {
    error.value = String(err)
  }
}
</script>

<template>
  <Modal :open="open" size="md" @close="emit('close')">
    <div class="p-4">
      <h3 class="mb-3 text-card-title font-semibold text-ink">Ajustes del cronograma</h3>
      <label class="mb-1.5 block text-caption font-medium text-ink-muted">Granularidad</label>
      <div
        role="radiogroup"
        aria-label="Granularidad"
        class="mb-4 flex gap-1 rounded-lg border border-hairline bg-surface-2 p-1"
      >
        <button
          v-for="g in [15, 30, 60]"
          :key="g"
          type="button"
          role="radio"
          :aria-checked="granularity === g"
          :class="[
            'flex-1 rounded-md px-3 py-1.5 text-body-sm transition-colors',
            granularity === g
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-ink-muted hover:text-ink',
          ]"
          @click="granularity = g"
        >
          {{ g }} min
        </button>
      </div>
      <div class="mb-4 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
        <Switch
          v-model="showBlockTimes"
          label="Mostrar horarios en los bloques"
          size="sm"
          data-testid="show-block-times"
        />
      </div>
      <label class="mb-1.5 block text-caption font-medium text-ink-muted">Días activos</label>
      <div class="mb-4 grid grid-cols-7 gap-1.5">
        <button
          v-for="(day, index) in DAYS"
          :key="day"
          type="button"
          :aria-pressed="enabledDays.includes(index)"
          :class="[
            'min-w-0 whitespace-nowrap rounded-full border px-2 py-1.5 text-center text-body-sm transition-colors duration-150',
            enabledDays.includes(index)
              ? 'border-primary/60 bg-accent-purple-tint text-accent-purple'
              : 'border-hairline bg-surface-1 text-ink-tertiary hover:border-hairline-strong hover:text-ink-muted',
          ]"
          @click="toggleDay(index)"
        >
          {{ day }}
        </button>
      </div>
      <p v-if="error" class="mt-2 text-body-sm text-accent-red">{{ error }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <Button variant="ghost" @click="emit('close')">Cancelar</Button>
        <Button @click="save">Guardar</Button>
      </div>
    </div>
  </Modal>
</template>
