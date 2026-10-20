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
          'glass-overlay flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-hairline-strong/20',
          size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        ]"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header y footer fijos: el cuerpo es el único que scrollea. Así el
             popup jamás puede crecer más que la pantalla (max-h arriba). -->
        <div v-if="$slots.header" data-testid="modal-header" class="shrink-0">
          <slot name="header" />
        </div>
        <div v-if="$slots.default" data-testid="modal-body" class="min-h-0 flex-1 overflow-y-auto">
          <slot />
        </div>
        <div v-if="$slots.footer" data-testid="modal-footer" class="shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
