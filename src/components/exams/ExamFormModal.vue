<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useExamsStore } from '@/stores/exams'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'

const ui = useUiStore()
const exams = useExamsStore()

const editing = computed(() => {
  if (!ui.editingExamId) return null
  return exams.exams.find((e) => e.id === ui.editingExamId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const title = ref('')
const date = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [ui.createExamOpen, ui.editingExamId] as const,
  ([open]) => {
    if (open) {
      if (editing.value) {
        title.value = editing.value.title
        date.value = editing.value.date
      } else {
        title.value = ''
        date.value = ''
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
  if (!date.value) {
    error.value = 'La fecha es obligatoria.'
    return
  }

  saving.value = true
  error.value = null

  try {
    if (editing.value) {
      await exams.updateExam(editing.value.id, { title: trimmedTitle, date: date.value })
    } else {
      await exams.createExam({ title: trimmedTitle, date: date.value })
    }
    ui.closeExamModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createExamOpen" size="md" @close="ui.closeExamModal()">
    <form @submit="handleSubmit">
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar examen' : 'Nuevo examen' }}
        </Text>
      </div>

      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="title"
          data-testid="exam-title-input"
          label="Título"
          placeholder="Ej: Parcial 1 de Análisis"
          :error="error ?? undefined"
          maxlength="100"
          required
        />

        <Input v-model="date" data-testid="exam-date-input" type="date" label="Fecha" />
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <Button
          type="button"
          variant="tertiary"
          size="md"
          :disabled="saving"
          @click="ui.closeExamModal()"
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
