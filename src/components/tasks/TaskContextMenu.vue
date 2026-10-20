<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import type { Task } from '@/schemas/tasks'
import EntityEventContextMenu from '@/components/ui/EntityEventContextMenu.vue'

const props = defineProps<{ task: Task }>()

const ui = useUiStore()
const tasks = useTasksStore()

// Las tareas se archivan; sólo se ofrece borrar cuando hay un vínculo a un
// evento, y el borrado pregunta si se lleva el evento o no.
const hasEventLink = computed(() => props.task.event_link !== null)

function handleEdit() {
  ui.openEditTask(props.task.id)
}

async function handleArchiveToggle() {
  try {
    if (props.task.archived_at) {
      await tasks.restoreTask(props.task.id)
    } else {
      await tasks.archiveTask(props.task.id)
    }
  } finally {
    ui.closeTaskMenu()
  }
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
    :show-archive="true"
    :is-archived="task.archived_at !== null"
    :show-delete="hasEventLink"
    :has-event-link="hasEventLink"
    :can-delete-without-link="false"
    :show-confirm-cancel="false"
    confirm-title="¿Eliminar tarea?"
    delete-only-label="Solo la tarea"
    delete-with-event-label="La tarea y su evento"
    :test-ids="{
      edit: 'task-edit-button',
      archive: 'task-archive-button',
      delete: 'task-delete-button',
      confirm: 'task-delete-confirm',
      only: 'task-delete-task-only',
      withEvent: 'task-delete-task-and-event',
    }"
    @edit="handleEdit"
    @archive-toggle="handleArchiveToggle"
    @delete-only="handleDeleteTaskOnly"
    @delete-with-event="handleDeleteWithEvent"
    @close="ui.closeTaskMenu()"
  />
</template>
