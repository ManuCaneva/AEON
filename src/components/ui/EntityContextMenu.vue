<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'

// Menú de contexto de una entidad sin evento propio (hábitos, metas, notas):
// editar y eliminar con confirmación. Comparte el chrome y el posicionamiento
// documentado en DESIGN.md; el texto de la confirmación lo aporta cada dominio.
const props = defineProps<{
  entityId: string
  triggerDataAttr: string
  confirmTitle: string
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  close: []
}>()

const confirming = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)
const position = ref({ top: 0, left: 0 })

function updatePosition() {
  const trigger = document.querySelector(`[${props.triggerDataAttr}="${props.entityId}"]`)
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
    if (target.closest(`[${props.triggerDataAttr}="${props.entityId}"]`)) {
      return
    }
    emit('close')
  }
}

onMounted(() => {
  nextTick(updatePosition)
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

function handleConfirm() {
  confirming.value = false
  emit('delete')
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
      class="glass-overlay w-44 animate-fade-in rounded-lg py-1 shadow-xl"
      role="menu"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-ink transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="emit('edit')"
      >
        <Pencil :size="14" />
        Editar
      </button>
      <button
        v-if="!confirming"
        type="button"
        data-testid="entity-delete-button"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-accent-red transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="confirming = true"
      >
        <Trash2 :size="14" />
        Eliminar
      </button>

      <div v-else data-testid="entity-delete-confirm" class="flex flex-col gap-2 px-3 py-2">
        <span class="text-body-sm text-ink">{{ confirmTitle }}</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-testid="entity-delete-confirm-yes"
            class="flex-1 rounded-md bg-accent-red px-2 py-1.5 text-caption font-medium text-on-primary transition-colors hover:opacity-90"
            @click="handleConfirm"
          >
            Eliminar
          </button>
          <button
            type="button"
            data-testid="entity-delete-confirm-no"
            class="flex-1 rounded-md bg-surface-3 px-2 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-2"
            @click="confirming = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
