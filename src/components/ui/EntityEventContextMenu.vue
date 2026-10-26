<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-vue-next'

// Menú de contexto de una entidad con evento propio (examen o tarea): editar,
// archivar (opcional) y eliminar con confirmación. Comparte el chrome y el
// posicionamiento documentado en DESIGN.md; los textos y los data-testid los
// aporta cada dominio. EntityContextMenu sigue siendo el menú de las entidades
// sin evento (hábitos, metas, notas).

const props = defineProps<{
  entityId: string
  /** Atributo data-* del gatillo, p. ej. `data-task-menu-trigger`. */
  triggerDataAttr: string
  showArchive: boolean
  isArchived: boolean
  /** Ofrece la acción destructiva. */
  showDelete: boolean
  /** Con vínculo la confirmación ofrece dos salidas. */
  hasEventLink: boolean
  /** Sin vínculo, permite confirmar un borrado simple. */
  canDeleteWithoutLink: boolean
  /** Muestra «Cancelar» dentro de la confirmación de dos salidas. */
  showConfirmCancel: boolean
  confirmTitle: string
  deleteOnlyLabel: string
  deleteWithEventLabel: string
  testIds: {
    edit: string
    archive?: string
    delete: string
    confirm: string
    only: string
    withEvent: string
    confirmYes?: string
    confirmNo?: string
  }
}>()

const emit = defineEmits<{
  edit: []
  'archive-toggle': []
  'delete-only': []
  'delete-with-event': []
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

function handleDeleteOnly() {
  confirming.value = false
  emit('delete-only')
}

function handleDeleteWithEvent() {
  confirming.value = false
  emit('delete-with-event')
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
        :data-testid="testIds.edit"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-ink transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="emit('edit')"
      >
        <Pencil :size="14" />
        Editar
      </button>

      <button
        v-if="showArchive"
        type="button"
        :data-testid="testIds.archive"
        :class="[
          'flex w-full items-center gap-2 px-3 py-2 text-body-sm transition-colors',
          'hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none',
          isArchived ? 'text-ink' : 'text-accent-red',
        ]"
        role="menuitem"
        @click="emit('archive-toggle')"
      >
        <ArchiveRestore v-if="isArchived" :size="14" />
        <Archive v-else :size="14" />
        {{ isArchived ? 'Restaurar' : 'Archivar' }}
      </button>

      <button
        v-if="showDelete && !confirming"
        type="button"
        :data-testid="testIds.delete"
        class="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-accent-red transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
        role="menuitem"
        @click="confirming = true"
      >
        <Trash2 :size="14" />
        Eliminar
      </button>

      <div
        v-else-if="confirming"
        :data-testid="testIds.confirm"
        class="flex flex-col gap-2 px-3 py-2"
      >
        <span class="text-body-sm text-ink">{{ confirmTitle }}</span>
        <template v-if="hasEventLink">
          <button
            type="button"
            :data-testid="testIds.only"
            class="rounded-md bg-surface-3 px-2 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-2"
            @click="handleDeleteOnly"
          >
            {{ deleteOnlyLabel }}
          </button>
          <button
            type="button"
            :data-testid="testIds.withEvent"
            class="rounded-md bg-accent-red px-2 py-1.5 text-caption font-medium text-on-primary transition-colors hover:opacity-90"
            @click="handleDeleteWithEvent"
          >
            {{ deleteWithEventLabel }}
          </button>
          <button
            v-if="showConfirmCancel"
            type="button"
            :data-testid="testIds.confirmNo"
            class="rounded-md px-2 py-1 text-caption font-medium text-ink-muted transition-colors hover:bg-surface-2"
            @click="confirming = false"
          >
            Cancelar
          </button>
        </template>
        <div v-else-if="canDeleteWithoutLink" class="flex items-center gap-2">
          <button
            type="button"
            :data-testid="testIds.confirmYes"
            class="flex-1 rounded-md bg-accent-red px-2 py-1.5 text-caption font-medium text-on-primary transition-colors hover:opacity-90"
            @click="handleDeleteOnly"
          >
            Eliminar
          </button>
          <button
            type="button"
            :data-testid="testIds.confirmNo"
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
