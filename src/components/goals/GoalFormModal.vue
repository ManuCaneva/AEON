<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGoalsStore } from '@/stores/goals'
import { HABIT_COLORS } from '@/lib/habitColors'
import type { GoalFrequency } from '@/schemas/goals'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import FrequencySelector from '@/components/ui/FrequencySelector.vue'

const ui = useUiStore()
const goals = useGoalsStore()

const editing = computed(() => {
  if (!ui.editingGoalId) return null
  return goals.goals.find((g) => g.id === ui.editingGoalId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const title = ref('')
const description = ref('')
const color = ref<string>(HABIT_COLORS[0].value)
const target = ref<number>(10)
const unit = ref<string>('')
const frequency = ref<GoalFrequency>({ type: 'daily' })
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [ui.createGoalOpen, ui.editingGoalId] as const,
  ([open]) => {
    if (open) {
      if (editing.value) {
        title.value = editing.value.title
        description.value = editing.value.description ?? ''
        color.value = editing.value.color
        target.value = editing.value.target
        unit.value = editing.value.unit ?? ''
        frequency.value = editing.value.frequency
      } else {
        title.value = ''
        description.value = ''
        color.value = HABIT_COLORS[0].value
        target.value = 10
        unit.value = ''
        frequency.value = { type: 'daily' }
      }
      error.value = null
    }
  }
)

async function handleSubmit(e: Event) {
  e.preventDefault()
  const trimmedTitle = title.value.trim()
  if (!trimmedTitle) {
    error.value = 'El título no puede estar vacío.'
    return
  }
  if (target.value < 1) {
    error.value = 'El objetivo debe ser al menos 1.'
    return
  }

  saving.value = true
  error.value = null
  const desc = description.value.trim() || null
  const unitValue = unit.value.trim() || null

  try {
    if (editing.value) {
      await goals.updateGoal(editing.value.id, {
        title: trimmedTitle,
        description: desc,
        color: color.value,
        target: target.value,
        unit: unitValue,
        frequency: frequency.value,
      })
    } else {
      await goals.createGoal({
        title: trimmedTitle,
        description: desc,
        color: color.value,
        target: target.value,
        unit: unitValue,
        frequency: frequency.value,
      })
    }
    ui.closeGoalModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createGoalOpen" size="md" @close="ui.closeGoalModal()">
    <template #header>
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar objetivo' : 'Nuevo objetivo' }}
        </Text>
      </div>
    </template>

    <form id="goal-form" @submit="handleSubmit">
      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="title"
          label="Título"
          placeholder="Ej: Leer 30 minutos"
          :error="error ?? undefined"
          maxlength="100"
          required
        />

        <Textarea
          v-model="description"
          label="Descripción"
          placeholder="Ej: Leer al menos 30 minutos de un libro"
          maxlength="500"
          :rows="2"
        />

        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block select-none text-body-sm text-ink-muted">Meta</label>
            <input
              v-model.number="target"
              type="number"
              min="1"
              required
              class="w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-ink transition-colors duration-150 hover:border-hairline-strong focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div class="flex-1">
            <label class="mb-1 block select-none text-body-sm text-ink-muted">Unidad</label>
            <input
              v-model="unit"
              type="text"
              placeholder="Ej: páginas, minutos"
              maxlength="20"
              class="w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-ink transition-colors duration-150 placeholder:text-ink-tertiary hover:border-hairline-strong focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Frecuencia</Text>
          <FrequencySelector v-model="frequency" />
        </div>

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Color</Text>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="c in HABIT_COLORS"
              :key="c.value"
              data-testid="color-option"
              type="button"
              :title="c.name"
              :aria-label="c.name"
              :aria-pressed="color === c.value"
              :style="{ backgroundColor: c.value }"
              :class="[
                'h-8 w-8 rounded-full transition-all duration-150',
                'hover:scale-110 active:scale-95',
                color === c.value ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface-1' : '',
              ]"
              @click="color = c.value"
            />
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <Button
          type="button"
          variant="tertiary"
          size="md"
          :disabled="saving"
          @click="ui.closeGoalModal()"
        >
          Cancelar
        </Button>
        <Button type="submit" form="goal-form" variant="primary" size="md" :loading="saving">
          {{ isEdit ? 'Guardar' : 'Crear' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
