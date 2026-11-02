<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import type { Task } from '@/schemas/tasks'
import EntityEventContextMenu from '@/components/ui/EntityEventContextMenu.vue'

const props = defineProps<{ task: Task }>()

const ui = useUiStore()
const tasks = useTasksStore()

// Toda tarea se puede eliminar; siempre con confirmación. Con vínculo a un
// evento la confirmación ofrece dos salidas: dejar el evento o borrarlo también.
const hasEventLink = computed(() => props.task.event_link !== null)

function handleEdit() {
  ui.openEditTask(props.task.id)
}

/** 'Solo la tarea': borra la tarea y deja su evento intacto. */
async function handleDeleteTaskOnly() {
  try {
    await tasks.deleteTaskWithEvent(props.task.id, false)
  } finally {
    ui.closeTaskMenu()
  }
}

/** 'La tarea y su evento': borra también el evento de su vínculo vigente. */
async function handleDeleteWithEvent() {
  try {
    await tasks.deleteTaskWithEvent(props.task.id, true)
  } finally {
    ui.closeTaskMenu()
  }
}
</script>

<template>
  <EntityEventContextMenu
    :entity-id="task.id"
    trigger-data-attr="data-task-menu-trigger"
    :show-delete="true"
    :has-event-link="hasEventLink"
    :can-delete-without-link="true"
    :show-confirm-cancel="true"
    confirm-title="¿Eliminar tarea?"
    delete-only-label="Solo la tarea"
    delete-with-event-label="La tarea y su evento"
    :test-ids="{
      edit: 'task-edit-button',
      delete: 'task-delete-button',
      confirm: 'task-delete-confirm',
      only: 'task-delete-task-only',
      withEvent: 'task-delete-task-and-event',
      confirmYes: 'task-delete-confirm-yes',
      confirmNo: 'task-delete-confirm-no',
    }"
    @edit="handleEdit"
    @delete-only="handleDeleteTaskOnly"
    @delete-with-event="handleDeleteWithEvent"
    @close="ui.closeTaskMenu()"
  />
</template>
