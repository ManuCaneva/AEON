<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useHabitsStore } from '@/stores/habits'
import { HABIT_COLORS, DEFAULT_HABIT_COLOR } from '@/lib/habitColors'
import { HABIT_ICONS, DEFAULT_HABIT_ICON } from '@/lib/icons'
import { HABIT_TARGET_MAX, HABIT_TARGET_MIN } from '@/schemas/habits'
import type { HabitFrequency } from '@/schemas/habits'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'

const ui = useUiStore()
const habits = useHabitsStore()

const editing = computed(() => {
  if (!ui.editingHabitId) return null
  return habits.habits.find((h) => h.id === ui.editingHabitId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const name = ref('')
const description = ref('')
const color = ref<string>(DEFAULT_HABIT_COLOR)
const icon = ref<string>(DEFAULT_HABIT_ICON)
const frequency = ref<HabitFrequency>({ type: 'daily', target_per_period: 1 })
const targetPerDay = ref<string>('1')
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [ui.createHabitOpen, ui.editingHabitId] as const,
  ([open]) => {
    if (open) {
      if (editing.value) {
        name.value = editing.value.name
        description.value = editing.value.description ?? ''
        color.value = editing.value.color
        icon.value = editing.value.icon ?? DEFAULT_HABIT_ICON
        frequency.value = editing.value.frequency
        targetPerDay.value =
          editing.value.frequency.type === 'daily'
            ? String(editing.value.frequency.target_per_period)
            : '1'
      } else {
        name.value = ''
        description.value = ''
        color.value = DEFAULT_HABIT_COLOR
        icon.value = DEFAULT_HABIT_ICON
        frequency.value = { type: 'daily', target_per_period: 1 }
        targetPerDay.value = '1'
      }
      error.value = null
    }
  }
)

function parseTarget(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < HABIT_TARGET_MIN) return HABIT_TARGET_MIN
  return Math.min(HABIT_TARGET_MAX, Math.round(n))
}

async function handleSubmit(e: Event) {
  e.preventDefault()
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'El nombre no puede estar vacío.'
    return
  }
  saving.value = true
  error.value = null
  const desc = description.value.trim() || null
  const nextFrequency: HabitFrequency =
    frequency.value.type === 'daily'
      ? { type: 'daily', target_per_period: parseTarget(targetPerDay.value) }
      : frequency.value
  try {
    if (editing.value) {
      await habits.updateHabit(editing.value.id, {
        name: trimmed,
        description: desc,
        color: color.value,
        icon: icon.value,
        frequency: nextFrequency,
      })
    } else {
      await habits.createHabit({
        name: trimmed,
        description: desc,
        color: color.value,
        icon: icon.value,
        frequency: nextFrequency,
      })
    }
    ui.closeModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createHabitOpen" size="md" @close="ui.closeModal()">
    <template #header>
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar hábito' : 'Nuevo hábito' }}
        </Text>
      </div>
    </template>

    <form id="habit-form" @submit="handleSubmit">
      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="name"
          label="Nombre"
          placeholder="Ej: Leer 20 minutos"
          :error="error ?? undefined"
          maxlength="100"
          required
        />

        <Textarea
          v-model="description"
          label="Descripción"
          placeholder="Ej: Leer al menos 20 páginas de un libro"
          maxlength="500"
          :rows="2"
        />

        <Input
          v-if="frequency.type === 'daily'"
          v-model="targetPerDay"
          type="number"
          label="Repeticiones por día"
          :min="HABIT_TARGET_MIN"
          :max="HABIT_TARGET_MAX"
          helper="Cuántas veces por día querés cumplir este hábito (1–20)."
        />

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Ícono</Text>
          <div class="grid grid-cols-8 gap-1">
            <button
              v-for="i in HABIT_ICONS"
              :key="i.value"
              data-testid="icon-option"
              type="button"
              :title="i.name"
              :aria-label="i.name"
              :aria-pressed="icon === i.value"
              :class="[
                'flex items-center justify-center rounded-md p-2 transition-colors duration-150',
                icon === i.value
                  ? 'selected bg-primary text-on-primary'
                  : 'bg-surface-1 text-ink hover:bg-surface-2',
              ]"
              @click="icon = i.value"
            >
              <component :is="i.icon" :size="18" />
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Color</Text>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="c in HABIT_COLORS"
              :key="c.value"
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
          @click="ui.closeModal()"
        >
          Cancelar
        </Button>
        <Button type="submit" form="habit-form" variant="primary" size="md" :loading="saving">
          {{ isEdit ? 'Guardar' : 'Crear' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
