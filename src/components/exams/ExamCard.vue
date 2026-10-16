<script setup lang="ts">
import { computed, ref } from 'vue'
import { MoreHorizontal, Check } from 'lucide-vue-next'
import type { Exam } from '@/schemas/exams'
import { useUiStore } from '@/stores/ui'
import { useExamsStore } from '@/stores/exams'
import { daysLabel } from '@/lib/examDays'
import { examInitials } from '@/lib/examInitials'
import { examStatusLabel, examStatusVariant, shouldShowGrade, formatGrade } from '@/lib/examStatus'
import { blockColorRgb, blockColorTint } from '@/lib/scheduleColors'
import Badge from '@/components/ui/Badge.vue'
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import ExamContextMenu from './ExamContextMenu.vue'

const props = defineProps<{
  exam: Exam
}>()

const exams = useExamsStore()
const ui = useUiStore()

const isMenuOpen = computed(() => ui.menuOpenForExamId === props.exam.id)
const daysText = computed(() => daysLabel(props.exam.date))
// Color vivo: el token del bloque mientras exista; si no, el de respaldo.
const colorToken = computed(() => exams.colorFor(props.exam))
const color = computed(() => blockColorRgb(colorToken.value))
// Materia: sólo si hay bloque asociado; se muestra con sus iniciales.
const block = computed(() => exams.blockFor(props.exam))
const materiaLabel = computed(() => (block.value ? examInitials(block.value.title) : ''))
const statusLabel = computed(() => examStatusLabel(props.exam.status))
const statusVariant = computed(() => examStatusVariant(props.exam.status))
const showGrade = computed(() => shouldShowGrade(props.exam.status, props.exam.grade))
const gradeText = computed(() => (props.exam.grade !== null ? formatGrade(props.exam.grade) : ''))

const expanded = ref(false)
const completedTopics = computed(() => props.exam.topics.filter((t) => t.completed).length)
const totalTopics = computed(() => props.exam.topics.length)
const hasTopics = computed(() => totalTopics.value > 0)

function toggleExpand() {
  expanded.value = !expanded.value
}

function handleToggleTopic(topicId: string) {
  exams.toggleTopic(props.exam.id, topicId)
}

function handleToggleSubtopic(topicId: string, subtopicId: string) {
  exams.toggleSubtopic(props.exam.id, topicId, subtopicId)
}
</script>

<template>
  <Container
    data-testid="exam-card"
    variant="ghost"
    padding="sm"
    :class="['exam-card-responsive group relative', isMenuOpen && 'z-10']"
  >
    <div class="flex items-start gap-3">
      <div
        data-testid="exam-color-indicator"
        class="mt-0.5 h-10 w-1 shrink-0 rounded-full"
        :style="{ backgroundColor: color }"
      />

      <div data-testid="exam-card-body" class="min-w-0 flex-1 cursor-pointer" @click="toggleExpand">
        <div class="mb-1 flex items-center gap-2">
          <Text as="div" variant="body" weight="500" class="truncate">
            {{ exam.title }}
          </Text>
          <button
            data-testid="exam-menu-button"
            :data-exam-menu-trigger="exam.id"
            class="ml-auto rounded-md p-1 text-ink-muted opacity-0 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            @click.stop="ui.toggleExamMenu(exam.id)"
          >
            <MoreHorizontal :size="16" />
          </button>
        </div>

        <div data-testid="exam-pills" class="flex items-center gap-3 text-caption">
          <Badge data-testid="exam-status" :variant="statusVariant">
            {{ statusLabel }}
          </Badge>
          <span
            v-if="materiaLabel"
            data-testid="exam-materia"
            class="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-ink"
            :style="{ backgroundColor: blockColorTint(colorToken, 0.16) }"
          >
            {{ materiaLabel }}
          </span>
          <span
            data-testid="exam-days"
            class="inline-flex items-center rounded-full bg-accent-purple-tint px-2 py-0.5 font-medium text-accent-purple"
          >
            {{ daysText }}
          </span>
          <Badge v-if="showGrade" data-testid="exam-grade" variant="success">
            Nota {{ gradeText }}
          </Badge>
        </div>

        <div
          v-if="hasTopics"
          data-testid="exam-topics"
          class="mt-1 flex items-center gap-1 text-caption text-ink-muted"
        >
          <span>{{ completedTopics }}/{{ totalTopics }}</span>
        </div>

        <div class="topics-expand mt-2" :class="{ open: expanded }">
          <div>
            <div v-if="expanded" data-testid="exam-topics-list" class="flex flex-col gap-1 py-1">
              <div
                v-for="topic in exam.topics"
                :key="topic.id"
                data-testid="exam-topic-item"
                class="flex flex-col rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
              >
                <div class="flex items-center gap-2">
                  <label
                    class="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      :checked="topic.completed"
                      data-testid="exam-topic-checkbox"
                      class="peer absolute inset-0 cursor-pointer opacity-0"
                      @click.stop="handleToggleTopic(topic.id)"
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
                  <Text
                    as="span"
                    variant="body-sm"
                    :class="['truncate', topic.completed ? 'text-ink-muted line-through' : '']"
                  >
                    {{ topic.title }}
                  </Text>
                </div>

                <div v-if="topic.subtopics.length > 0" class="ml-6 flex flex-col">
                  <div
                    v-for="subtopic in topic.subtopics"
                    :key="subtopic.id"
                    data-testid="exam-subtopic-item"
                    class="flex items-center gap-2 rounded-md px-1.5 py-1"
                  >
                    <label
                      class="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
                      @click.stop
                    >
                      <input
                        type="checkbox"
                        :checked="subtopic.completed"
                        data-testid="exam-subtopic-checkbox"
                        class="peer absolute inset-0 cursor-pointer opacity-0"
                        @click.stop="handleToggleSubtopic(topic.id, subtopic.id)"
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
                    <Text
                      as="span"
                      variant="body-sm"
                      :class="[
                        'truncate',
                        subtopic.completed ? 'text-ink-muted line-through' : '',
                      ]"
                    >
                      {{ subtopic.title }}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ExamContextMenu v-if="isMenuOpen" :exam-id="exam.id" />
  </Container>
</template>

<style scoped>
.topics-expand {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
  overflow: hidden;
}
.topics-expand.open {
  grid-template-rows: 1fr;
}
.topics-expand > div {
  min-height: 0;
}
</style>
