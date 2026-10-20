<script setup lang="ts">
import Text from '@/components/ui/Text.vue'

/**
 * Header navegable del pomodoro, compartido por el widget del dashboard y por
 * la ventana mini: la fila completa se activa con el click y con el teclado, y
 * el título ilumina en hover. La ventana hospedera define qué pasa al
 * activarlo y qué botones viven en el header.
 */
const props = defineProps<{ testIdPrefix: string }>()
const emit = defineEmits<{ activate: [] }>()

function testId(suffix: string): string {
  return `${props.testIdPrefix}-${suffix}`
}

function activate(): void {
  emit('activate')
}

function onHeaderKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}
</script>

<template>
  <header
    :data-testid="testId('header')"
    role="button"
    tabindex="0"
    aria-label="Ir a la página Pomodoro"
    class="group flex shrink-0 cursor-pointer items-center justify-start border-b border-hairline bg-surface-2 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    @click="activate"
    @keydown="onHeaderKeydown"
  >
    <Text
      variant="card-title"
      weight="600"
      class="text-left text-ink-muted transition-colors group-hover:text-ink"
      >Pomodoro</Text
    >
    <slot name="actions" />
  </header>
</template>
