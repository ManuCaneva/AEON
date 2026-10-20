<script setup lang="ts">
import { computed } from 'vue'
import { useExamsStore } from '@/stores/exams'
import ExamCard from '@/components/exams/ExamCard.vue'
import NewExamCard from '@/components/exams/NewExamCard.vue'
import EmptyState from '@/components/exams/EmptyState.vue'
import EntityListing from '@/components/ui/EntityListing.vue'

withDefaults(
  defineProps<{
    showEyebrow?: boolean
  }>(),
  {
    showEyebrow: true,
  }
)

const exams = useExamsStore()

// El store ya entrega el listado ordenado: los próximos arriba y los que ya
// pasaron abajo (el más reciente primero).
const list = computed(() => exams.orderedExams)
</script>

<template>
  <EntityListing
    title="Exámenes"
    eyebrow="Próximos"
    :show-eyebrow="showEyebrow"
    panel-test-id="exams-panel"
    entity-class="exams"
  >
    <EmptyState v-if="list.length === 0" />
    <div v-else class="flex flex-col gap-2">
      <ExamCard v-for="exam in list" :key="exam.id" :exam="exam" />
    </div>
    <template #footer>
      <NewExamCard />
    </template>
  </EntityListing>
</template>
