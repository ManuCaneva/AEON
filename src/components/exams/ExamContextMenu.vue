<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useExamsStore } from '@/stores/exams'
import EntityEventContextMenu from '@/components/ui/EntityEventContextMenu.vue'

const props = defineProps<{ examId: string }>()

const ui = useUiStore()
const exams = useExamsStore()

// Con vínculo a un evento el borrado ofrece dos salidas; sin vínculo, una sola.
const hasEventLink = computed(
  () => exams.exams.find((e) => e.id === props.examId)?.event_link != null
)

function handleEdit() {
  ui.openEditExam(props.examId)
}

/** 'Solo la entidad': borra el examen y deja su evento intacto. */
async function handleDeleteExamOnly() {
  try {
    await exams.deleteExamWithEvent(props.examId, false)
  } finally {
    ui.closeExamMenu()
  }
}

/** 'La entidad y su evento': borra también el evento de su vínculo vigente. */
async function handleDeleteWithEvent() {
  try {
    await exams.deleteExamWithEvent(props.examId, true)
  } finally {
    ui.closeExamMenu()
  }
}
</script>

<template>
  <EntityEventContextMenu
    :entity-id="examId"
    trigger-data-attr="data-exam-menu-trigger"
    :show-delete="true"
    :has-event-link="hasEventLink"
    :can-delete-without-link="true"
    :show-confirm-cancel="true"
    confirm-title="¿Eliminar examen?"
    delete-only-label="Solo la entidad"
    delete-with-event-label="La entidad y su evento"
    :test-ids="{
      edit: 'exam-edit-button',
      delete: 'exam-delete-button',
      confirm: 'exam-delete-confirm',
      only: 'exam-delete-exam-only',
      withEvent: 'exam-delete-exam-and-event',
      confirmYes: 'exam-delete-confirm-yes',
      confirmNo: 'exam-delete-confirm-no',
    }"
    @edit="handleEdit"
    @delete-only="handleDeleteExamOnly"
    @delete-with-event="handleDeleteWithEvent"
    @close="ui.closeExamMenu()"
  />
</template>
