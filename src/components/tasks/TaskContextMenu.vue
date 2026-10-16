<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-vue-next'
import type { Task } from '@/schemas/tasks'

const props = defineProps<{ task: Task }>()

const ui = useUiStore()
const tasks = useTasksStore()

const confirming = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)
const position = ref({ top: 0, left: 0 })

// Las tareas se archivan; sólo se ofrece borrar cuando hay un vínculo a un
// evento, y el borrado pregunta si se lleva el evento o no.
const hasEventLink = ref(props.task.event_link !== null)

function updatePosition() {
  const trigger = document.querySelector(`[data-task-menu-trigger="${props.task.id}"]`)
  if (trigger) {
    const rect = trigger.getBoundingClientRect()
    position.value = {
      top: rect.bottom + 4,
      left: rect.right - 176,
    }
  }
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    const target = e.target as HTMLElement
    if (target.closest(`[data-task-menu-trigger="${props.task.id}"]`)) {
      return
    }
    ui.closeTaskMenu()
  }
}

onMounted(() => {
  nextTick(updatePosition)
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

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
    confirming.value = false
    ui.closeTaskMenu()
  }
}

/** 'La tarea y su evento': borra también el evento de su vínculo vigente. */
async function handleDeleteWithEvent() {
  try {
    await tasks.deleteTaskWithEvent(props.task.id, true)
  } finally {
    confirming.value = false
    ui.closeTaskMenu()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      :style="{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 50,
      }"
      class="w-48 animate-fade-in rounded-lg border border-hairline-strong bg-surface-2 py-1 shadow-xl"
      role="menu"
    >
      <button
        type="button"
        data-testid="task-edit-button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-ink transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="handleEdit"
      >
        <Pencil :size="14" />
        Editar
      </button>

      <button
        type="button"
        data-testid="task-archive-button"
        :class="[
          'flex w-full items-center gap-2 px-3 py-2 text-body-sm transition-colors',
          'hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none',
          task.archived_at ? 'text-ink' : 'text-accent-red',
        ]"
        role="menuitem"
        @click="handleArchiveToggle"
      >
        <ArchiveRestore v-if="task.archived_at" :size="14" />
        <Archive v-else :size="14" />
        {{ task.archived_at ? 'Restaurar' : 'Archivar' }}
      </button>

      <button
        v-if="hasEventLink && !confirming"
        type="button"
        data-testid="task-delete-button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-accent-red transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="confirming = true"
      >
        <Trash2 :size="14" />
        Eliminar
      </button>

      <div
        v-else-if="confirming"
        data-testid="task-delete-confirm"
        class="flex flex-col gap-2 px-3 py-2"
      >
        <span class="text-body-sm text-ink">¿Eliminar tarea?</span>
        <button
          type="button"
          data-testid="task-delete-task-only"
          class="rounded-md bg-surface-3 px-2 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-2"
          @click="handleDeleteTaskOnly"
        >
          Solo la tarea
        </button>
        <button
          type="button"
          data-testid="task-delete-task-and-event"
          class="rounded-md bg-accent-red px-2 py-1.5 text-caption font-medium text-on-primary transition-colors hover:opacity-90"
          @click="handleDeleteWithEvent"
        >
          La tarea y su evento
        </button>
      </div>
    </div>
  </Teleport>
</template>
