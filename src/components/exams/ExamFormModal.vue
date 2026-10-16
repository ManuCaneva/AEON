<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useExamsStore } from '@/stores/exams'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import {
  ExamStatusSchema,
  pruneEmptyTopics,
  type ExamStatus,
  type ExamTopic,
} from '@/schemas/exams'
import type { BlockColorToken } from '@/schemas/weeklySchedule'
import { examStatusLabel } from '@/lib/examStatus'
import { blockColorRgb } from '@/lib/scheduleColors'
import type { EventChoice } from '@/lib/entityEventLink'
import Modal from '@/components/ui/Modal.vue'
import EventChoiceField from '@/components/ui/EventChoiceField.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { Check, X } from 'lucide-vue-next'

const ui = useUiStore()
const exams = useExamsStore()
const weekly = useWeeklyScheduleStore()

const editing = computed(() => {
  if (!ui.editingExamId) return null
  return exams.exams.find((e) => e.id === ui.editingExamId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const statusOptions = ExamStatusSchema.options.map((value) => ({
  value,
  label: examStatusLabel(value),
}))

const title = ref('')
const date = ref('')
const status = ref<ExamStatus>('pendiente')
const gradeInput = ref('')
const blockId = ref('')
const fallbackColor = ref<BlockColorToken>('lavender')
const topics = ref<ExamTopic[]>([])
const error = ref<string | null>(null)
const calendarError = ref<string | null>(null)
const saving = ref(false)

// Id del examen ya persistido cuando la creación del evento falló: un
// reintento edita en vez de crear un examen duplicado.
const savedExamId = ref<string | null>(null)

// Elección de evento del formulario (cuatro opciones excluyentes; ver
// EventChoice). El apartado compartido la mantiene por v-model.
const eventChoice = ref<EventChoice>({ mode: 'none' })

const blocks = computed(() => weekly.blocksWithSlots)
// Color de la vista previa: el del bloque elegido; si no hay, el de respaldo.
const previewColor = computed<BlockColorToken>(
  () => blocks.value.find((b) => b.id === blockId.value)?.color ?? fallbackColor.value
)

watch(
  () => [ui.createExamOpen, ui.editingExamId] as const,
  ([open]) => {
    if (open) {
      // Asegura que el selector liste los bloques existentes aunque el
      // widget del Cronograma semanal no esté montado en el dashboard.
      void weekly.loadAll()
      if (editing.value) {
        title.value = editing.value.title
        date.value = editing.value.date
        status.value = editing.value.status
        gradeInput.value = editing.value.grade !== null ? String(editing.value.grade) : ''
        blockId.value = editing.value.block_id ?? ''
        fallbackColor.value = editing.value.fallback_color
        // Copia los temas con sus subtemas garantizados como lista.
        topics.value = editing.value.topics.map((t) => ({
          ...t,
          subtopics: [...(t.subtopics ?? [])],
        }))
      } else {
        title.value = ''
        date.value = ''
        status.value = 'pendiente'
        gradeInput.value = ''
        blockId.value = ''
        fallbackColor.value = 'lavender'
        topics.value = []
      }
      eventChoice.value = { mode: 'none' }
      savedExamId.value = null
      error.value = null
      calendarError.value = null
    }
  }
)

function addTopic() {
  topics.value.push({
    id: crypto.randomUUID(),
    title: '',
    completed: false,
    subtopics: [],
  })
}

function removeTopic(index: number) {
  topics.value.splice(index, 1)
}

function updateTopicTitle(index: number, newTitle: string) {
  topics.value[index].title = newTitle
}

function addSubtopic(topicIndex: number) {
  topics.value[topicIndex].subtopics.push({
    id: crypto.randomUUID(),
    title: '',
    completed: false,
  })
}

function removeSubtopic(topicIndex: number, subtopicIndex: number) {
  topics.value[topicIndex].subtopics.splice(subtopicIndex, 1)
}

function updateSubtopicTitle(topicIndex: number, subtopicIndex: number, newTitle: string) {
  topics.value[topicIndex].subtopics[subtopicIndex].title = newTitle
}

// El formulario es local-hasta-guardar: estos toggles mutan el estado del
// formulario y viajan dentro de `topics` al enviar. Marcar el tema marca todos
// sus subtemas; desmarcarlo no los toca (misma regla que el store y la tarjeta).
function toggleTopicCompleted(topicIndex: number) {
  const topic = topics.value[topicIndex]
  if (topic.completed) {
    topic.completed = false
    return
  }
  topic.completed = true
  topic.subtopics.forEach((subtopic) => (subtopic.completed = true))
}

function toggleSubtopicCompleted(topicIndex: number, subtopicIndex: number) {
  const subtopic = topics.value[topicIndex].subtopics[subtopicIndex]
  subtopic.completed = !subtopic.completed
}

// La nota sólo tiene sentido en un examen rendido: al salir de ese estado se
// limpia, y el guardado la envía como null (sin nota).
watch(status, (value) => {
  if (value !== 'rendido') gradeInput.value = ''
})

/** Nota del formulario: null = sin nota; valida rango 0–10 con decimales. */
function resolveGrade(): number | null | 'invalid' {
  if (status.value !== 'rendido' || gradeInput.value.trim() === '') return null
  const parsed = Number(gradeInput.value)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) return 'invalid'
  return parsed
}

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

  const grade = resolveGrade()
  if (grade === 'invalid') {
    error.value = 'La nota debe ser un número entre 0 y 10.'
    return
  }

  // Descarta filas de tema y de subtema sin título: no bloquean el alta.
  const validTopics = pruneEmptyTopics(topics.value)
  // Mismo borrador para alta, edición y reintento: sólo cambia la llamada.
  const draft = {
    title: trimmedTitle,
    date: date.value,
    status: status.value,
    grade,
    block_id: blockId.value || null,
    topics: validTopics,
  }

  saving.value = true
  error.value = null
  calendarError.value = null

  try {
    if (editing.value) {
      const { eventError } = await exams.updateExamWithEvent(
        editing.value.id,
        draft,
        eventChoice.value
      )
      if (eventError) {
        calendarError.value = eventError
        return
      }
    } else if (savedExamId.value) {
      // Reintento tras un fallo al crear el evento: el examen ya existe.
      const { eventError } = await exams.updateExamWithEvent(
        savedExamId.value,
        draft,
        eventChoice.value
      )
      if (eventError) {
        calendarError.value = eventError
        return
      }
    } else {
      const { exam, eventError } = await exams.createExamWithEvent(draft, eventChoice.value)
      if (eventError) {
        savedExamId.value = exam.id
        calendarError.value = eventError
        return
      }
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

        <EventChoiceField
          :key="editing?.id ?? 'new'"
          v-model="eventChoice"
          :date="date"
          :link="editing?.event_link ?? null"
          test-id-prefix="exam"
          disabled-hint="Elegí una fecha para poder agendar un evento."
          :error="calendarError"
        />

        <div class="flex flex-col gap-1.5">
          <label for="exam-block-select" class="select-none text-body-sm text-ink-muted">
            Materia (bloque)
          </label>
          <div class="flex items-center gap-2">
            <select
              id="exam-block-select"
              v-model="blockId"
              data-testid="exam-block-select"
              class="h-10 min-w-0 flex-1 rounded-md border border-hairline bg-surface-1 px-3 text-body text-ink transition-colors duration-150 hover:border-hairline-strong focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Sin bloque</option>
              <option v-for="block in blocks" :key="block.id" :value="block.id">
                {{ block.title }}
              </option>
            </select>
            <span
              data-testid="exam-color-preview"
              class="h-6 w-6 shrink-0 rounded-md border border-hairline"
              :style="{ backgroundColor: blockColorRgb(previewColor) }"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="select-none text-body-sm text-ink-muted">Estado</span>
          <div class="flex gap-2">
            <button
              v-for="option in statusOptions"
              :key="option.value"
              type="button"
              :data-testid="`exam-status-${option.value}`"
              :class="[
                'rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                status === option.value
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
              ]"
              @click="status = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <Input
          v-model="gradeInput"
          data-testid="exam-grade-input"
          type="number"
          label="Nota"
          placeholder="Ej: 8.5"
          min="0"
          max="10"
          :disabled="status !== 'rendido'"
          helper="Sólo se guarda si el examen está rendido."
        />

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Text variant="body-sm" color="muted">Temas</Text>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              data-testid="add-topic-button"
              @click="addTopic"
            >
              + Agregar tema
            </Button>
          </div>

          <div v-if="topics.length > 0" class="flex flex-col gap-2">
            <div v-for="(topic, index) in topics" :key="topic.id" class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <label
                  class="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
                  @click.stop
                >
                  <input
                    type="checkbox"
                    :checked="topic.completed"
                    data-testid="topic-checkbox"
                    class="peer absolute inset-0 cursor-pointer opacity-0"
                    @change="toggleTopicCompleted(index)"
                  />
                  <span
                    :class="[
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150',
                      topic.completed
                        ? 'border-primary bg-primary'
                        : 'border-hairline-strong bg-surface-1',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-focus/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
                    ]"
                  >
                    <Check
                      v-if="topic.completed"
                      :size="12"
                      class="text-on-primary"
                      stroke-width="3"
                    />
                  </span>
                </label>
                <Input
                  v-model="topic.title"
                  data-testid="topic-input"
                  :placeholder="`Tema ${index + 1}`"
                  maxlength="100"
                  @update:model-value="(val) => updateTopicTitle(index, val)"
                />
                <button
                  type="button"
                  data-testid="remove-topic-button"
                  class="rounded p-2 text-ink-muted hover:bg-surface-2"
                  @click="removeTopic(index)"
                >
                  <X :size="16" />
                </button>
              </div>

              <div class="ml-6 flex flex-col gap-1">
                <div
                  v-for="(subtopic, subIndex) in topic.subtopics"
                  :key="subtopic.id"
                  class="flex items-center gap-2"
                >
                  <label
                    class="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      :checked="subtopic.completed"
                      data-testid="subtopic-checkbox"
                      class="peer absolute inset-0 cursor-pointer opacity-0"
                      @change="toggleSubtopicCompleted(index, subIndex)"
                    />
                    <span
                      :class="[
                        'flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150',
                        subtopic.completed
                          ? 'border-primary bg-primary'
                          : 'border-hairline-strong bg-surface-1',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-focus/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
                      ]"
                    >
                      <Check
                        v-if="subtopic.completed"
                        :size="12"
                        class="text-on-primary"
                        stroke-width="3"
                      />
                    </span>
                  </label>
                  <Input
                    v-model="subtopic.title"
                    data-testid="subtopic-input"
                    :placeholder="`Subtema ${subIndex + 1}`"
                    maxlength="100"
                    @update:model-value="(val) => updateSubtopicTitle(index, subIndex, val)"
                  />
                  <button
                    type="button"
                    data-testid="remove-subtopic-button"
                    class="rounded p-2 text-ink-muted hover:bg-surface-2"
                    @click="removeSubtopic(index, subIndex)"
                  >
                    <X :size="14" />
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="add-subtopic-button"
                  class="self-start rounded px-2 py-1 text-caption text-ink-muted hover:bg-surface-2"
                  @click="addSubtopic(index)"
                >
                  + Agregar subtema
                </button>
              </div>
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
