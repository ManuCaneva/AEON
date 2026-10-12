<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useExamsStore } from '@/stores/exams'
import { Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{ examId: string }>()

const ui = useUiStore()
const exams = useExamsStore()

const confirming = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)
const position = ref({ top: 0, left: 0 })

function updatePosition() {
  const trigger = document.querySelector(`[data-exam-menu-trigger="${props.examId}"]`)
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
    if (target.closest(`[data-exam-menu-trigger="${props.examId}"]`)) {
      return
    }
    ui.closeExamMenu()
  }
}

onMounted(() => {
  nextTick(updatePosition)
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

function handleEdit() {
  ui.openEditExam(props.examId)
}

function requestDelete() {
  confirming.value = true
}

function handleCancel() {
  confirming.value = false
}

async function handleConfirm() {
  try {
    await exams.deleteExam(props.examId)
  } finally {
    confirming.value = false
    ui.closeExamMenu()
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
      class="w-44 animate-fade-in rounded-lg border border-hairline-strong bg-surface-2 py-1 shadow-xl"
      role="menu"
    >
      <button
        type="button"
        data-testid="exam-edit-button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-ink transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="handleEdit"
      >
        <Pencil :size="14" />
        Editar
      </button>

      <button
        v-if="!confirming"
        type="button"
        data-testid="exam-delete-button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-accent-red transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="requestDelete"
      >
        <Trash2 :size="14" />
        Eliminar
      </button>

      <div v-else data-testid="exam-delete-confirm" class="flex flex-col gap-2 px-3 py-2">
        <span class="text-body-sm text-ink">¿Eliminar examen?</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-testid="exam-delete-confirm-yes"
            class="flex-1 rounded-md bg-accent-red px-2 py-1.5 text-caption font-medium text-on-primary transition-colors hover:opacity-90"
            @click="handleConfirm"
          >
            Eliminar
          </button>
          <button
            type="button"
            data-testid="exam-delete-confirm-no"
            class="flex-1 rounded-md bg-surface-3 px-2 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-2"
            @click="handleCancel"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
