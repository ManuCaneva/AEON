<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' }
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <!-- Sin <Transition>: animar la opacidad de un ancestro del panel con
         backdrop-filter fuerza a WebKitGTK (Linux) a re-componer la textura en
         cada frame y deja ver un buffer desfasado (parpadeo al abrir/cerrar).
         El montaje atómico evita el recomposite animado. -->
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4"
      @click.self="emit('close')"
    >
      <div
        :class="[
          'glass-overlay w-full overflow-hidden rounded-xl shadow-2xl ring-1 ring-hairline-strong/20',
          size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        ]"
        role="dialog"
        aria-modal="true"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
