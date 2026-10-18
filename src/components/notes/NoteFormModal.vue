<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useNotesStore } from '@/stores/notes'
import { HABIT_COLORS } from '@/lib/habitColors'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'

const ui = useUiStore()
const notes = useNotesStore()

const editing = computed(() => {
  if (!ui.editingNoteId) return null
  return notes.notes.find((n) => n.id === ui.editingNoteId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const title = ref('')
const description = ref('')
const color = ref<string>(HABIT_COLORS[0].value)
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [ui.createNoteOpen, ui.editingNoteId] as const,
  ([open]) => {
    if (open) {
      if (editing.value) {
        title.value = editing.value.title ?? ''
        description.value = editing.value.description ?? ''
        color.value = editing.value.color
      } else {
        title.value = ''
        description.value = ''
        color.value = HABIT_COLORS[0].value
      }
      error.value = null
    }
  }
)

async function handleSubmit(e: Event) {
  e.preventDefault()
  const trimmedTitle = title.value.trim()
  const trimmedDescription = description.value.trim()
  if (!trimmedTitle && !trimmedDescription) {
    error.value = 'La nota necesita título o descripción.'
    return
  }

  saving.value = true
  error.value = null
  const t = trimmedTitle || null
  const d = trimmedDescription || null

  try {
    if (editing.value) {
      await notes.updateNote(editing.value.id, {
        title: t,
        description: d,
        color: color.value,
      })
    } else {
      await notes.createNote({
        title: t,
        description: d,
        color: color.value,
      })
    }
    ui.closeNoteModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createNoteOpen" size="md" @close="ui.closeNoteModal()">
    <template #header>
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar nota' : 'Nueva nota' }}
        </Text>
      </div>
    </template>

    <form id="note-form" @submit="handleSubmit">
      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="title"
          label="Título (opcional)"
          placeholder="Ej: Lo que dijo el profesor"
          maxlength="100"
        />

        <Textarea
          v-model="description"
          label="Descripción (opcional)"
          placeholder="Ej: Repasar capítulo 3 antes del parcial"
          maxlength="5000"
          :rows="5"
          :error="error ?? undefined"
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
      </div>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <Button
          type="button"
          variant="tertiary"
          size="md"
          :disabled="saving"
          @click="ui.closeNoteModal()"
        >
          Cancelar
        </Button>
        <Button type="submit" form="note-form" variant="primary" size="md" :loading="saving">
          {{ isEdit ? 'Guardar' : 'Crear' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
