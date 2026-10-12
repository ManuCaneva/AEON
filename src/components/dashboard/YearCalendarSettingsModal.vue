<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import type { StripModePreference } from '@/lib/calendarHeatmap'

const props = defineProps<{ open: boolean; value: StripModePreference }>()
const emit = defineEmits<{ close: []; save: [mode: StripModePreference] }>()

const OPTIONS: { value: StripModePreference; title: string; description: string }[] = [
  {
    value: 'auto',
    title: 'Automática',
    description: 'Elige la mejor vista según el tamaño del panel.',
  },
  {
    value: 'meses',
    title: 'Por meses',
    description: '12 meses separados. Más claro para revisar cada mes en detalle.',
  },
  {
    value: 'tira',
    title: 'Año continuo',
    description: 'Todo el año en una sola vista. Ideal para ver tu constancia de un vistazo.',
  },
]

const selection = ref<StripModePreference>(props.value)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    selection.value = props.value
  }
)

function save() {
  emit('save', selection.value)
}
</script>

<template>
  <Modal :open="open" size="md" @close="emit('close')">
    <div class="p-4">
      <h3 class="mb-3 text-card-title font-semibold text-ink">Vista del calendario anual</h3>
      <div
        role="radiogroup"
        aria-label="Modo de vista"
        class="mb-4 flex flex-col gap-1 rounded-lg border border-hairline bg-surface-2 p-1"
      >
        <button
          v-for="opt in OPTIONS"
          :key="opt.value"
          type="button"
          role="radio"
          data-testid="strip-mode-option"
          :data-value="opt.value"
          :aria-checked="selection === opt.value"
          :class="[
            'rounded-md px-3 py-2 text-left transition-colors',
            selection === opt.value
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-ink-muted hover:text-ink',
          ]"
          @click="selection = opt.value"
        >
          <span class="block text-body-sm font-semibold">{{ opt.title }}</span>
          <span
            :class="[
              'block text-caption',
              selection === opt.value ? 'text-on-primary/80' : 'text-ink-tertiary',
            ]"
            >{{ opt.description }}</span
          >
        </button>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <Button variant="ghost" data-testid="strip-mode-cancel" @click="emit('close')"
          >Cancelar</Button
        >
        <Button data-testid="strip-mode-save" @click="save">Guardar</Button>
      </div>
    </div>
  </Modal>
</template>
