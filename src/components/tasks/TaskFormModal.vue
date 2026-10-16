<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { HABIT_COLORS } from '@/lib/habitColors'
import type { TaskStep } from '@/schemas/tasks'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { X } from 'lucide-vue-next'

const ui = useUiStore()
const tasks = useTasksStore()

const editing = computed(() => {
  if (!ui.editingTaskId) return null
  return tasks.tasks.find((t) => t.id === ui.editingTaskId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const title = ref('')
const description = ref('')
const color = ref<string>(HABIT_COLORS[0].value)
const due_date = ref<string>('')
const steps = ref<TaskStep[]>([])
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [ui.createTaskOpen, ui.editingTaskId] as const,
  ([open]) => {
    if (open) {
      if (editing.value) {
        title.value = editing.value.title
        description.value = editing.value.description ?? ''
        color.value = editing.value.color
        due_date.value = editing.value.due_date ?? ''
        steps.value = [...editing.value.steps]
      } else {
        title.value = ''
        description.value = ''
        color.value = HABIT_COLORS[0].value
        due_date.value = ''
        steps.value = []
      }
      error.value = null
    }
  }
)

function addStep() {
  steps.value.push({
    id: crypto.randomUUID(),
    title: '',
    done: false,
  })
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
}

function updateStepTitle(index: number, newTitle: string) {
  steps.value[index].title = newTitle
}

async function handleSubmit(e: Event) {
  e.preventDefault()
  const trimmedTitle = title.value.trim()
  if (!trimmedTitle) {
    error.value = 'El título no puede estar vacío.'
    return
  }

  // Las filas sin título se descartan: no bloquean el guardado de la tarea.
  const validSteps = steps.value.filter((s) => s.title.trim())

  saving.value = true
  error.value = null
  const desc = description.value.trim() || null
  const dueDate = due_date.value || undefined

  try {
    if (editing.value) {
      await tasks.updateTask(editing.value.id, {
        title: trimmedTitle,
        description: desc,
        color: color.value,
        due_date: dueDate,
        steps: validSteps,
      })
    } else {
      await tasks.createTask({
        title: trimmedTitle,
        description: desc,
        color: color.value,
        status: 'todo' as const,
        due_date: dueDate,
        steps: validSteps,
      })
    }
    ui.closeTaskModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createTaskOpen" size="md" @close="ui.closeTaskModal()">
    <form @submit="handleSubmit">
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar tarea' : 'Nueva tarea' }}
        </Text>
      </div>

      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="title"
          label="Título"
          placeholder="Ej: Terminar informe"
          :error="error ?? undefined"
          maxlength="100"
          required
        />

        <Textarea
          v-model="description"
          label="Descripción"
          placeholder="Ej: Incluir datos de ventas del Q4"
          maxlength="500"
          :rows="2"
        />

        <Input
          v-model="due_date"
          type="date"
          label="Fecha de vencimiento"
          :min="new Date().toISOString().split('T')[0]"
        />

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

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Text variant="body-sm" color="muted">Pasos</Text>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              data-testid="add-step-button"
              @click="addStep"
            >
              + Agregar paso
            </Button>
          </div>

          <div v-if="steps.length > 0" class="flex flex-col gap-2">
            <div v-for="(step, index) in steps" :key="step.id" class="flex items-center gap-2">
              <Input
                v-model="step.title"
                data-testid="step-input"
                :placeholder="`Paso ${index + 1}`"
                maxlength="100"
                @update:model-value="(val) => updateStepTitle(index, val)"
              />
              <button
                type="button"
                data-testid="remove-step-button"
                class="rounded p-2 text-ink-muted hover:bg-surface-2"
                @click="removeStep(index)"
              >
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <Button
          type="button"
          variant="tertiary"
          size="md"
          :disabled="saving"
          @click="ui.closeTaskModal()"
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" :loading="saving">
          {{ isEdit ? 'Guardar' : 'Crear' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>
