<script setup lang="ts">
import { computed } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import type { Exam } from '@/schemas/exams'
import { useUiStore } from '@/stores/ui'
import { daysLabel } from '@/lib/examDays'
import { examStatusLabel, examStatusVariant, shouldShowGrade, formatGrade } from '@/lib/examStatus'
import { blockColorRgb } from '@/lib/scheduleColors'
import Badge from '@/components/ui/Badge.vue'
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import ExamContextMenu from './ExamContextMenu.vue'

const props = defineProps<{
  exam: Exam
}>()

const ui = useUiStore()

const isMenuOpen = computed(() => ui.menuOpenForExamId === props.exam.id)
const daysText = computed(() => daysLabel(props.exam.date))
const color = computed(() => blockColorRgb(props.exam.fallback_color))
const statusLabel = computed(() => examStatusLabel(props.exam.status))
const statusVariant = computed(() => examStatusVariant(props.exam.status))
const showGrade = computed(() => shouldShowGrade(props.exam.status, props.exam.grade))
const gradeText = computed(() => (props.exam.grade !== null ? formatGrade(props.exam.grade) : ''))
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

      <div class="min-w-0 flex-1">
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
            data-testid="exam-days"
            class="inline-flex items-center rounded-full bg-accent-purple-tint px-2 py-0.5 font-medium text-accent-purple"
          >
            {{ daysText }}
          </span>
          <Badge v-if="showGrade" data-testid="exam-grade" variant="success">
            Nota {{ gradeText }}
          </Badge>
        </div>
      </div>
    </div>
    <ExamContextMenu v-if="isMenuOpen" :exam-id="exam.id" />
  </Container>
</template>
